/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { buildAssetCandidates, createUpgradeRecovery, detectNativeArch, detectNativePlatform } from './self-management.js'
import { joinPath } from './path.js'
import { ensureDirectory, readTextFile, removePath, runCommand, runShellCommand, writeTextFile } from './runtime.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => removePath(path).catch(() => undefined)))
})

describe('Mirror canonical installers', () => {
  test('keeps PowerShell and POSIX candidate order aligned with the upgrade domain', async () => {
    const powershell = await readTextFile(joinPath(import.meta.dir, '..', 'install.ps1'))
    const posix = await readTextFile(joinPath(import.meta.dir, '..', 'install.sh'))
    for (const platform of ['windows', 'linux', 'darwin'] as const) {
      for (const variant of ['baseline', 'default', 'modern'] as const) {
        const candidates = buildAssetCandidates(platform, 'x64', variant).map((candidate) => platform === 'windows' ? candidate : candidate.replace(`mirror-${platform}-`, 'mirror-${os}-'))
        const script = platform === 'windows' ? powershell : posix
        const candidateLine = script.split(/\r?\n/).find((line) => platform === 'windows' ? line.includes(`'${variant}' {`) : line.trimStart().startsWith(`${variant})`)) ?? ''
        const positions = candidates.map((candidate) => candidateLine.indexOf(candidate))
        expect(positions.every((position) => position >= 0)).toBe(true)
        expect(positions).toEqual([...positions].sort((left, right) => left - right))
      }
    }
  })

  test('installs and verifies an exact published version transactionally', async () => {
    const fixture = await createInstallerFixture('3.4.1', '3.4.2', { kind: 'version', version: '3.4.2' })
    try {
      const result = await runInstaller(fixture, '3.4.2')
      if (result.exitCode !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
      expect(result.exitCode).toBe(0)
      expect(result.stdout.indexOf('Downloading...')).toBeGreaterThan(result.stdout.indexOf('  url     :'))
      expect(result.stdout.indexOf('Replacing...')).toBeGreaterThan(result.stdout.indexOf('Validating...'))
      expect(result.stdout.indexOf('Installed Mirror 3.4.2')).toBeGreaterThan(result.stdout.indexOf('Verifying...'))
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.2')
      if (detectNativePlatform() !== 'windows') {
        const permission = await runCommand(['test', '-x', fixture.destination])
        expect(permission.exitCode).toBe(0)
      }
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('restores the previous executable when installed verification fails', async () => {
    const targetVersion = '3.4.2'
    const fixture = await createInstallerFixture(
      '3.4.1',
      targetVersion,
      { kind: 'candidate-canonical-version', candidateVersion: targetVersion, canonicalVersion: '9.9.9' },
    )
    try {
      const result = await runInstaller(fixture, targetVersion)
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).toContain('expected 3.4.2')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
      const preserved = await Array.fromAsync(new Bun.Glob('.mirror-failed-*').scan({ cwd: fixture.installDir, dot: true }))
      expect(preserved.length).toBe(1)
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('executes the printed recovery command for an exact prerelease', async () => {
    const targetVersion = '3.5.0-alpha.1'
    const fixture = await createInstallerFixture('3.4.2', targetVersion, { kind: 'version', version: targetVersion })
    const previousScriptUrl = process.env['MIRROR_INSTALL_SCRIPT_URL']
    try {
      process.env['MIRROR_INSTALL_SCRIPT_URL'] = fixture.scriptUrl
      const platform = detectNativePlatform()
      const recovery = createUpgradeRecovery(targetVersion, 'resolved', platform)
      expect(recovery.installCommand).toContain(targetVersion)
      const result = platform === 'windows'
        ? await runCommand(['powershell.exe', '-NoProfile', '-Command', recovery.installCommand], { cwd: fixture.root, env: installerEnvironment(fixture) })
        : await runShellCommand(recovery.installCommand, { cwd: fixture.root, env: installerEnvironment(fixture) })
      if (result.exitCode !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
      expect(result.exitCode).toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).toContain(`Installed Mirror ${targetVersion}`)
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe(targetVersion)
    } finally {
      if (previousScriptUrl === undefined) delete process.env['MIRROR_INSTALL_SCRIPT_URL']
      else process.env['MIRROR_INSTALL_SCRIPT_URL'] = previousScriptUrl
      fixture.server.stop(true)
    }
  }, 60_000)

  test('falls back only after the first compatible candidate returns HTTP 404', async () => {
    const fixture = await createInstallerFixture('3.4.1', '3.4.2', { kind: 'version', version: '3.4.2' }, { firstCandidateMissing: true })
    try {
      const result = await runInstaller(fixture, '3.4.2')
      if (result.exitCode !== 0) throw new Error(`${result.stdout}\n${result.stderr}`)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('is not published; trying the next compatible asset')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.2')
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('rejects a PowerShell exact-version response whose release tag does not match', async () => {
    if (detectNativePlatform() !== 'windows') return
    const fixture = await createInstallerFixture('3.4.1', '3.4.2', { kind: 'version', version: '3.4.2' }, { returnedVersion: '9.9.9' })
    try {
      const result = await runInstaller(fixture, '3.4.2')
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).toContain('Requested Mirror 3.4.2')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('requires version stdout to contain only the exact semantic version', async () => {
    const fixture = await createInstallerFixture('3.4.1', '3.4.2', { kind: 'version', version: 'Mirror 3.4.2' })
    try {
      const result = await runInstaller(fixture, '3.4.2')
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).toContain('expected 3.4.2')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('rejects numeric prerelease identifiers with leading zeroes before installation', async () => {
    const fixture = await createInstallerFixture('3.4.1', '3.5.0-alpha.1', { kind: 'version', version: '3.5.0-alpha.1' })
    try {
      const result = await runInstaller(fixture, '3.5.0-alpha.01')
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`.toLowerCase()).toContain('invalid mirror semantic version')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('times out a hanging downloaded binary and preserves the installed executable', async () => {
    const fixture = await createInstallerFixture('3.4.1', '3.4.2', { kind: 'hang' })
    try {
      const result = await runInstaller(fixture, '3.4.2', { MIRROR_VERIFY_TIMEOUT_SECONDS: '1' })
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`.toLowerCase()).toContain('timed out')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)

  test('rolls back and preserves the failed artifact when canonical verification times out', async () => {
    const targetVersion = '3.4.2'
    const fixture = await createInstallerFixture(
      '3.4.1',
      targetVersion,
      { kind: 'candidate-version-canonical-hang', candidateVersion: targetVersion },
    )
    try {
      const result = await runInstaller(fixture, targetVersion, { MIRROR_VERIFY_TIMEOUT_SECONDS: '1' })
      expect(result.exitCode).not.toBe(0)
      expect(`${result.stdout}\n${result.stderr}`.toLowerCase()).toContain('timed out')
      expect((await runCommand([fixture.destination, '--version'])).stdout.trim()).toBe('3.4.1')
      const preserved = await Array.fromAsync(new Bun.Glob('.mirror-failed-*').scan({ cwd: fixture.installDir, dot: true }))
      expect(preserved.length).toBe(1)
    } finally {
      fixture.server.stop(true)
    }
  }, 60_000)
})

type InstallerFixture = {
  root: string
  installDir: string
  destination: string
  scriptUrl: string
  server: ReturnType<typeof Bun.serve>
}

type FixtureProgram =
  | { kind: 'version', version: string }
  | { kind: 'hang' }
  | { kind: 'candidate-canonical-version', candidateVersion: string, canonicalVersion: string }
  | { kind: 'candidate-version-canonical-hang', candidateVersion: string }

async function createInstallerFixture(
  currentVersion: string,
  targetVersion: string,
  targetProgram: FixtureProgram,
  options: { firstCandidateMissing?: boolean, returnedVersion?: string } = {},
): Promise<InstallerFixture> {
  const root = joinPath(process.env['TEMP'] ?? process.env['TMP'] ?? '/tmp', `mirror-installer-${crypto.randomUUID()}`)
  const installDir = joinPath(root, 'bin')
  await ensureDirectory(installDir)
  temporaryDirectories.push(root)
  const platform = detectNativePlatform()
  const extension = platform === 'windows' ? '.exe' : ''
  const destination = joinPath(installDir, `mirror${extension}`)
  const candidate = joinPath(root, `candidate${extension}`)
  await compileFixture(root, 'current', destination, { kind: 'version', version: currentVersion })
  await compileFixture(root, 'target', candidate, targetProgram)
  const assets = buildAssetCandidates(platform, detectNativeArch(), 'baseline')
  const asset = assets[0]!
  const fallbackAsset = assets[1] ?? asset
  let serverUrl = ''
  const server = Bun.serve({
    port: 0,
    idleTimeout: 120,
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/install.ps1') return new Response(Bun.file(joinPath(import.meta.dir, '..', 'install.ps1')))
      if (url.pathname === '/install.sh') return new Response(Bun.file(joinPath(import.meta.dir, '..', 'install.sh')))
      if (url.pathname.startsWith('/repos/')) {
        const releaseAssets = options.firstCandidateMissing
          ? [asset, fallbackAsset].map((name) => ({ name, browser_download_url: `${serverUrl}/assets/${name}` }))
          : [{ name: asset, browser_download_url: `${serverUrl}/assets/${asset}` }]
        releaseAssets.push(
          { name: 'guiho-s-mirror', browser_download_url: `${serverUrl}/assets/guiho-s-mirror` },
          { name: 'guiho-i-mirror', browser_download_url: `${serverUrl}/assets/guiho-i-mirror` },
        )
        return Response.json({
          tag_name: `@guiho/mirror@${options.returnedVersion ?? targetVersion}`,
          html_url: `${serverUrl}/release`,
          assets: releaseAssets,
        })
      }
      if (options.firstCandidateMissing && url.pathname.endsWith(`/${asset}`)) return new Response('missing', { status: 404 })
      if (url.pathname.endsWith('/guiho-s-mirror')) return new Response('---\nname: guiho-s-mirror\n---\n# Mirror\n')
      if (url.pathname.endsWith('/guiho-i-mirror')) return new Response('# Mirror Release\n')
      if (url.pathname.endsWith(`/${fallbackAsset}`)) return new Response(Bun.file(candidate))
      return new Response(Bun.file(candidate))
    },
  })
  serverUrl = server.url.toString().replace(/\/$/, '')
  return { root, installDir, destination, scriptUrl: `${serverUrl}/install.${platform === 'windows' ? 'ps1' : 'sh'}`, server }
}

async function runInstaller(fixture: InstallerFixture, version: string, extraEnv: Record<string, string> = {}) {
  const platform = detectNativePlatform()
  if (platform === 'windows') {
    return runCommand([
      'powershell.exe',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      joinPath(import.meta.dir, '..', 'install.ps1'),
      '-Version',
      version,
      '-InstallDir',
      fixture.installDir,
      '-ApiBaseUrl',
      fixture.server.url.toString().replace(/\/$/, ''),
      '-NoPathUpdate',
    ], { cwd: fixture.root, env: installerEnvironment(fixture, extraEnv) })
  }

  return runCommand(['bash', joinPath(import.meta.dir, '..', 'install.sh'), '--version', version, '--install-dir', fixture.installDir], {
    cwd: fixture.root,
    env: installerEnvironment(fixture, extraEnv),
  })
}

function installerEnvironment(fixture: InstallerFixture, extraEnv: Record<string, string> = {}) {
  const serverUrl = fixture.server.url.toString().replace(/\/$/, '')
  return {
    MIRROR_GITHUB_API_URL: serverUrl,
    MIRROR_RELEASE_BASE_URL: `${serverUrl}/releases/download`,
    MIRROR_INSTALL_DIR: fixture.installDir,
    HOME: fixture.root,
    USERPROFILE: fixture.root,
    MIRROR_NO_PATH_UPDATE: '1',
    MIRROR_ALLOW_INSECURE_TEST_URLS: '1',
    ...extraEnv,
  }
}

async function compileFixture(root: string, sourceName: string, outfile: string, program: FixtureProgram) {
  if (detectNativePlatform() === 'windows') {
    const sourcePath = joinPath(root, `${sourceName}.cs`)
    await writeTextFile(sourcePath, createWindowsFixtureSource(program))
    const windowsDirectory = process.env['WINDIR'] ?? 'C:\\Windows'
    const compiler = joinPath(windowsDirectory, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
    const nativeOutfile = outfile.replaceAll('/', '\\')
    const nativeSourcePath = sourcePath.replaceAll('/', '\\')
    const result = await runCommand([compiler, '/nologo', '/target:exe', `/out:${nativeOutfile}`, nativeSourcePath])
    if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout)
    return
  }

  const sourcePath = joinPath(root, `${sourceName}.ts`)
  await writeTextFile(sourcePath, `${createPosixFixtureSource(program)}\n`)
  const result = await runCommand(['bun', 'build', sourcePath, '--compile', '--outfile', outfile])
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout)
}

function createPosixFixtureSource(program: FixtureProgram) {
  switch (program.kind) {
    case 'version':
      return `console.log(${JSON.stringify(program.version)})`
    case 'hang':
      return 'setInterval(() => undefined, 1_000)'
    case 'candidate-canonical-version':
      return `console.log(process.execPath.includes('.mirror-install-') ? ${JSON.stringify(program.candidateVersion)} : ${JSON.stringify(program.canonicalVersion)})`
    case 'candidate-version-canonical-hang':
      return `if (process.execPath.includes('.mirror-install-')) console.log(${JSON.stringify(program.candidateVersion)}); else setInterval(() => undefined, 1_000)`
  }
}

function createWindowsFixtureSource(program: FixtureProgram) {
  const candidateCheck = "Environment.GetCommandLineArgs()[0].IndexOf(\".mirror-install-\", StringComparison.OrdinalIgnoreCase) >= 0"
  let body: string
  switch (program.kind) {
    case 'version':
      body = `Console.WriteLine(${toCSharpString(program.version)});`
      break
    case 'hang':
      body = 'Thread.Sleep(Timeout.Infinite);'
      break
    case 'candidate-canonical-version':
      body = `Console.WriteLine(${candidateCheck} ? ${toCSharpString(program.candidateVersion)} : ${toCSharpString(program.canonicalVersion)});`
      break
    case 'candidate-version-canonical-hang':
      body = `if (${candidateCheck}) Console.WriteLine(${toCSharpString(program.candidateVersion)}); else Thread.Sleep(Timeout.Infinite);`
      break
  }
  return `using System;
using System.Threading;
public static class Program {
  public static void Main(string[] args) {
    ${body}
  }
}
`
}

function toCSharpString(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
