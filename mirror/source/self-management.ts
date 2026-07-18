/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
 */

import { compare, gt, parse, rcompare, valid } from 'semver'
import packageJson from '../package.json' with { type: 'json' }

import type {
  MirrorAvailableRelease,
  MirrorNativeArch,
  MirrorNativePlatform,
  MirrorNativeVariant,
  MirrorReleaseCatalog,
  MirrorUninstallResult,
  MirrorUpdateCache,
  MirrorUpgradeEvent,
  MirrorUpgradeFailureCode,
  MirrorUpgradePhase,
  MirrorUpgradePlan,
  MirrorUpgradeRecovery,
  MirrorUpgradeResult,
} from './types.js'

import { MirrorError } from './errors.js'
import { basenamePath, dirnamePath, joinPath, resolvePath } from './path.js'
import { ensureDirectory, fileExists, removePath, runCommand, writeTextFile } from './runtime.js'

export {
  buildAssetCandidates,
  checkForLatestVersion,
  createUpgradeRecovery,
  createUpgradeResolutionFailure,
  detectNativeArch,
  detectNativePlatform,
  executeUpgrade,
  listAvailableVersions,
  normalizeMirrorVersion,
  readUpdateCache,
  resolveCachePath,
  resolveExecutablePath,
  resolveUpgradePlan,
  runBackgroundUpdateCheck,
  scheduleBackgroundUpdateCheck,
  uninstallSelf,
  upgradeSelf,
}

const defaultRepo = 'CGuiho/mirror'
const defaultApiBaseUrl = 'https://api.github.com'
const cacheTtlMilliseconds = 4 * 60 * 60 * 1000
const currentMirrorVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

type GitHubReleaseAsset = {
  name?: string
  browser_download_url?: string
}

type GitHubRelease = {
  tag_name?: string
  html_url?: string
  published_at?: string
  draft?: boolean
  prerelease?: boolean
  assets?: GitHubReleaseAsset[]
}

type SelfManagementOptions = {
  repo?: string
  apiBaseUrl?: string
  cacheDir?: string
  executablePath?: string
  currentVersion?: string
  platform?: MirrorNativePlatform
  arch?: string
  variant?: string
  fetch?: typeof fetch
}

type UpgradeOptions = SelfManagementOptions & {
  version?: string
  dryRun?: boolean
}

type UpgradeExecutionOptions = {
  fetch?: typeof fetch
  cacheDir?: string
  onEvent?: (event: MirrorUpgradeEvent) => void
}

type UninstallOptions = SelfManagementOptions & {
  dryRun?: boolean
}

class MirrorUpgradeError extends MirrorError {
  readonly code: MirrorUpgradeFailureCode

  constructor(code: MirrorUpgradeFailureCode, message: string) {
    super(message)
    this.code = code
  }
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
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
  await ensureDirectory(dirnamePath(path))
  await writeTextFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`)
  try {
    await movePath(temporaryPath, path)
  } catch (error) {
    await removePath(temporaryPath).catch(() => undefined)
    throw error
  }
}

function resolveCachePath(options: SelfManagementOptions = {}) {
  const root = options.cacheDir ?? process.env['MIRROR_CACHE_DIR'] ?? defaultCacheDirectory()
  return joinPath(root, 'update.json')
}

async function checkForLatestVersion(options: SelfManagementOptions = {}) {
  const release = await fetchLatestRelease(options)
  const latestVersion = normalizeMirrorVersion(requireReleaseTag(release))
  const currentVersion = resolveCurrentVersion(options)
  const cache: MirrorUpdateCache = {
    checkedAt: new Date().toISOString(),
    currentVersion,
    latestVersion,
    updateAvailable: gt(latestVersion, currentVersion),
    releaseUrl: release.html_url ?? releaseUrl(options, requireReleaseTag(release)),
  }
  await writeUpdateCache(cache, options)
  return cache
}

async function runBackgroundUpdateCheck(options: SelfManagementOptions = {}) {
  if (process.env['MIRROR_DISABLE_UPDATE_CHECK'] === '1') return
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

async function resolveUpgradePlan(options: UpgradeOptions = {}): Promise<MirrorUpgradePlan> {
  const executablePath = resolveExecutablePath(options)
  if (options.executablePath) {
    if (!(await fileExists(executablePath))) throw new MirrorError(`Cannot find current Mirror executable at ${executablePath}`)
  } else {
    await assertNativeInstall(executablePath, 'upgrade')
  }

  const currentVersion = resolveCurrentVersion(options)
  const platform = options.platform ?? detectNativePlatform()
  const arch = detectNativeArch(options.arch)
  const variant = parseVariant(options.variant)
  const requestedVersion = options.version ? normalizeMirrorVersion(options.version) : null
  const release = requestedVersion
    ? await fetchReleaseByVersion(requestedVersion, options)
    : await fetchLatestRelease(options)
  const targetTag = requireReleaseTag(release)
  const targetVersion = normalizeMirrorReleaseTag(targetTag)
  if (requestedVersion && targetVersion !== requestedVersion) {
    throw new MirrorUpgradeError(
      'UPGRADE_RESOLUTION_FAILED',
      `Requested Mirror ${requestedVersion}, but release metadata returned ${targetTag}.`,
    )
  }
  const candidates = buildAssetCandidates(platform, arch, variant)
  const selected = candidates
    .map((candidate) => release.assets?.find((asset) => asset.name === candidate))
    .find((asset): asset is GitHubReleaseAsset => Boolean(asset?.name && asset.browser_download_url))

  if (!selected?.name || !selected.browser_download_url) {
    throw new MirrorUpgradeError('UPGRADE_ASSET_UNAVAILABLE', `Mirror ${targetVersion} has no compatible binary for ${platform}/${arch} (${variant}).`)
  }

  const token = `${process.pid}-${crypto.randomUUID()}`
  const directory = dirnamePath(executablePath)
  const executableName = basenamePath(executablePath)
  const recovery = createUpgradeRecovery(targetVersion, 'resolved', platform)

  return {
    currentVersion,
    targetVersion,
    targetTag,
    releaseUrl: release.html_url ?? releaseUrl(options, targetTag),
    platform,
    arch,
    variant,
    asset: selected.name,
    downloadUrl: selected.browser_download_url,
    executablePath,
    temporaryPath: joinPath(directory, `.mirror-upgrade-${token}-${selected.name}`),
    backupPath: joinPath(directory, `.mirror-backup-${token}-${executableName}`),
    failedArtifactPath: joinPath(directory, `.mirror-failed-${token}-${executableName}`),
    upToDate: options.version ? compare(targetVersion, currentVersion) === 0 : !gt(targetVersion, currentVersion),
    dryRun: Boolean(options.dryRun),
    recovery,
  }
}

async function executeUpgrade(plan: MirrorUpgradePlan, options: UpgradeExecutionOptions = {}): Promise<MirrorUpgradeResult> {
  const events: MirrorUpgradeEvent[] = []
  const warnings: MirrorUpgradeResult['warnings'] = []
  const emit = (phase: MirrorUpgradePhase, status: MirrorUpgradeEvent['status'], message: string) => {
    const event = { sequence: events.length + 1, phase, status, message }
    events.push(event)
    options.onEvent?.(event)
  }
  const skipped = (phase: MirrorUpgradePhase, message: string) => emit(phase, 'skipped', message)
  const base = (): Omit<MirrorUpgradeResult, 'outcome' | 'installedVersion'> => ({
    schemaVersion: 1,
    command: 'mirror upgrade',
    plan,
    events,
    cacheUpdated: false,
    cleanupPending: false,
    warnings,
    recovery: plan.recovery,
  })

  emit('plan', 'started', `Resolved Mirror ${plan.targetVersion} for ${plan.platform}/${plan.arch}.`)
  emit('plan', 'succeeded', `Selected ${plan.asset}.`)

  if (plan.upToDate) {
    for (const phase of ['download', 'validate', 'replace', 'verify', 'cache', 'cleanup'] as const) skipped(phase, 'Already up to date.')
    return { ...base(), outcome: 'up-to-date', installedVersion: plan.currentVersion }
  }

  if (plan.dryRun) {
    for (const phase of ['download', 'validate', 'replace', 'verify', 'cache', 'cleanup'] as const) skipped(phase, 'Dry run; no mutation performed.')
    return { ...base(), outcome: 'dry-run', installedVersion: plan.currentVersion }
  }

  const fetcher = options.fetch ?? fetch
  emit('download', 'started', `Downloading ${plan.downloadUrl}`)
  let response: Response
  try {
    response = await fetcher(plan.downloadUrl, { headers: { 'User-Agent': 'mirror-cli' } })
  } catch (error) {
    emit('download', 'failed', errorMessage(error))
    return failedResult(base(), plan, 'UPGRADE_DOWNLOAD_FAILED', `Failed to download ${plan.downloadUrl}: ${errorMessage(error)}`)
  }
  if (!response.ok) {
    emit('download', 'failed', `${response.status} ${response.statusText}`)
    return failedResult(base(), plan, 'UPGRADE_DOWNLOAD_FAILED', `Failed to download ${plan.downloadUrl}: ${response.status} ${response.statusText}`)
  }

  try {
    await Bun.write(plan.temporaryPath, response)
  } catch (error) {
    emit('download', 'failed', errorMessage(error))
    return failedResult(base(), plan, 'UPGRADE_DOWNLOAD_FAILED', `Failed to save the downloaded binary: ${errorMessage(error)}`)
  }
  emit('download', 'succeeded', `Downloaded ${plan.asset}.`)

  emit('validate', 'started', 'Validating native format and temporary executable version.')
  if (!(await isNativeBinary(plan.temporaryPath, plan.platform))) {
    await removePath(plan.temporaryPath).catch(() => undefined)
    emit('validate', 'failed', 'The downloaded file is not a native binary for this platform.')
    return failedResult(base(), plan, 'UPGRADE_DOWNLOAD_INVALID', 'The downloaded file is not a native binary for this platform.')
  }

  if (plan.platform !== 'windows') {
    const chmod = await runCommand(['chmod', '755', plan.temporaryPath])
    if (chmod.exitCode !== 0) {
      await removePath(plan.temporaryPath).catch(() => undefined)
      emit('validate', 'failed', chmod.stderr.trim() || 'chmod failed')
      return failedResult(base(), plan, 'UPGRADE_DOWNLOAD_INVALID', `Failed to make the temporary binary executable: ${chmod.stderr.trim() || 'chmod failed'}`)
    }
  }

  const temporaryVersion = await readBinaryVersion(plan.temporaryPath)
  if (temporaryVersion !== plan.targetVersion) {
    await removePath(plan.temporaryPath).catch(() => undefined)
    emit('validate', 'failed', `Temporary binary reported ${temporaryVersion || 'no version'}, expected ${plan.targetVersion}.`)
    return failedResult(base(), plan, 'UPGRADE_TEMP_VERSION_MISMATCH', `Temporary binary reported ${temporaryVersion || 'no version'}, expected ${plan.targetVersion}.`)
  }
  emit('validate', 'succeeded', `Temporary binary reports ${plan.targetVersion}.`)

  emit('replace', 'started', `Replacing ${plan.executablePath}.`)
  try {
    await movePath(plan.executablePath, plan.backupPath)
  } catch (error) {
    await removePath(plan.temporaryPath).catch(() => undefined)
    emit('replace', 'failed', errorMessage(error))
    return failedResult(base(), plan, 'UPGRADE_RENAME_CURRENT_FAILED', `Could not rename the current executable: ${errorMessage(error)}`)
  }

  try {
    await movePath(plan.temporaryPath, plan.executablePath)
  } catch (error) {
    emit('replace', 'failed', errorMessage(error))
    return rollbackResult(base(), plan, 'UPGRADE_INSTALL_FAILED', `Could not install the downloaded executable: ${errorMessage(error)}`)
  }
  emit('replace', 'succeeded', 'The target binary is now at the canonical executable path.')

  emit('verify', 'started', `Launching ${plan.executablePath} --version.`)
  const canonicalVersion = await readBinaryVersion(plan.executablePath)
  if (canonicalVersion !== plan.targetVersion) {
    emit('verify', 'failed', `Canonical binary reported ${canonicalVersion || 'no version'}, expected ${plan.targetVersion}.`)
    return rollbackResult(base(), plan, 'UPGRADE_CANONICAL_VERSION_MISMATCH', `Canonical binary reported ${canonicalVersion || 'no version'}, expected ${plan.targetVersion}.`)
  }
  emit('verify', 'succeeded', `Canonical binary reports ${plan.targetVersion}.`)

  emit('cache', 'started', 'Committing verified update metadata.')
  let cacheUpdated = false
  try {
    await writeUpdateCache({
      checkedAt: new Date().toISOString(),
      currentVersion: plan.targetVersion,
      latestVersion: plan.targetVersion,
      updateAvailable: false,
      releaseUrl: plan.releaseUrl,
    }, { cacheDir: options.cacheDir })
    cacheUpdated = true
    emit('cache', 'succeeded', 'Verified update metadata committed.')
  } catch (error) {
    const message = `The upgrade is active, but update metadata could not be saved: ${errorMessage(error)}`
    warnings.push({ code: 'UPGRADE_CACHE_FAILED', message })
    emit('cache', 'failed', message)
  }

  emit('cleanup', 'started', `Removing old backup ${plan.backupPath}.`)
  let cleanupPending = false
  try {
    await removePath(plan.backupPath)
    emit('cleanup', 'succeeded', 'Old backup removed.')
  } catch (error) {
    cleanupPending = true
    const helperScheduled = plan.platform === 'windows' ? await scheduleWindowsBackupCleanup(plan.backupPath) : false
    const message = helperScheduled
      ? 'The verified upgrade is active; old-backup deletion will retry after this process exits.'
      : `The verified upgrade is active; remove the old backup manually: ${plan.backupPath}`
    warnings.push({ code: 'UPGRADE_CLEANUP_PENDING', message, path: plan.backupPath })
    emit('cleanup', 'failed', `${message} (${errorMessage(error)})`)
  }

  return {
    ...base(),
    outcome: 'upgraded',
    installedVersion: plan.targetVersion,
    cacheUpdated,
    cleanupPending,
  }
}

async function upgradeSelf(options: UpgradeOptions = {}): Promise<MirrorUpgradeResult> {
  const plan = await resolveUpgradePlan(options)
  return executeUpgrade(plan, { fetch: options.fetch, cacheDir: options.cacheDir })
}

async function uninstallSelf(options: UninstallOptions = {}): Promise<MirrorUninstallResult> {
  const executablePath = resolveExecutablePath(options)
  await assertNativeInstall(executablePath, 'uninstall')
  if (options.dryRun) return { executablePath, dryRun: true, scheduled: false }

  if ((options.platform ?? detectNativePlatform()) === 'windows') {
    await scheduleWindowsRemoval(executablePath)
    return { executablePath, dryRun: false, scheduled: true }
  }

  await removePath(executablePath)
  return { executablePath, dryRun: false, scheduled: false }
}

async function listAvailableVersions(options: SelfManagementOptions = {}): Promise<MirrorReleaseCatalog> {
  const platform = options.platform ?? detectNativePlatform()
  const arch = detectNativeArch(options.arch)
  const variant = parseVariant(options.variant)
  const currentVersion = resolveCurrentVersion(options)
  const releases: GitHubRelease[] = []
  const warnings: string[] = []
  const fetcher = options.fetch ?? fetch
  let url: string | null = `${apiBaseUrl(options)}/repos/${resolveRepo(options)}/releases?per_page=100&page=1`
  let pagesFetched = 0

  while (url) {
    const response = await fetcher(url, { headers: { 'User-Agent': 'mirror-cli' } })
    if (!response.ok) throw new MirrorError(`Failed to fetch complete Mirror release catalog on page ${pagesFetched + 1}: ${response.status} ${response.statusText}`)
    const page = await response.json() as GitHubRelease[]
    releases.push(...page)
    pagesFetched += 1
    url = nextPageUrl(response.headers.get('link'))
  }

  const normalized: Array<{ release: GitHubRelease, version: string, tag: string }> = []
  for (const release of releases) {
    if (release.draft) continue
    if (!release.tag_name) {
      warnings.push('Skipped a release without tag_name.')
      continue
    }
    try {
      normalized.push({ release, version: normalizeMirrorReleaseTag(release.tag_name), tag: release.tag_name })
    } catch {
      warnings.push(`Skipped malformed Mirror release tag: ${release.tag_name}`)
    }
  }

  normalized.sort((left, right) => {
    const semantic = rcompare(left.version, right.version)
    if (semantic !== 0) return semantic
    return (right.release.published_at ?? '').localeCompare(left.release.published_at ?? '')
  })
  const latestStableVersion = normalized.find(({ version }) => parse(version)?.prerelease.length === 0)?.version ?? null
  const candidates = buildAssetCandidates(platform, arch, variant)
  const catalogReleases: MirrorAvailableRelease[] = normalized.map(({ release, version, tag }) => {
    const compatibleAsset = candidates.find((candidate) => release.assets?.some((asset) => asset.name === candidate))
    const semantic = parse(version)
    const prerelease = Boolean(semantic && semantic.prerelease.length > 0)
    return {
      version,
      tag,
      channel: prerelease ? String(semantic?.prerelease[0] ?? 'prerelease') : 'stable',
      prerelease,
      publishedAt: release.published_at ?? '',
      releaseUrl: release.html_url ?? releaseUrl(options, tag),
      current: version === currentVersion,
      latestStable: version === latestStableVersion,
      compatible: Boolean(compatibleAsset),
      ...(compatibleAsset ? { compatibleAsset } : {}),
    }
  })

  return {
    schemaVersion: 1,
    command: 'mirror upgrade list',
    currentVersion,
    latestStableVersion,
    complete: true,
    platform,
    arch,
    variant,
    pagesFetched,
    releaseCount: catalogReleases.length,
    releases: catalogReleases,
    warnings,
  }
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

function normalizeMirrorVersion(value: string) {
  const normalized = value.replace(/^@guiho\/mirror@/, '').replace(/^v/, '')
  const semanticVersion = valid(normalized)
  if (!semanticVersion) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Invalid Mirror semantic version: ${value}`)
  return semanticVersion
}

function normalizeMirrorReleaseTag(value: string) {
  const match = /^@guiho\/mirror@(.+)$/.exec(value)
  if (!match?.[1]) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Invalid Mirror release tag: ${value}`)
  const semanticVersion = valid(match[1])
  if (!semanticVersion) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Invalid Mirror release tag: ${value}`)
  return semanticVersion
}

function createUpgradeRecovery(targetVersion: string, targetSource: MirrorUpgradeRecovery['targetSource'], platform: MirrorNativePlatform = detectNativePlatform()): MirrorUpgradeRecovery {
  const version = normalizeMirrorVersion(targetVersion)
  const scriptUrl = process.env['MIRROR_INSTALL_SCRIPT_URL']
    ?? `https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/install.${platform === 'windows' ? 'ps1' : 'sh'}`
  if (platform === 'windows') {
    return {
      targetVersion: version,
      targetSource,
      installCommand: `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((Invoke-RestMethod '${scriptUrl}'))) -Version '${version}'"`,
      stopProcessCommand: 'powershell.exe -NoProfile -Command "Get-Process mirror -ErrorAction SilentlyContinue | Stop-Process -Force"',
    }
  }
  return {
    targetVersion: version,
    targetSource,
    installCommand: `curl -fsSL ${scriptUrl} | bash -s -- --version '${version}'`,
    stopProcessCommand: 'pkill -x mirror',
  }
}

function createUpgradeResolutionFailure(error: unknown, options: SelfManagementOptions = {}): MirrorUpgradeResult {
  const currentVersion = resolveCurrentVersion(options)
  const platform = options.platform ?? detectNativePlatform()
  const recovery = createUpgradeRecovery(currentVersion, 'fallback-current', platform)
  const event: MirrorUpgradeEvent = { sequence: 1, phase: 'plan', status: 'failed', message: errorMessage(error) }
  return {
    schemaVersion: 1,
    command: 'mirror upgrade',
    plan: null,
    events: [event],
    outcome: 'failed',
    installedVersion: currentVersion,
    cacheUpdated: false,
    cleanupPending: false,
    warnings: [],
    failure: {
      code: error instanceof MirrorUpgradeError ? error.code : 'UPGRADE_RESOLUTION_FAILED',
      message: errorMessage(error),
      rollbackAttempted: false,
      rollbackSucceeded: false,
      preservedPaths: [],
    },
    recovery,
  }
}

async function fetchLatestRelease(options: SelfManagementOptions) {
  const response = await (options.fetch ?? fetch)(`${apiBaseUrl(options)}/repos/${resolveRepo(options)}/releases/latest`, {
    headers: { 'User-Agent': 'mirror-cli' },
  })
  if (!response.ok) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Failed to fetch latest Mirror release: ${response.status} ${response.statusText}`)
  return response.json() as Promise<GitHubRelease>
}

async function fetchReleaseByVersion(version: string, options: SelfManagementOptions) {
  const tag = `@guiho/mirror@${version}`
  const response = await (options.fetch ?? fetch)(`${apiBaseUrl(options)}/repos/${resolveRepo(options)}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: { 'User-Agent': 'mirror-cli' },
  })
  if (!response.ok) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Failed to fetch Mirror ${version}: ${response.status} ${response.statusText}`)
  return response.json() as Promise<GitHubRelease>
}

function requireReleaseTag(release: GitHubRelease) {
  if (!release.tag_name) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', 'Mirror release metadata did not include tag_name.')
  return release.tag_name
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

async function readBinaryVersion(path: string) {
  try {
    const timeoutMs = Number.parseInt(process.env['MIRROR_BINARY_VERSION_TIMEOUT_MS'] ?? '10000', 10)
    const result = await runCommand([path, '--version'], { timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10_000 })
    if (result.timedOut || result.exitCode !== 0) return null
    const output = result.stdout.trim()
    return valid(output) ?? null
  } catch {
    return null
  }
}

async function rollbackResult(base: Omit<MirrorUpgradeResult, 'outcome' | 'installedVersion'>, plan: MirrorUpgradePlan, code: MirrorUpgradeFailureCode, message: string): Promise<MirrorUpgradeResult> {
  const preservedPaths: string[] = []
  try {
    if (await fileExists(plan.executablePath)) {
      await movePath(plan.executablePath, plan.failedArtifactPath)
      preservedPaths.push(plan.failedArtifactPath)
    }
    await movePath(plan.backupPath, plan.executablePath)
    const restoredVersion = await readBinaryVersion(plan.executablePath)
    if (restoredVersion !== plan.currentVersion) throw new Error(`restored executable reported ${restoredVersion || 'no version'}, expected ${plan.currentVersion}`)
    return {
      ...base,
      outcome: 'rolled-back',
      installedVersion: plan.currentVersion,
      failure: { code, message, rollbackAttempted: true, rollbackSucceeded: true, preservedPaths },
    }
  } catch (rollbackError) {
    for (const path of [plan.executablePath, plan.backupPath, plan.failedArtifactPath]) {
      if (await fileExists(path) && !preservedPaths.includes(path)) preservedPaths.push(path)
    }
    return {
      ...base,
      outcome: 'failed',
      installedVersion: plan.currentVersion,
      failure: {
        code: 'UPGRADE_ROLLBACK_FAILED',
        message: `${message} Rollback failed: ${errorMessage(rollbackError)}`,
        rollbackAttempted: true,
        rollbackSucceeded: false,
        preservedPaths,
      },
    }
  }
}

function failedResult(base: Omit<MirrorUpgradeResult, 'outcome' | 'installedVersion'>, plan: MirrorUpgradePlan, code: MirrorUpgradeFailureCode, message: string): MirrorUpgradeResult {
  return {
    ...base,
    outcome: 'failed',
    installedVersion: plan.currentVersion,
    failure: { code, message, rollbackAttempted: false, rollbackSucceeded: false, preservedPaths: [] },
  }
}

async function movePath(source: string, destination: string) {
  if (process.platform === 'win32') {
    const command = `Move-Item -LiteralPath ${quotePowerShell(source)} -Destination ${quotePowerShell(destination)} -Force`
    const result = await runCommand(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command])
    if (result.exitCode !== 0) throw new MirrorError(result.stderr.trim() || result.stdout.trim() || `Move failed: ${source} -> ${destination}`)
    return
  }
  const result = await runCommand(['mv', '-f', source, destination])
  if (result.exitCode !== 0) throw new MirrorError(result.stderr.trim() || `Move failed: ${source} -> ${destination}`)
}

async function scheduleWindowsBackupCleanup(path: string) {
  try {
    const scriptPath = joinPath(dirnamePath(path), `.mirror-cleanup-${process.pid}-${crypto.randomUUID()}.ps1`)
    const script = [
      `$pidToWait = ${process.pid}`,
      'Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue',
      `Remove-Item -LiteralPath ${quotePowerShell(path)} -Force -ErrorAction SilentlyContinue`,
      'Remove-Item -LiteralPath $MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue',
    ].join('\n')
    await writeTextFile(scriptPath, script)
    const proc = Bun.spawn(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
    ;(proc as unknown as { unref?: () => void }).unref?.()
    return true
  } catch {
    return false
  }
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
  const proc = Bun.spawn(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  ;(proc as unknown as { unref?: () => void }).unref?.()
}

function nextPageUrl(linkHeader: string | null) {
  if (!linkHeader) return null
  for (const value of linkHeader.split(',')) {
    const match = /<([^>]+)>;\s*rel="([^"]+)"/.exec(value.trim())
    if (match?.[2]?.split(/\s+/).includes('next')) return match[1] ?? null
  }
  return null
}

function resolveCurrentVersion(options: SelfManagementOptions) {
  return normalizeMirrorVersion(options.currentVersion ?? currentMirrorVersion)
}

function resolveRepo(options: SelfManagementOptions) {
  return options.repo ?? process.env['MIRROR_REPO'] ?? defaultRepo
}

function apiBaseUrl(options: SelfManagementOptions) {
  return (options.apiBaseUrl ?? process.env['MIRROR_GITHUB_API_URL'] ?? defaultApiBaseUrl).replace(/\/$/, '')
}

function releaseUrl(options: SelfManagementOptions, tag: string) {
  return `https://github.com/${resolveRepo(options)}/releases/tag/${encodeURIComponent(tag)}`
}

function quotePowerShell(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function defaultCacheDirectory() {
  if (process.platform === 'win32') return joinPath(process.env['LOCALAPPDATA'] ?? process.env['USERPROFILE'] ?? '.', 'mirror')
  return joinPath(process.env['XDG_CACHE_HOME'] ?? joinPath(process.env['HOME'] ?? '.', '.cache'), 'mirror')
}
