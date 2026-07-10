/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import packageJson from '../package.json' with { type: 'json' }
import type { MirrorNativeArch, MirrorNativePlatform, MirrorNativeVariant, MirrorUninstallResult, MirrorUpdateCache, MirrorUpgradeResult } from './types.js'
import { MirrorError } from './errors.js'
import { dirnamePath, joinPath, resolvePath } from './path.js'
import { fileExists, removePath, writeTextFile } from './runtime.js'

export {
  checkForLatestVersion,
  detectNativeArch,
  detectNativePlatform,
  listAvailableVersions,
  readUpdateCache,
  resolveCachePath,
  resolveExecutablePath,
  runBackgroundUpdateCheck,
  scheduleBackgroundUpdateCheck,
  uninstallSelf,
  upgradeSelf,
}

const defaultRepo = 'CGuiho/mirror'
const cacheTtlMilliseconds = 4 * 60 * 60 * 1000
const currentMirrorVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

type GitHubRelease = {
  tag_name?: string
  html_url?: string
}

type SelfManagementOptions = {
  repo?: string
  cacheDir?: string
  executablePath?: string
}

type UpgradeOptions = SelfManagementOptions & {
  version?: string
  arch?: string
  variant?: string
  dryRun?: boolean
}

type UninstallOptions = SelfManagementOptions & {
  dryRun?: boolean
}

async function readUpdateCache(options: SelfManagementOptions = {}): Promise<MirrorUpdateCache | null> {
  try {
    const parsed = await Bun.file(resolveCachePath(options)).json() as Partial<MirrorUpdateCache>
    if (!parsed.checkedAt || !parsed.currentVersion || !parsed.latestVersion || typeof parsed.updateAvailable !== 'boolean') return null
    return {
      checkedAt: parsed.checkedAt,
      currentVersion: parsed.currentVersion,
      latestVersion: parsed.latestVersion,
      updateAvailable: parsed.updateAvailable,
      releaseUrl: parsed.releaseUrl ?? '',
    }
  } catch {
    return null
  }
}

async function writeUpdateCache(cache: MirrorUpdateCache, options: SelfManagementOptions = {}) {
  const path = resolveCachePath(options)
  await writeTextFile(path, `${JSON.stringify(cache, null, 2)}\n`)
}

function resolveCachePath(options: SelfManagementOptions = {}) {
  const root = options.cacheDir ?? process.env['MIRROR_CACHE_DIR'] ?? defaultCacheDirectory()
  return joinPath(root, 'update.json')
}

async function checkForLatestVersion(options: SelfManagementOptions = {}) {
  const latest = await fetchLatestRelease(options.repo)
  const latestVersion = normalizeVersion(latest.version)
  const cache: MirrorUpdateCache = {
    checkedAt: new Date().toISOString(),
    currentVersion: currentMirrorVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentMirrorVersion) > 0,
    releaseUrl: latest.url,
  }
  await writeUpdateCache(cache, options)
  return cache
}

async function runBackgroundUpdateCheck(options: SelfManagementOptions = {}) {
  await checkForLatestVersion(options)
}

async function scheduleBackgroundUpdateCheck(options: SelfManagementOptions = {}) {
  if (process.env['MIRROR_DISABLE_UPDATE_CHECK'] === '1') return false
  const cache = await readUpdateCache(options)
  if (cache && Date.now() - Date.parse(cache.checkedAt) < cacheTtlMilliseconds) return false
  if (await isSourceCheckout()) return false

  try {
    const proc = Bun.spawn([resolveExecutablePath(options), '--mirror-update-check-worker'], {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
      env: { ...process.env, MIRROR_BACKGROUND_UPDATE_CHECK: '1' },
    })
    ;(proc as unknown as { unref?: () => void }).unref?.()
    return true
  } catch {
    return false
  }
}

async function upgradeSelf(options: UpgradeOptions = {}): Promise<MirrorUpgradeResult> {
  const executablePath = resolveExecutablePath(options)
  await assertNativeInstall(executablePath, 'upgrade')
  const targetVersion = options.version ? normalizeVersion(options.version) : (await fetchLatestRelease(options.repo)).version
  const platform = detectNativePlatform()
  const arch = detectNativeArch(options.arch)
  const variant = parseVariant(options.variant)
  const candidates = buildAssetCandidates(platform, arch, variant)

  let lastStatus = ''
  for (const asset of candidates) {
    const url = buildDownloadUrl(asset, targetVersion, options.repo)
    const temporaryPath = joinPath(dirnamePath(executablePath), `.mirror-upgrade-${process.pid}-${asset}`)

    if (options.dryRun) return { currentVersion: currentMirrorVersion, targetVersion, asset, url, executablePath, dryRun: true, scheduled: false }

    const response = await fetch(url)
    if (!response.ok) {
      lastStatus = `${response.status} ${response.statusText}`
      continue
    }

    await Bun.write(temporaryPath, response)
    if (!(await isNativeBinary(temporaryPath, platform))) {
      await removePath(temporaryPath)
      lastStatus = 'download was not a native binary'
      continue
    }

    await writeUpdateCache({
      checkedAt: new Date().toISOString(),
      currentVersion: targetVersion,
      latestVersion: targetVersion,
      updateAvailable: false,
      releaseUrl: `https://github.com/${options.repo ?? process.env['MIRROR_REPO'] ?? defaultRepo}/releases/tag/${encodeURIComponent(`@guiho/mirror@${targetVersion}`)}`,
    }, options)

    if (platform === 'windows') {
      await scheduleWindowsReplacement(temporaryPath, executablePath)
      return { currentVersion: currentMirrorVersion, targetVersion, asset, url, executablePath, dryRun: false, scheduled: true }
    }

    await runChecked(['chmod', '755', temporaryPath])
    await runChecked(['mv', temporaryPath, executablePath])
    return { currentVersion: currentMirrorVersion, targetVersion, asset, url, executablePath, dryRun: false, scheduled: false }
  }

  throw new MirrorError(`No compatible Mirror binary found for ${platform}/${arch}. Last status: ${lastStatus || 'unknown'}`)
}

async function uninstallSelf(options: UninstallOptions = {}): Promise<MirrorUninstallResult> {
  const executablePath = resolveExecutablePath(options)
  await assertNativeInstall(executablePath, 'uninstall')
  if (options.dryRun) return { executablePath, dryRun: true, scheduled: false }

  if (detectNativePlatform() === 'windows') {
    await scheduleWindowsRemoval(executablePath)
    return { executablePath, dryRun: false, scheduled: true }
  }

  await removePath(executablePath)
  return { executablePath, dryRun: false, scheduled: false }
}

async function listAvailableVersions(options: SelfManagementOptions = {}) {
  const repo = options.repo ?? process.env['MIRROR_REPO'] ?? defaultRepo
  const response = await fetch(`https://api.github.com/repos/${repo}/releases`, {
    headers: { 'User-Agent': 'mirror-cli' },
  })
  if (!response.ok) throw new MirrorError(`Failed to fetch Mirror releases: ${response.status} ${response.statusText}`)
  const releases = await response.json() as GitHubRelease[]
  return releases.map((release) => release.tag_name).filter((tag): tag is string => typeof tag === 'string').map(normalizeVersion)
}

function resolveExecutablePath(options: SelfManagementOptions = {}) {
  return resolvePath(options.executablePath ?? process.env['MIRROR_SELF_PATH'] ?? process.execPath)
}

function detectNativePlatform(): MirrorNativePlatform {
  if (process.platform === 'linux') return 'linux'
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'
  throw new MirrorError(`Unsupported OS: ${process.platform}`)
}

function detectNativeArch(value: string = process.arch): MirrorNativeArch {
  if (value === 'x64') return 'x64'
  if (value === 'arm64') return 'arm64'
  throw new MirrorError(`Unsupported architecture: ${value}`)
}

function buildAssetCandidates(platform: MirrorNativePlatform, arch: MirrorNativeArch, variant: MirrorNativeVariant) {
  const extension = platform === 'windows' ? '.exe' : ''
  if (arch === 'arm64') return [`guiho-mirror-${platform}-arm64${extension}`]
  if (variant === 'modern') return [`guiho-mirror-${platform}-x64-modern${extension}`, `guiho-mirror-${platform}-x64${extension}`, `guiho-mirror-${platform}-x64-baseline${extension}`]
  if (variant === 'default') return [`guiho-mirror-${platform}-x64${extension}`, `guiho-mirror-${platform}-x64-baseline${extension}`, `guiho-mirror-${platform}-x64-modern${extension}`]
  return [`guiho-mirror-${platform}-x64-baseline${extension}`, `guiho-mirror-${platform}-x64${extension}`, `guiho-mirror-${platform}-x64-modern${extension}`]
}

function parseVariant(value: string | undefined): MirrorNativeVariant {
  if (!value) return 'baseline'
  if (value === 'baseline' || value === 'default' || value === 'modern') return value
  throw new MirrorError(`Invalid --variant value: ${value}. Expected baseline, default, or modern.`)
}

function buildDownloadUrl(asset: string, version: string, repo?: string) {
  const resolvedRepo = repo ?? process.env['MIRROR_REPO'] ?? defaultRepo
  if (version === 'latest') return `https://github.com/${resolvedRepo}/releases/latest/download/${asset}`
  const tag = encodeURIComponent(version.startsWith('@') ? version : `@guiho/mirror@${version}`)
  return `https://github.com/${resolvedRepo}/releases/download/${tag}/${asset}`
}

function normalizeVersion(version: string) {
  return version.replace(/^@guiho\/mirror@/, '').replace(/^v/, '')
}

function compareVersions(a: string, b: string) {
  const left = normalizeVersion(a).split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const right = normalizeVersion(b).split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function fetchLatestRelease(repo?: string) {
  const resolvedRepo = repo ?? process.env['MIRROR_REPO'] ?? defaultRepo
  const response = await fetch(`https://api.github.com/repos/${resolvedRepo}/releases/latest`, {
    headers: { 'User-Agent': 'mirror-cli' },
  })
  if (!response.ok) throw new MirrorError(`Failed to fetch latest Mirror release: ${response.status} ${response.statusText}`)
  const release = await response.json() as GitHubRelease
  if (!release.tag_name) throw new MirrorError('Latest Mirror release did not include a tag name')
  return { version: normalizeVersion(release.tag_name), url: release.html_url ?? `https://github.com/${resolvedRepo}/releases/latest` }
}

async function isNativeBinary(path: string, platform: MirrorNativePlatform) {
  const bytes = new Uint8Array(await Bun.file(path).slice(0, 4).arrayBuffer())
  if (platform === 'windows') return bytes[0] === 0x4d && bytes[1] === 0x5a
  if (platform === 'linux') return bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46
  return [
    [0xcf, 0xfa, 0xed, 0xfe],
    [0xce, 0xfa, 0xed, 0xfe],
    [0xfe, 0xed, 0xfa, 0xcf],
    [0xfe, 0xed, 0xfa, 0xce],
    [0xca, 0xfe, 0xba, 0xbe],
    [0xbe, 0xba, 0xfe, 0xca],
  ].some((magic) => magic.every((value, index) => bytes[index] === value))
}

async function assertNativeInstall(executablePath: string, action: string) {
  if (process.env['MIRROR_SELF_PATH']) return
  if (await isSourceCheckout()) throw new MirrorError(`mirror ${action} is only available from an installed native Mirror binary.`)
  if (!(await fileExists(executablePath))) throw new MirrorError(`Cannot find current Mirror executable at ${executablePath}`)
}

async function isSourceCheckout() {
  return Bun.file(new URL('../source/guiho-mirror-bin.ts', import.meta.url)).exists()
}

async function scheduleWindowsReplacement(source: string, destination: string) {
  const scriptPath = joinPath(dirnamePath(source), `.mirror-upgrade-${process.pid}.ps1`)
  const script = [
    `$pidToWait = ${process.pid}`,
    'Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue',
    `Move-Item -LiteralPath ${quotePowerShell(source)} -Destination ${quotePowerShell(destination)} -Force`,
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force',
  ].join('\n')
  await writeTextFile(scriptPath, script)
  const proc = Bun.spawn(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  ;(proc as unknown as { unref?: () => void }).unref?.()
}

async function scheduleWindowsRemoval(path: string) {
  const scriptPath = joinPath(dirnamePath(path), `.mirror-uninstall-${process.pid}.ps1`)
  const script = [
    `$pidToWait = ${process.pid}`,
    'Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue',
    `Remove-Item -LiteralPath ${quotePowerShell(path)} -Force`,
    'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force',
  ].join('\n')
  await writeTextFile(scriptPath, script)
  const proc = Bun.spawn(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  ;(proc as unknown as { unref?: () => void }).unref?.()
}

async function runChecked(command: string[]) {
  const proc = Bun.spawn(command, { stdout: 'ignore', stderr: 'pipe' })
  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited])
  if (exitCode !== 0) throw new MirrorError(`${command.join(' ')} failed${stderr.trim() ? `\n${stderr.trim()}` : ''}`)
}

function quotePowerShell(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function defaultCacheDirectory() {
  if (process.platform === 'win32') return joinPath(process.env['LOCALAPPDATA'] ?? process.env['USERPROFILE'] ?? '.', 'mirror')
  return joinPath(process.env['XDG_CACHE_HOME'] ?? joinPath(process.env['HOME'] ?? '.', '.cache'), 'mirror')
}
