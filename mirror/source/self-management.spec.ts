/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import {
  acquireBackgroundUpdateLease,
  buildAssetCandidates,
  createUpgradeRecovery,
  createUpgradeResolutionFailure,
  detectNativeArch,
  detectNativePlatform,
  executeUpgrade,
  listAvailableVersions,
  readUpdateCache,
  releaseBackgroundUpdateLease,
  resolveUpgradePlan,
  runBackgroundUpdateCheck,
  scheduleBackgroundUpdateCheck,
} from './self-management.js'
import { joinPath } from './path.js'
import { ensureDirectory, removePath, runCommand, writeTextFile } from './runtime.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => removePath(path)))
})

describe('Mirror self-management', () => {
  test.serial('coalesces concurrent background checks into one bounded worker lease', async () => {
    const root = await createTempDirectory()
    let fetchCount = 0
    let releaseFetch: () => void = () => undefined
    const fetchGate = new Promise<void>((resolve) => { releaseFetch = resolve })
    const fetcher = (async () => {
      fetchCount += 1
      await fetchGate
      return Response.json(release('@guiho/mirror@3.5.6', '2026-07-20T00:00:00Z'))
    }) as unknown as typeof fetch

    const checks = Array.from({ length: 32 }, () => runBackgroundUpdateCheck({
      cacheDir: root,
      currentVersion: '3.5.6',
      fetch: fetcher,
      updateTimeoutMilliseconds: 10_000,
    }))
    await waitFor(() => fetchCount === 1)
    releaseFetch()
    await Promise.all(checks)

    expect(fetchCount).toBe(1)
    expect((await readUpdateCache({ cacheDir: root }))?.latestVersion).toBe('3.5.6')
    const nextLease = await acquireBackgroundUpdateLease({ cacheDir: root })
    expect(nextLease).not.toBeNull()
    if (nextLease) expect(await releaseBackgroundUpdateLease(nextLease, { cacheDir: root })).toBe(true)
  })

  test.serial('serializes stale-lock reclaimers and prevents an old owner from deleting the replacement', async () => {
    const root = await createTempDirectory()
    const oldNow = Date.parse('2026-07-20T00:00:00Z')
    const currentNow = oldNow + 31_000
    const oldLease = await acquireBackgroundUpdateLease({ cacheDir: root, now: () => oldNow })
    expect(oldLease).not.toBeNull()

    const contenders = await Promise.all(Array.from({ length: 32 }, () => acquireBackgroundUpdateLease({
      cacheDir: root,
      now: () => currentNow,
      lockStaleMilliseconds: 30_000,
    })))
    const replacements = contenders.filter((lease) => lease !== null)
    expect(replacements).toHaveLength(1)
    expect(replacements[0]?.token).not.toBe(oldLease?.token)
    if (oldLease) expect(await releaseBackgroundUpdateLease(oldLease, { cacheDir: root })).toBe(false)
    if (replacements[0]) expect(await releaseBackgroundUpdateLease(replacements[0], { cacheDir: root })).toBe(true)
  })

  test.serial('aborts a hanging background request and always releases its lease', async () => {
    const root = await createTempDirectory()
    const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')), { once: true })
    })) as typeof fetch

    await expect(runBackgroundUpdateCheck({
      cacheDir: root,
      currentVersion: '3.5.6',
      fetch: fetcher,
      updateTimeoutMilliseconds: 25,
    })).rejects.toThrow('timed out after 25ms')
    const nextLease = await acquireBackgroundUpdateLease({ cacheDir: root })
    expect(nextLease).not.toBeNull()
    if (nextLease) expect(await releaseBackgroundUpdateLease(nextLease, { cacheDir: root })).toBe(true)
  })

  test.serial('isolates scheduler failures from foreground commands and never recurses from a worker', async () => {
    const root = await createTempDirectory()
    const obstructedCache = joinPath(root, 'not-a-directory')
    await writeTextFile(obstructedCache, 'occupied')
    expect(await scheduleBackgroundUpdateCheck({ cacheDir: obstructedCache, sourceCheckout: false })).toBe(false)

    const previousWorker = process.env['MIRROR_BACKGROUND_UPDATE_CHECK']
    process.env['MIRROR_BACKGROUND_UPDATE_CHECK'] = '1'
    try {
      expect(await scheduleBackgroundUpdateCheck({ cacheDir: root, sourceCheckout: false })).toBe(false)
    } finally {
      if (previousWorker === undefined) delete process.env['MIRROR_BACKGROUND_UPDATE_CHECK']
      else process.env['MIRROR_BACKGROUND_UPDATE_CHECK'] = previousWorker
    }
  })

  test.serial('spawns only one real worker process during a concurrent foreground burst', async () => {
    const root = await createTempDirectory()
    const executable = joinPath(root, detectNativePlatform() === 'windows' ? 'mirror-worker-fixture.exe' : 'mirror-worker-fixture')
    await compileVersionFixture(root, 'worker-fixture.ts', executable, `
if (process.argv.includes('--mirror-update-check-worker')) {
  await Bun.write(${JSON.stringify(joinPath(root, 'worker-'))} + process.pid + '.marker', '')
  await Bun.sleep(750)
}
`)

    const scheduled = await Promise.all(Array.from({ length: 32 }, () => scheduleBackgroundUpdateCheck({
      cacheDir: root,
      executablePath: executable,
      sourceCheckout: false,
    })))
    expect(scheduled.filter(Boolean)).toHaveLength(1)
    await waitFor(() => [...new Bun.Glob('worker-*.marker').scanSync({ cwd: root })].length === 1)
    const marker = [...new Bun.Glob('worker-*.marker').scanSync({ cwd: root })][0]
    const pid = marker ? Number.parseInt(marker.slice('worker-'.length, -'.marker'.length), 10) : 0
    expect(pid).toBeGreaterThan(0)
    expect(isProcessRunning(pid)).toBe(true)
    await Bun.sleep(1_000)
    expect(isProcessRunning(pid)).toBe(false)
  }, 30_000)

  test('builds recovery commands pinned to stable and prerelease versions', () => {
    const windows = createUpgradeRecovery('3.4.2', 'resolved', 'windows')
    const posix = createUpgradeRecovery('3.5.0-alpha.1', 'resolved', 'linux')

    expect(windows.installCommand).toContain("-Version '3.4.2'")
    expect(windows.stopProcessCommand).toContain('Stop-Process -Force')
    expect(posix.installCommand).toContain("--version '3.5.0-alpha.1'")
    expect(posix.stopProcessCommand).toBe('pkill -x mirror')
    expect(createUpgradeResolutionFailure(new Error('offline'), { currentVersion: '3.4.1', platform: 'windows' }).recovery.targetSource).toBe('fallback-current')
  })

  test('uses the same deterministic native asset candidate order', () => {
    expect(buildAssetCandidates('windows', 'x64', 'baseline')).toEqual([
      'mirror-windows-x64-baseline.exe',
      'mirror-windows-x64.exe',
      'mirror-windows-x64-modern.exe',
    ])
    expect(buildAssetCandidates('linux', 'arm64', 'baseline')).toEqual(['mirror-linux-arm64'])
  })

  test('rejects exact-version metadata whose canonical Mirror tag does not match the request', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    await writeTextFile(executable, platform === 'windows' ? 'MZ' : '\x7fELF')
    await expect(resolveUpgradePlan({
      version: '3.4.2',
      executablePath: executable,
      currentVersion: '3.4.1',
      platform,
      arch: detectNativeArch(),
      fetch: releaseFetch('9.9.9', buildAssetCandidates(platform, detectNativeArch(), 'baseline')[0]!),
    })).rejects.toThrow('Requested Mirror 3.4.2')
  })

  test('exhausts pagination and returns a SemVer-sorted complete catalog', async () => {
    const baselineAsset = buildAssetCandidates('windows', 'x64', 'baseline')[0]!
    const fetcher = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      if (url.searchParams.get('page') === '1') {
        return Response.json([
          release('@guiho/mirror@3.4.1', '2026-07-10T00:00:00Z', baselineAsset),
          { ...release('@guiho/mirror@9.0.0', '2026-07-10T00:00:00Z', baselineAsset), draft: true },
          release('not-semver', '2026-07-09T00:00:00Z', baselineAsset),
          release('v3.4.9', '2026-07-09T00:00:00Z', baselineAsset),
        ], { headers: { Link: '<https://api.test/repos/CGuiho/mirror/releases?per_page=100&page=2>; rel="next"' } })
      }
      return Response.json([
        release('@guiho/mirror@3.5.0-alpha.1', '2026-07-15T00:00:00Z', baselineAsset),
        release('@guiho/mirror@3.4.2', '2026-07-14T00:00:00Z'),
      ])
    }) as typeof fetch

    const catalog = await listAvailableVersions({
      apiBaseUrl: 'https://api.test',
      currentVersion: '3.4.1',
      platform: 'windows',
      arch: 'x64',
      fetch: fetcher,
    })

    expect(catalog.complete).toBe(true)
    expect(catalog.pagesFetched).toBe(2)
    expect(catalog.releases.map((item) => item.version)).toEqual(['3.5.0-alpha.1', '3.4.2', '3.4.1'])
    expect(catalog.latestStableVersion).toBe('3.4.2')
    expect(catalog.releases[0]?.channel).toBe('alpha')
    expect(catalog.releases[1]?.latestStable).toBe(true)
    expect(catalog.releases[1]?.compatible).toBe(false)
    expect(catalog.releases[2]?.current).toBe(true)
    expect(catalog.warnings).toContain('Skipped malformed Mirror release tag: not-semver')
    expect(catalog.warnings).toContain('Skipped malformed Mirror release tag: v3.4.9')
  })

  test('times out a hanging candidate version probe without mutating the canonical executable', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    const download = joinPath(root, platform === 'windows' ? 'download.exe' : 'download')
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    await compileVersionFixture(root, 'old.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(root, 'hanging.ts', download, 'setInterval(() => undefined, 1_000)')
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const plan = await resolveUpgradePlan({
      version: targetVersion,
      executablePath: executable,
      currentVersion,
      platform,
      arch,
      fetch: releaseFetch(targetVersion, asset),
    })
    const previousTimeout = process.env['MIRROR_BINARY_VERSION_TIMEOUT_MS']
    process.env['MIRROR_BINARY_VERSION_TIMEOUT_MS'] = '250'
    try {
      const result = await executeUpgrade(plan, { fetch: (async () => new Response(Bun.file(download))) as unknown as typeof fetch })
      expect(result.outcome).toBe('failed')
      expect(result.failure?.code).toBe('UPGRADE_TEMP_VERSION_MISMATCH')
      expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(currentVersion)
    } finally {
      if (previousTimeout === undefined) delete process.env['MIRROR_BINARY_VERSION_TIMEOUT_MS']
      else process.env['MIRROR_BINARY_VERSION_TIMEOUT_MS'] = previousTimeout
    }
  }, 30_000)

  test('rejects decorated version stdout instead of extracting a trailing SemVer', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    const download = joinPath(root, platform === 'windows' ? 'download.exe' : 'download')
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    await compileVersionFixture(root, 'old.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(root, 'decorated.ts', download, `console.log('Mirror ${targetVersion}')`)
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const plan = await resolveUpgradePlan({
      version: targetVersion,
      executablePath: executable,
      currentVersion,
      platform,
      arch,
      fetch: releaseFetch(targetVersion, asset),
    })
    const result = await executeUpgrade(plan, { fetch: (async () => new Response(Bun.file(download))) as unknown as typeof fetch })
    expect(result.outcome).toBe('failed')
    expect(result.failure?.code).toBe('UPGRADE_TEMP_VERSION_MISMATCH')
    expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(currentVersion)
  }, 30_000)

  test('replaces and verifies the canonical native executable before committing cache', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    const download = joinPath(root, platform === 'windows' ? 'download.exe' : 'download')
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    await compileVersionFixture(root, 'old.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(root, 'target.ts', download, `console.log('${targetVersion}')`)
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const metadataFetch = releaseFetch(targetVersion, asset)
    const plan = await resolveUpgradePlan({
      version: targetVersion,
      executablePath: executable,
      currentVersion,
      platform,
      arch,
      fetch: metadataFetch,
    })
    const result = await executeUpgrade(plan, {
      cacheDir: root,
      fetch: (async () => new Response(Bun.file(download))) as unknown as typeof fetch,
    })

    expect(result.outcome).toBe('upgraded')
    expect(result.events.map((event) => `${event.phase}:${event.status}`)).toContain('verify:succeeded')
    expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(targetVersion)
    expect((await readUpdateCache({ cacheDir: root }))?.latestVersion).toBe(targetVersion)
    expect((await readUpdateCache({ cacheDir: root }))?.newVersionAvailable).toBe(false)
  }, 30_000)

  test('rolls back when the canonical executable does not report the target', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    const download = joinPath(root, platform === 'windows' ? 'download.exe' : 'download')
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    await compileVersionFixture(root, 'old.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(
      root,
      'target.ts',
      download,
      `console.log(process.execPath.includes('.mirror-upgrade-') ? '${targetVersion}' : '9.9.9')`,
    )
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const plan = await resolveUpgradePlan({
      version: targetVersion,
      executablePath: executable,
      currentVersion,
      platform,
      arch,
      fetch: releaseFetch(targetVersion, asset),
    })
    const result = await executeUpgrade(plan, { fetch: (async () => new Response(Bun.file(download))) as unknown as typeof fetch })

    expect(result.outcome).toBe('rolled-back')
    expect(result.failure?.code).toBe('UPGRADE_CANONICAL_VERSION_MISMATCH')
    expect(result.failure?.rollbackSucceeded).toBe(true)
    expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(currentVersion)
  }, 30_000)

  test('fails without mutation when Windows sharing permissions deny the canonical rename', async () => {
    if (detectNativePlatform() !== 'windows') return
    const root = await createTempDirectory()
    const executable = joinPath(root, 'mirror.exe')
    const download = joinPath(root, 'download.exe')
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    await compileVersionFixture(root, 'old.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(root, 'target.ts', download, `console.log('${targetVersion}')`)
    const asset = buildAssetCandidates('windows', detectNativeArch(), 'baseline')[0]!
    const plan = await resolveUpgradePlan({
      version: targetVersion,
      executablePath: executable,
      currentVersion,
      platform: 'windows',
      arch: detectNativeArch(),
      fetch: releaseFetch(targetVersion, asset),
    })
    const escapedExecutable = executable.replaceAll("'", "''")
    const locker = Bun.spawn([
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$stream=[IO.File]::Open('${escapedExecutable}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read); [Console]::Out.WriteLine('locked'); [Console]::Out.Flush(); Start-Sleep -Seconds 30; $stream.Dispose()`,
    ], { stdout: 'pipe', stderr: 'pipe' })
    try {
      const ready = await locker.stdout.getReader().read()
      expect(new TextDecoder().decode(ready.value)).toContain('locked')
      const result = await executeUpgrade(plan, {
        fetch: (async () => new Response(Bun.file(download))) as unknown as typeof fetch,
      })
      expect(result.outcome).toBe('failed')
      expect(result.failure?.code).toBe('UPGRADE_RENAME_CURRENT_FAILED')
      expect(result.failure?.rollbackAttempted).toBe(false)
      expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(currentVersion)
    } finally {
      locker.kill()
      await locker.exited
    }
  }, 30_000)

  test('prints the resolved plan and Downloading before a delayed asset body arrives', async () => {
    const root = await createTempDirectory()
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const currentVersion = '3.5.0-alpha.0'
    const targetVersion = '3.5.0-alpha.1'
    const executable = joinPath(root, platform === 'windows' ? 'mirror.exe' : 'mirror')
    const target = joinPath(root, platform === 'windows' ? 'target.exe' : 'target')
    await compileVersionFixture(root, 'current.ts', executable, `console.log('${currentVersion}')`)
    await compileVersionFixture(root, 'target.ts', target, `console.log('${targetVersion}')`)
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    let releaseDownload: () => void = () => undefined
    const downloadGate = new Promise<void>((resolve) => { releaseDownload = resolve })
    let serverUrl = ''
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/repos/')) {
          return Response.json({
            tag_name: `@guiho/mirror@${targetVersion}`,
            html_url: `${serverUrl}/release`,
            published_at: '2026-07-18T00:00:00Z',
            draft: false,
            prerelease: false,
            assets: [{ name: asset, browser_download_url: `${serverUrl}/asset` }],
          })
        }
        return new Response(new ReadableStream<Uint8Array>({
          async start(controller) {
            await downloadGate
            controller.enqueue(await Bun.file(target).bytes())
            controller.close()
          },
        }))
      },
    })
    serverUrl = server.url.toString().replace(/\/$/, '')
    const process = Bun.spawn(['bun', joinPath(import.meta.dir, 'guiho-mirror-bin.ts'), 'upgrade', '--version', targetVersion], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...globalThis.process.env,
        MIRROR_SELF_PATH: executable,
        MIRROR_GITHUB_API_URL: serverUrl,
        MIRROR_DISABLE_UPDATE_CHECK: '1',
      },
    })
    const reader = process.stdout.getReader()
    const decoder = new TextDecoder()
    let output = ''
    try {
      await Promise.race([
        readUntil(reader, decoder, () => output, (value) => { output = value }, 'Downloading...'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for pre-download output')), 10_000)),
      ])
      expect(output).toContain(`Target Version: v${targetVersion}`)
      expect(output).toContain(`Source URL:     ${serverUrl}/asset`)
      expect(output).not.toContain('Replacing...')
      releaseDownload()
      output = await readRemaining(reader, decoder, output)
      const [exitCode, stderr] = await Promise.all([process.exited, process.stderr.text()])
      expect(exitCode).toBe(0)
      expect(stderr).toBe('')
      expect(output.indexOf('Downloading...')).toBeLessThan(output.indexOf('Replacing...'))
      expect(output.indexOf('Replacing...')).toBeLessThan(output.indexOf('Verifying...'))
      expect(output).toContain(`install Mirror ${targetVersion} directly`)
    } finally {
      releaseDownload()
      server.stop(true)
    }
  }, 30_000)

  test('replaces a running Windows canonical executable before the old process exits', async () => {
    if (detectNativePlatform() !== 'windows') return
    const root = await createTempDirectory()
    const currentVersion = '3.4.1'
    const targetVersion = '3.4.2'
    const executable = joinPath(root, 'mirror.exe')
    const target = joinPath(root, 'target.exe')
    const modulePath = joinPath(import.meta.dir, 'self-management.ts').replaceAll('\\', '/')
    await compileVersionFixture(root, 'target.ts', target, `console.log('${targetVersion}')`)
    await compileVersionFixture(root, 'running-upgrader.ts', executable, `
import { executeUpgrade, resolveUpgradePlan } from ${JSON.stringify(modulePath)}
if (process.argv.includes('--version')) {
  console.log('${currentVersion}')
} else {
  const apiBaseUrl = process.argv[2]
  const cacheDir = process.argv[3]
  const plan = await resolveUpgradePlan({
    version: '${targetVersion}',
    currentVersion: '${currentVersion}',
    executablePath: process.execPath,
    platform: 'windows',
    arch: process.arch,
    apiBaseUrl,
  })
  const result = await executeUpgrade(plan, { cacheDir })
  console.log(JSON.stringify(result))
  if (result.outcome !== 'upgraded') process.exitCode = 1
}
`)
    const asset = buildAssetCandidates('windows', detectNativeArch(), 'baseline')[0]!
    let serverUrl = ''
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        if (url.pathname.startsWith('/repos/')) {
          return Response.json({
            tag_name: `@guiho/mirror@${targetVersion}`,
            html_url: `${serverUrl}/release`,
            published_at: '2026-07-18T00:00:00Z',
            draft: false,
            prerelease: false,
            assets: [{ name: asset, browser_download_url: `${serverUrl}/asset` }],
          })
        }
        return new Response(Bun.file(target))
      },
    })
    serverUrl = server.url.toString().replace(/\/$/, '')
    try {
      const upgrade = await runCommand([executable, serverUrl, root])
      expect(upgrade.exitCode).toBe(0)
      expect(JSON.parse(upgrade.stdout) as { outcome: string }).toMatchObject({ outcome: 'upgraded' })
      expect((await runCommand([executable, '--version'])).stdout.trim()).toBe(targetVersion)
    } finally {
      server.stop(true)
    }
  }, 90_000)
})

async function createTempDirectory() {
  const root = joinPath(process.env['TEMP'] ?? process.env['TMP'] ?? '/tmp', `mirror-self-management-${crypto.randomUUID()}`)
  await ensureDirectory(root)
  temporaryDirectories.push(root)
  return root
}

async function compileVersionFixture(root: string, sourceName: string, outfile: string, source: string) {
  const sourcePath = joinPath(root, sourceName)
  await writeTextFile(sourcePath, `${source}\n`)
  const result = await runCommand(['bun', 'build', sourcePath, '--compile', '--outfile', outfile])
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout)
}

function releaseFetch(version: string, asset: string) {
  return (async () => Response.json(release(`@guiho/mirror@${version}`, '2026-07-15T00:00:00Z', asset))) as unknown as typeof fetch
}

function release(tag: string, publishedAt: string, asset?: string) {
  return {
    tag_name: tag,
    html_url: `https://example.test/releases/${encodeURIComponent(tag)}`,
    published_at: publishedAt,
    draft: false,
    prerelease: tag.includes('-'),
    assets: asset ? [{ name: asset, browser_download_url: `https://example.test/assets/${asset}` }] : [],
  }
}

async function readUntil(
  reader: { read(): Promise<{ done: boolean, value?: Uint8Array }> },
  decoder: TextDecoder,
  getOutput: () => string,
  setOutput: (value: string) => void,
  needle: string,
) {
  while (!getOutput().includes(needle)) {
    const chunk = await reader.read()
    if (chunk.done) throw new Error(`Process exited before printing ${needle}`)
    setOutput(`${getOutput()}${decoder.decode(chunk.value, { stream: true })}`)
  }
}

async function readRemaining(reader: { read(): Promise<{ done: boolean, value?: Uint8Array }> }, decoder: TextDecoder, initial: string) {
  let output = initial
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) return `${output}${decoder.decode()}`
    output += decoder.decode(chunk.value, { stream: true })
  }
}

async function waitFor(predicate: () => boolean, timeoutMilliseconds = 2_000) {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMilliseconds) throw new Error('Timed out waiting for condition')
    await Bun.sleep(10)
  }
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
