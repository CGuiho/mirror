/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
 */

import { Type } from '@sinclair/typebox'
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
import {
  GitHubReleaseCatalogSchema,
  GitHubReleaseSchema,
  MirrorUpdateCacheSchema,
  decodeWithSchema,
} from './schema.js'

export {
  buildAssetCandidates,
  acquireBackgroundUpdateLease,
  checkForLatestVersion,
  createUpgradeRecovery,
  createUpgradeResolutionFailure,
  detectNativeArch,
  detectNativePlatform,
  executeUpgrade,
  listAvailableVersions,
  normalizeMirrorVersion,
  readUpdateCache,
  releaseBackgroundUpdateLease,
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
const backgroundUpdateTimeoutMilliseconds = 15_000
const backgroundUpdateLockStaleMilliseconds = 30_000
const currentMirrorVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

const backgroundUpdateLeaseSchema = Type.Object({
  token: Type.RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  pid: Type.Integer({ minimum: 1 }),
  createdAt: Type.String(),
})

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
  page?: number
  perPage?: number
  preReleases?: boolean
  fetch?: typeof fetch
  signal?: AbortSignal
  sourceCheckout?: boolean
  now?: () => number
  updateTimeoutMilliseconds?: number
  lockStaleMilliseconds?: number
}

type BackgroundUpdateLease = {
  token: string
  pid: number
  createdAt: string
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
    return decodeWithSchema<typeof MirrorUpdateCacheSchema, MirrorUpdateCache>(
      MirrorUpdateCacheSchema,
      await Bun.file(resolveCachePath(options)).json(),
      'Mirror update cache',
    )
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
  return joinPath(root, 'cache.json')
}

async function checkForLatestVersion(options: SelfManagementOptions = {}) {
  const release = await fetchLatestRelease(options)
  const latestVersion = normalizeMirrorVersion(requireReleaseTag(release))
  const currentVersion = resolveCurrentVersion(options)
  const cache: MirrorUpdateCache = {
    newVersionAvailable: gt(latestVersion, currentVersion),
    latestVersion,
    ...(gt(latestVersion, currentVersion) ? { upgradeCommand: 'mirror upgrade' } : {}),
    lastCheck: new Date().toISOString(),
  }
  await writeUpdateCache(cache, options)
  return cache
}

async function runBackgroundUpdateCheck(options: SelfManagementOptions = {}) {
  if (process.env['MIRROR_DISABLE_UPDATE_CHECK'] === '1') return
  const inheritedToken = process.env['MIRROR_UPDATE_CHECK_LOCK_TOKEN']
  const lease = inheritedToken
    ? await readBackgroundUpdateLease(options).then((current) => current?.token === inheritedToken ? current : null)
    : await acquireBackgroundUpdateLease(options)
  if (!lease) return

  const timeoutMilliseconds = resolvePositiveMilliseconds(
    options.updateTimeoutMilliseconds,
    backgroundUpdateTimeoutMilliseconds,
  )
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      reject(new MirrorError(`Mirror background update check timed out after ${timeoutMilliseconds}ms.`))
    }, timeoutMilliseconds)
  })

  try {
    await Promise.race([
      checkForLatestVersion({ ...options, signal: controller.signal }),
      timeoutPromise,
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
    await releaseBackgroundUpdateLease(lease, options)
  }
}

async function scheduleBackgroundUpdateCheck(options: SelfManagementOptions = {}) {
  let lease: BackgroundUpdateLease | null = null
  try {
    if (process.env['MIRROR_DISABLE_UPDATE_CHECK'] === '1') return false
    if (process.env['MIRROR_BACKGROUND_UPDATE_CHECK'] === '1') return false
    const cache = await readUpdateCache(options)
    if (cache && (options.now?.() ?? Date.now()) - Date.parse(cache.lastCheck) < cacheTtlMilliseconds) return false
    if (options.sourceCheckout ?? await isSourceCheckout()) return false

    lease = await acquireBackgroundUpdateLease(options)
    if (!lease) return false
    const proc = Bun.spawn([resolveExecutablePath(options), '--mirror-update-check-worker'], {
      detached: true,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        MIRROR_BACKGROUND_UPDATE_CHECK: '1',
        MIRROR_UPDATE_CHECK_LOCK_TOKEN: lease.token,
      },
    })
    proc.unref()
    return true
  } catch {
    if (lease) await releaseBackgroundUpdateLease(lease, options)
    return false
  }
}

async function acquireBackgroundUpdateLease(options: SelfManagementOptions = {}): Promise<BackgroundUpdateLease | null> {
  const lockPath = resolveBackgroundUpdateLockPath(options)
  await ensureDirectory(dirnamePath(lockPath))
  const lease = createBackgroundUpdateLease(options)
  if (await createDirectoryExclusively(lockPath)) {
    return writeAcquiredBackgroundUpdateLease(lease, options)
  }

  const reclaimPath = resolveBackgroundUpdateReclaimPath(options)
  if (!(await acquireBackgroundUpdateReclaimLock(reclaimPath, options))) return null
  try {
    const current = await readBackgroundUpdateLease(options)
    const now = options.now?.() ?? Date.now()
    const staleMilliseconds = resolvePositiveMilliseconds(
      options.lockStaleMilliseconds,
      backgroundUpdateLockStaleMilliseconds,
    )
    if (current) {
      if (now - Date.parse(current.createdAt) < staleMilliseconds) return null
      if (!(await releaseBackgroundUpdateLease(current, options))) return null
    } else {
      const modifiedAt = await readBackgroundUpdateLockModifiedAt(options)
      if (modifiedAt === null || now - modifiedAt < staleMilliseconds) return null
      if (!(await removeDirectoryOnce(lockPath))) return null
    }

    const replacement = createBackgroundUpdateLease(options)
    if (!(await createDirectoryExclusively(lockPath))) return null
    return writeAcquiredBackgroundUpdateLease(replacement, options)
  } finally {
    await removeDirectoryOnce(reclaimPath)
  }
}

async function acquireBackgroundUpdateReclaimLock(path: string, options: SelfManagementOptions) {
  if (await createDirectoryExclusively(path)) return true
  const now = options.now?.() ?? Date.now()
  const staleMilliseconds = resolvePositiveMilliseconds(
    options.lockStaleMilliseconds,
    backgroundUpdateLockStaleMilliseconds,
  )
  const observedModifiedAt = await readPathModifiedAt(path)
  if (observedModifiedAt === null || now - observedModifiedAt < staleMilliseconds) return false
  const confirmedModifiedAt = await readPathModifiedAt(path)
  if (confirmedModifiedAt !== observedModifiedAt) return false
  if (!(await removeDirectoryOnce(path))) return false
  return createDirectoryExclusively(path)
}

async function writeAcquiredBackgroundUpdateLease(lease: BackgroundUpdateLease, options: SelfManagementOptions) {
  const lockPath = resolveBackgroundUpdateLockPath(options)
  try {
    await writeBackgroundUpdateLease(lease, options)
    return lease
  } catch (error) {
    await removeDirectoryOnce(lockPath)
    throw error
  }
}

async function releaseBackgroundUpdateLease(lease: BackgroundUpdateLease, options: SelfManagementOptions = {}) {
  const lockPath = resolveBackgroundUpdateLockPath(options)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readBackgroundUpdateLease(options)
    if (!current || current.token !== lease.token) return false
    if (await removeDirectoryOnce(lockPath)) return true
    await Bun.sleep(10)
  }
  return false
}

async function removeDirectoryOnce(path: string) {
  try {
    await removePath(path)
    return true
  } catch {
    return !(await pathExistsForLock(path))
  }
}

async function pathExistsForLock(path: string) {
  try {
    await Bun.file(path).stat()
    return true
  } catch {
    return false
  }
}

function createBackgroundUpdateLease(options: SelfManagementOptions): BackgroundUpdateLease {
  return {
    token: crypto.randomUUID(),
    pid: process.pid,
    createdAt: new Date(options.now?.() ?? Date.now()).toISOString(),
  }
}

async function readBackgroundUpdateLease(options: SelfManagementOptions): Promise<BackgroundUpdateLease | null> {
  try {
    const lease = decodeWithSchema<typeof backgroundUpdateLeaseSchema, BackgroundUpdateLease>(
      backgroundUpdateLeaseSchema,
      await Bun.file(resolveBackgroundUpdateLeasePath(options)).json(),
      'Mirror background update lease',
    )
    return Number.isFinite(Date.parse(lease.createdAt)) ? lease : null
  } catch {
    return null
  }
}

async function writeBackgroundUpdateLease(lease: BackgroundUpdateLease, options: SelfManagementOptions) {
  await writeTextFile(resolveBackgroundUpdateLeasePath(options), `${JSON.stringify(lease)}\n`)
}

async function readBackgroundUpdateLockModifiedAt(options: SelfManagementOptions) {
  return readPathModifiedAt(resolveBackgroundUpdateLockPath(options))
}

async function readPathModifiedAt(path: string) {
  try {
    return (await Bun.file(path).stat()).mtimeMs
  } catch {
    return null
  }
}

async function createDirectoryExclusively(path: string) {
  const result = await Bun.$`mkdir ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

function resolveBackgroundUpdateLockPath(options: SelfManagementOptions) {
  return joinPath(dirnamePath(resolveCachePath(options)), '.update-check.lock')
}

function resolveBackgroundUpdateLeasePath(options: SelfManagementOptions) {
  return joinPath(resolveBackgroundUpdateLockPath(options), 'lease.json')
}

function resolveBackgroundUpdateReclaimPath(options: SelfManagementOptions) {
  return joinPath(dirnamePath(resolveCachePath(options)), '.update-check-reclaim.lock')
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

  emit('verify', 'started', 'Saving the configuration schema with the installed binary.')
  const schemaSave = await runCommand([plan.executablePath, 'config', 'schema', '--save', '--format', 'json'], {
    timeoutMs: 10_000,
  })
  if (schemaSave.timedOut || schemaSave.exitCode !== 0) {
    const detail = schemaSave.stderr.trim() || schemaSave.stdout.trim() || 'schema save failed'
    emit('verify', 'failed', detail)
    return rollbackResult(base(), plan, 'UPGRADE_CANONICAL_VERSION_MISMATCH', `Installed Mirror could not save its global schema: ${detail}`)
  }
  try {
    const saved = JSON.parse(schemaSave.stdout) as { path?: unknown }
    if (typeof saved.path !== 'string' || saved.path.length === 0) throw new Error('schema result omitted path')
  } catch (error) {
    emit('verify', 'failed', errorMessage(error))
    return rollbackResult(base(), plan, 'UPGRADE_CANONICAL_VERSION_MISMATCH', `Installed Mirror returned an invalid schema result: ${errorMessage(error)}`)
  }
  emit('verify', 'succeeded', 'The installed binary saved ~/.guiho/mirror/schema.json.')

  emit('cache', 'started', 'Committing verified update metadata.')
  let cacheUpdated = false
  try {
    await writeUpdateCache({
      newVersionAvailable: false,
      latestVersion: plan.targetVersion,
      lastCheck: new Date().toISOString(),
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
  const page = options.page ?? 1
  const perPage = options.perPage ?? 30
  let url: string | null = `${apiBaseUrl(options)}/repos/${resolveRepo(options)}/releases?per_page=${perPage}&page=${page}`
  let pagesFetched = 0

  while (url) {
    const response: Response = await fetcher(url, { headers: { 'User-Agent': 'mirror-cli' } })
    if (!response.ok) throw new MirrorError(`Failed to fetch complete Mirror release catalog on page ${pagesFetched + 1}: ${response.status} ${response.statusText}`)
    const pagePayload = decodeWithSchema<typeof GitHubReleaseCatalogSchema, GitHubRelease[]>(
      GitHubReleaseCatalogSchema,
      await response.json(),
      'GitHub release catalog',
      4,
    )
    releases.push(...pagePayload)
    pagesFetched += 1
    url = options.page === undefined ? nextPageUrl(response.headers.get('link')) : null
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
  if (process.platform === 'darwin') return 'darwin'
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
  if (arch === 'arm64') return [`mirror-${platform}-arm64${extension}`]
  if (variant === 'modern') return [`mirror-${platform}-x64-modern${extension}`, `mirror-${platform}-x64${extension}`, `mirror-${platform}-x64-baseline${extension}`]
  if (variant === 'default') return [`mirror-${platform}-x64${extension}`, `mirror-${platform}-x64-baseline${extension}`, `mirror-${platform}-x64-modern${extension}`]
  return [`mirror-${platform}-x64-baseline${extension}`, `mirror-${platform}-x64${extension}`, `mirror-${platform}-x64-modern${extension}`]
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
    signal: options.signal,
  })
  if (!response.ok) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Failed to fetch latest Mirror release: ${response.status} ${response.statusText}`)
  return decodeWithSchema<typeof GitHubReleaseSchema, GitHubRelease>(
    GitHubReleaseSchema,
    await response.json(),
    'GitHub latest release',
    4,
  )
}

async function fetchReleaseByVersion(version: string, options: SelfManagementOptions) {
  const tag = `@guiho/mirror@${version}`
  const response = await (options.fetch ?? fetch)(`${apiBaseUrl(options)}/repos/${resolveRepo(options)}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: { 'User-Agent': 'mirror-cli' },
  })
  if (!response.ok) throw new MirrorUpgradeError('UPGRADE_RESOLUTION_FAILED', `Failed to fetch Mirror ${version}: ${response.status} ${response.statusText}`)
  return decodeWithSchema<typeof GitHubReleaseSchema, GitHubRelease>(
    GitHubReleaseSchema,
    await response.json(),
    `GitHub release ${version}`,
    4,
  )
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

function resolvePositiveMilliseconds(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value !== undefined && value > 0 ? value : fallback
}

function defaultCacheDirectory() {
  const home = process.env['HOME'] ?? process.env['USERPROFILE']
  if (!home) throw new MirrorError('Unable to resolve the user home directory from HOME or USERPROFILE.', 5)
  return joinPath(home, '.guiho', 'mirror')
}
