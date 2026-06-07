/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export type {
  MirrorAdapterName,
  MirrorCliOptions,
  MirrorConfig,
  MirrorExecutionResult,
  MirrorFormat,
  MirrorAgentAutomationResult,
  MirrorAgentSettings,
  MirrorAgentsInstructionsResult,
  MirrorInitAnswers,
  MirrorInitFlags,
  MirrorInitPrompter,
  MirrorRawConfig,
  MirrorSkillInstallResult,
  MirrorSkillInstallScope,
  MirrorVersionPlan,
  MirrorVersionPlanAction,
  MirrorVersionTarget,
} from './types.js'

export { MirrorError, invariant } from './errors.js'
export { parseMirrorCliOptions } from './flags.js'
export {
  defaultMirrorAgentSettings,
  ensureMirrorAgentsInstructions,
  findAgentsFile,
  installMirrorSkill,
  isMirrorSkillInstalled,
  mirrorAgentsSection,
  mirrorAgentsSectionHeading,
  mirrorSkillName,
  resolveMirrorAgentSettings,
  resolveMirrorSkillPath,
  runMirrorAgentAutomation,
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
  mirrorBanner,
  reportAgentsInstructions,
  reportConfig,
  reportConfigSchema,
  reportExecution,
  reportExecutionSummary,
  reportPlan,
  reportSkillInstall,
  reportValue,
} from './reporter.js'
export { createMirrorCommand, runMirrorCli } from './cli.js'
