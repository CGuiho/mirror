/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export type {
  MirrorAdapterName,
  MirrorCliOptions,
  MirrorConfig,
  MirrorExecutionResult,
  MirrorFormat,
  MirrorRawConfig,
  MirrorVersionPlan,
  MirrorVersionPlanAction,
  MirrorVersionTarget,
} from './types.js'

export { MirrorError, invariant } from './errors.js'
export { parseMirrorCliOptions } from './flags.js'
export { createInitConfig, discoverMirrorConfig, loadMirrorConfig, normalizeMirrorConfig, writeInitConfig } from './config.js'
export { assertValidSemver, isMirrorReleaseTarget, mirrorReleaseTargets, resolveNextVersion, sortSemverDescending } from './version.js'
export {
  createGitCommit,
  createGitTag,
  ensureAdapterFiles,
  ensureGitAvailable,
  assertSupportedGitTagTemplate,
  isGitDirty,
  isGitRepository,
  readCurrentVersion,
  readGitVersion,
  readJsrName,
  readJsrVersion,
  readPackageName,
  readPackageVersion,
  renderGitTag,
  resolveProjectName,
  supportedGitTagTemplates,
  versionFromTag,
  writeJsrVersion,
  writePackageVersion,
} from './adapters.js'
export { buildVersionPlan, releaseLabel, resolveFileOutputPaths, validateMirrorConfig } from './plan.js'
export { applyVersionPlan, executeVersionPlan } from './executor.js'
export { mirrorBanner, reportConfig, reportConfigSchema, reportExecution, reportExecutionSummary, reportPlan, reportValue } from './reporter.js'
export { createMirrorCommand, runMirrorCli } from './cli.js'
