/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export type {
  MirrorAdapterName,
  MirrorCliOptions,
  MirrorConfig,
  MirrorExecutionResult,
  MirrorFormat,
  MirrorAgentSettings,
  MirrorAgentsInstructionsResult,
  MirrorHookCommand,
  MirrorHookName,
  MirrorHookResult,
  MirrorHooksConfig,
  MirrorInitAnswers,
  MirrorInitFlags,
  MirrorInitPrompter,
  MirrorRawConfig,
  MirrorSkillInstallResult,
  MirrorSkillInstallScope,
  MirrorUninstallResult,
  MirrorUpdateCache,
  MirrorAvailableRelease,
  MirrorReleaseCatalog,
  MirrorUpgradeEvent,
  MirrorUpgradeFailure,
  MirrorUpgradeFailureCode,
  MirrorUpgradeOutcome,
  MirrorUpgradePhase,
  MirrorUpgradePhaseStatus,
  MirrorUpgradePlan,
  MirrorUpgradeRecovery,
  MirrorVersionPlan,
  MirrorVersionPlanAction,
  MirrorVersionTarget,
  MirrorUpgradeResult,
} from './types.js'

export { MirrorError, invariant } from './errors.js'
export { showMirrorCommandHelpDocs, showMirrorCommandHelpTree } from './help.js'
export {
  checkForLatestVersion,
  buildAssetCandidates,
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
} from './self-management.js'
export {
  defaultMirrorAgentSettings,
  ensureMirrorAgentsInstructions,
  findAgentsFile,
  installMirrorSkill,
  isMirrorSkillInstalled,
  legacyMirrorSkillNames,
  mirrorAgentsSection,
  mirrorAgentsSectionEndMarker,
  mirrorAgentsSectionHeading,
  mirrorAgentsSectionStartMarker,
  mirrorSkillName,
  mirrorSkillVersion,
  resolveMirrorAgentSettings,
  resolveMirrorSkillPath,
} from './agents.js'
export {
  createInitConfig,
  defaultInitAnswersForSource,
  discoverMirrorConfig,
  generateInitConfig,
  loadMirrorConfig,
  normalizeMirrorConfig,
  reconcileInitConfig,
  writeInitConfig,
  writeInitConfigFromAnswers,
} from './config.js'
export { createReadlineInitPrompter, isInteractiveInit, parseAdapterList, resolveInitAnswers } from './init.js'
export { resolveMirrorSchemaPath, saveMirrorConfigSchema } from './config-schema.js'
export type { MirrorSchemaSaveResult, MirrorSchemaSaveStatus } from './config-schema.js'
export { mirrorConfigJsonSchema, mirrorConfigSchemaReference, renderMirrorConfigJsonSchema } from './schema.js'
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
  readJsrVersionFile,
  readPackageName,
  readPackageVersion,
  readPackageVersionFile,
  renderGitTag,
  resolveProjectName,
  supportedGitTagTemplates,
  versionFromTag,
  writeJsrVersion,
  writeJsrVersionFile,
  writePackageVersion,
  writePackageVersionFile,
} from './adapters.js'
export { buildVersionPlan, releaseLabel, resolveFileOutputPaths, validateMirrorConfig } from './plan.js'
export { applyVersionPlan, executeVersionPlan } from './executor.js'
export {
  hookEnvFromConfig,
  hookEnvForAction,
  hookEnvForPlan,
  hookEnvForResult,
  mirrorHookNames,
  normalizeHooksConfig,
  runHooks,
  runHooksQuiet,
} from './hooks.js'
export {
  mirrorBanner,
  reportAgentsInstructions,
  reportConfig,
  reportConfigSchema,
  reportSavedConfigSchema,
  reportExecution,
  reportExecutionSummary,
  reportPlan,
  reportSkillInstall,
  reportValue,
  renderMirrorWelcome,
} from './reporter.js'
export { createMirrorCommand, runMirrorCli } from './cli.js'
