/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { defineCommand, renderUsage, runCommand as runCittyCommand } from 'citty'
import { readCurrentVersion, resolveProjectName } from './adapters.js'
import { ensureMirrorAgentInstructionFiles, installMirrorSkills, runMirrorAgentAutomation } from './agents.js'
import { configPathForDisplay, discoverMirrorConfig, loadMirrorConfig, relativeFromCwd, writeInitConfigFromAnswers } from './config.js'
import { MirrorError, MirrorUsageError } from './errors.js'
import { executeVersionPlan } from './executor.js'
import { showMirrorCommandHelpDocs, showMirrorCommandHelpTree } from './help.js'
import { hookEnvForPlan, hookEnvForResult, hookEnvFromConfig, runHooks, runHooksQuiet } from './hooks.js'
import { createReadlineInitPrompter, isInteractiveInit, resolveInitAnswers } from './init.js'
import { resolvePath } from './path.js'
import { buildVersionPlan, validateMirrorConfig } from './plan.js'
import {
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
import {
  checkForLatestVersion,
  createUpgradeResolutionFailure,
  executeUpgrade,
  listAvailableVersions,
  readUpdateCache,
  resolveUpgradePlan,
  runBackgroundUpdateCheck,
  scheduleBackgroundUpdateCheck,
  uninstallSelf,
} from './self-management.js'
import { resolveNextVersion } from './version.js'
import packageJson from '../package.json' with { type: 'json' }

import type { CommandContext, CommandDef } from 'citty'
import type { MirrorAdapterName, MirrorAgentToolSelection, MirrorCliOptions, MirrorFormat, MirrorHookResult, MirrorInitFlags, MirrorUpgradeRecovery, MirrorUpgradeResult } from './types.js'

export {
  createMirrorCommand,
  runMirrorCli,
}

type CliArgs = Record<string, string | number | boolean | string[] | undefined> & {
  _: string[]
}

type CliState = {
  readonly rawArgs: string[]
  readonly usageCommands: Map<string, CommandDef<any>>
  rootArgs: CliArgs
  inheritedArgs: CliArgs
  usageCommand: CommandDef<any>
  usagePath: string[]
  noColor: boolean
  verbose: boolean
}

class CliHandled extends Error {}

const mirrorVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

const commonArgs = {
  cwd: { type: 'string', description: 'Run as if Mirror started in this directory.', valueHint: 'path' },
  config: { type: 'string', description: 'Use this mirror.config.toml file.', valueHint: 'path' },
  format: { type: 'string', description: 'Select text or JSON output.', valueHint: 'text|json' },
  tool: { type: 'string', description: 'Select agents, claude, or all.', valueHint: 'agents|claude|all' },
  color: { type: 'boolean', description: 'Enable ANSI color output.', negativeDescription: 'Disable ANSI color output.' },
  verbose: { type: 'boolean', description: 'Show full error details.' },
  help: { type: 'boolean', alias: 'h', description: 'Show command help.' },
  'help-tree': { type: 'boolean', description: 'Show the command tree from the current command.' },
  'help-docs': { type: 'boolean', description: 'Print Markdown documentation for the current command.' },
} as const

const rootArgs = {
  ...commonArgs,
  version: { type: 'boolean', alias: 'v', description: 'Show the Mirror version.' },
} as const

const adapterArgs = {
  source: { type: 'string', description: 'Select package.json, jsr.json, or git as the source.', valueHint: 'adapter' },
  output: { type: 'string', description: 'Select output adapters. Repeat or comma-separate values.', valueHint: 'adapter' },
  'package-file': { type: 'string', description: 'Override the package.json path.', valueHint: 'path' },
  'jsr-file': { type: 'string', description: 'Override the jsr.json path.', valueHint: 'path' },
  auxiliary: { type: 'string', description: 'Add auxiliary package.json paths. Repeat or comma-separate values.', valueHint: 'path' },
  'tag-template': { type: 'string', description: 'Override the Git tag template.', valueHint: 'template' },
  name: { type: 'string', description: 'Override the project name.', valueHint: 'name' },
  preid: { type: 'string', description: 'Override the prerelease identifier.', valueHint: 'identifier' },
} as const

const releaseArgs = {
  ...commonArgs,
  ...adapterArgs,
  'dry-run': { type: 'boolean', alias: 'dy', description: 'Build the plan without applying it.' },
  commit: { type: 'boolean', description: 'Create a release commit when file outputs changed.' },
  push: { type: 'boolean', description: 'Push release refs.' },
  'allow-dirty': { type: 'boolean', description: 'Allow a dirty Git worktree.' },
  yes: { type: 'boolean', alias: 'y', description: 'Apply without interactive confirmation.' },
} as const

const initArgs = {
  adapter: { type: 'positional', required: false, description: 'Initial version source.', valueHint: 'package.json|jsr.json|git' },
  ...commonArgs,
  ...adapterArgs,
  commit: { type: 'boolean', description: 'Enable release commits.' },
  push: { type: 'boolean', description: 'Enable release pushes.' },
  'non-interactive': { type: 'boolean', description: 'Skip interactive prompts.' },
  yes: { type: 'boolean', alias: 'y', description: 'Allow reconciliation without confirmation.' },
} as const

const targetArgs = {
  target: { type: 'positional', description: 'Release type or exact semantic version.', valueHint: 'target' },
  ...releaseArgs,
} as const

const upgradeArgs = {
  ...commonArgs,
  version: { type: 'string', description: 'Install a specific version instead of latest.', valueHint: 'version' },
  arch: { type: 'string', description: 'Override the native architecture.', valueHint: 'x64|arm64' },
  variant: { type: 'string', description: 'Override the x64 binary variant.', valueHint: 'baseline|default|modern' },
  'dry-run': { type: 'boolean', alias: 'dy', description: 'Preview the selected binary without replacing it.' },
} as const

const upgradeListArgs = {
  ...commonArgs,
  arch: { type: 'string', description: 'Override compatibility architecture.', valueHint: 'x64|arm64' },
  variant: { type: 'string', description: 'Override the x64 compatibility variant.', valueHint: 'baseline|default|modern' },
} as const

const uninstallArgs = {
  ...commonArgs,
  'dry-run': { type: 'boolean', alias: 'dy', description: 'Show the executable path without deleting it.' },
} as const

const allKnownArgumentKeys = new Set([
  '_',
  'adapter',
  'allow-dirty',
  'allowDirty',
  'arch',
  'auxiliary',
  'color',
  'commit',
  'config',
  'cwd',
  'dry-run',
  'dryRun',
  'dy',
  'format',
  'h',
  'help',
  'help-docs',
  'help-tree',
  'helpDocs',
  'helpTree',
  'jsr-file',
  'jsrFile',
  'mirror-update-check-worker',
  'mirrorUpdateCheckWorker',
  'name',
  'non-interactive',
  'nonInteractive',
  'output',
  'package-file',
  'packageFile',
  'preid',
  'push',
  'source',
  'tag-template',
  'tagTemplate',
  'target',
  'tool',
  'v',
  'variant',
  'verbose',
  'version',
  'y',
  'yes',
])

function createMirrorCommand(): CommandDef<any> {
  return createMirrorCommandTree([]).command
}

async function runMirrorCli(rawArgs = process.argv.slice(2)): Promise<void> {
  const normalizedArgs = normalizeCompatibilityArgs(rawArgs)
  const { command, state } = createMirrorCommandTree(normalizedArgs)
  const restoreColorOutput = normalizedArgs.includes('--no-color') ? stripColorFromConsoleOutput() : () => {}

  try {
    if (normalizedArgs.includes('--no-color')) process.env['NO_COLOR'] = '1'
    await runCittyCommand(command, { rawArgs: normalizedArgs })
  } catch (error) {
    if (!(error instanceof CliHandled)) await handleCliError(error, state)
  } finally {
    restoreColorOutput()
  }
}

function createMirrorCommandTree(rawArgs: string[]): { command: CommandDef<any>, state: CliState } {
  const state: CliState = {
    rawArgs,
    usageCommands: new Map(),
    rootArgs: { _: [] },
    inheritedArgs: { _: [] },
    usageCommand: {},
    usagePath: [],
    noColor: rawArgs.includes('--no-color'),
    verbose: rawArgs.includes('--verbose'),
  }

  const configShowCommand = defineCommand({
    meta: { name: 'mirror config show', description: 'Print resolved configuration.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['config', 'show'], 0, commonArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      await prepareAgents(options)
      const config = await loadMirrorConfig(options)
      if (options.format !== 'json') write(mirrorBanner(configPathForDisplay(config)), state)
      write(reportConfig(config, options.format), state)
    },
  })

  const configCheckCommand = defineCommand({
    meta: { name: 'mirror config check', description: 'Validate configuration and adapter files.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['config', 'check'], 0, commonArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      await prepareAgents(options)
      await validateMirrorConfig(options)
      write(reportValue('ok', options.format), state)
    },
  })

  const configSchemaCommand = defineCommand({
    meta: { name: 'mirror config schema', description: 'Print configuration schema and reference.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['config', 'schema'], 0, commonArgs),
    run: ({ args }) => {
      const options = resolveCliOptions(state, args)
      if (options.format !== 'json') write(mirrorBanner(), state)
      write(reportConfigSchema(options.format), state)
    },
  })

  const configCommand = defineCommand({
    meta: { name: 'mirror config', description: 'Validate and inspect configuration.' },
    args: commonArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror config'),
      show: configShowCommand,
      check: configCheckCommand,
      schema: configSchemaCommand,
    },
    setup: withGroupCommand(state, ['config']),
  })

  const agentsInstallCommand = defineCommand({
    meta: { name: 'mirror agents install', description: 'Install the bundled Mirror skill locally or globally.' },
    args: {
      scope: { type: 'positional', description: 'Install locally or globally.', valueHint: 'local|global' },
      ...commonArgs,
    },
    setup: withLeafCommand(state, ['agents', 'install'], 1, { scope: { type: 'positional' }, ...commonArgs }),
    run: async ({ args }) => {
      const scope = stringArg(args, 'scope')
      if (scope !== 'local' && scope !== 'global') throw usageError(state, 'Agent install scope must be local or global.')
      const options = resolveCliOptions(state, args)
      const results = await installMirrorSkills(scope, options.tool ?? 'agents', { cwd: resolvePath(options.cwd ?? process.cwd()) })
      write(reportSkillInstall(results.length === 1 ? results[0]! : results, options.format), state)
    },
  })

  const agentsInstructionsCommand = defineCommand({
    meta: { name: 'mirror agents instructions', description: 'Create or refresh Mirror agent guidance.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['agents', 'instructions'], 0, commonArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const results = await ensureMirrorAgentInstructionFiles(
        resolvePath(options.cwd ?? process.cwd()),
        options.tool ?? 'agents',
        true,
        options.tool === undefined,
      )
      write(reportAgentsInstructions(results.length === 1 ? results[0]! : results, options.format), state)
    },
  })

  const agentsCommand = defineCommand({
    meta: { name: 'mirror agents', description: 'Install Mirror-aware AI-agent guidance.' },
    args: commonArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror agents'),
      install: agentsInstallCommand,
      instructions: agentsInstructionsCommand,
    },
    setup: withGroupCommand(state, ['agents']),
  })

  const versionCurrentCommand = defineCommand({
    meta: { name: 'mirror version current', description: 'Print the current project version.' },
    args: { ...commonArgs, ...adapterArgs },
    setup: withLeafCommand(state, ['version', 'current'], 0, { ...commonArgs, ...adapterArgs }),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      await prepareAgents(options)
      const config = await loadMirrorConfig(options)
      const projectName = await resolveProjectName(config)
      write(reportValue(await readCurrentVersion(config, projectName), options.format), state)
    },
  })

  const versionNextCommand = defineCommand({
    meta: { name: 'mirror version next', description: 'Print the next version for a release target.' },
    args: targetArgs,
    setup: withLeafCommand(state, ['version', 'next'], 1, targetArgs),
    run: async ({ args }) => {
      const target = requireStringArg(args, 'target', state, 'Missing release target. Expected a release type or exact semantic version.')
      const options = resolveCliOptions(state, args)
      await prepareAgents(options)
      const config = await loadMirrorConfig(options)
      const projectName = await resolveProjectName(config)
      const currentVersion = await readCurrentVersion(config, projectName)
      write(reportValue(resolveNextVersion(currentVersion, target, config.version.prereleaseId), options.format), state)
    },
  })

  const versionPlanCommand = defineCommand({
    meta: { name: 'mirror version plan', description: 'Build a read-only release plan.' },
    args: targetArgs,
    setup: withLeafCommand(state, ['version', 'plan'], 1, targetArgs),
    run: async ({ args }) => {
      const target = requireStringArg(args, 'target', state, 'Missing release target. Expected a release type or exact semantic version.')
      const options = resolveCliOptions(state, args)
      await prepareAgents(options)
      const plan = await buildVersionPlan(target, options)
      if (options.format !== 'json') write(mirrorBanner(plan.configPath ? plan.configPath : ''), state)
      write(reportPlan(plan, options.format), state)
    },
  })

  const versionApplyCommand = defineCommand({
    meta: { name: 'mirror version apply', description: 'Apply a planned release target.' },
    args: targetArgs,
    setup: withLeafCommand(state, ['version', 'apply'], 1, targetArgs),
    run: async ({ args }) => {
      const target = requireStringArg(args, 'target', state, 'Missing release target. Expected a release type or exact semantic version.')
      await runApply(target, resolveCliOptions(state, args), state)
    },
  })

  const versionCommand = defineCommand({
    meta: { name: 'mirror version', description: 'Plan and apply semantic version changes.' },
    args: releaseArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror version'),
      current: versionCurrentCommand,
      next: versionNextCommand,
      plan: versionPlanCommand,
      apply: versionApplyCommand,
    },
    setup: withGroupCommand(state, ['version']),
  })

  const upgradeApplyCommand = defineCommand({
    meta: { name: 'mirror upgrade', description: 'Upgrade the installed Mirror native binary.', hidden: true },
    args: upgradeArgs,
    setup: withLeafCommand(state, ['upgrade'], 0, upgradeArgs),
    run: async ({ args }) => runUpgrade(resolveCliOptions(state, args), state),
  })

  const upgradeCheckCommand = defineCommand({
    meta: { name: 'mirror upgrade check', description: 'Check whether a new Mirror release is available.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['upgrade', 'check'], 0, commonArgs),
    run: async ({ args }) => runUpgradeCheck(resolveCliOptions(state, args), state),
  })

  const upgradeListCommand = defineCommand({
    meta: { name: 'mirror upgrade list', description: 'List available Mirror release versions.' },
    args: upgradeListArgs,
    setup: withLeafCommand(state, ['upgrade', 'list'], 0, upgradeListArgs),
    run: async ({ args }) => runUpgradeList(resolveCliOptions(state, args), state),
  })

  const upgradeCommand = defineCommand({
    meta: { name: 'mirror upgrade', description: 'Inspect or upgrade the installed Mirror native binary.' },
    args: upgradeArgs,
    default: '_apply',
    subCommands: {
      _apply: upgradeApplyCommand,
      check: upgradeCheckCommand,
      list: upgradeListCommand,
    },
    setup: withGroupCommand(state, ['upgrade']),
  })

  const uninstallCommand = defineCommand({
    meta: { name: 'mirror uninstall', description: 'Remove the installed Mirror native binary.' },
    args: uninstallArgs,
    setup: withLeafCommand(state, ['uninst…2481 tokens truncated…e.latestStable ? 'latest-stable' : ''].filter(Boolean).join(','))
  const markerWidth = Math.max('MARKERS'.length, ...markerValues.map((value) => value.length))
  const tagWidth = Math.max('TAG'.length, ...catalog.releases.map((release) => release.tag.length))
  write(`${'VERSION'.padEnd(versionWidth)}  ${'CHANNEL'.padEnd(channelWidth)}  PUBLISHED   ${'MARKERS'.padEnd(markerWidth)}  ASSET  ${'TAG'.padEnd(tagWidth)}  RELEASE\n`, state)
  for (const [index, release] of catalog.releases.entries()) {
    const asset = options.verbose ? release.compatibleAsset ?? 'no' : release.compatible ? 'yes' : 'no'
    write(`${release.version.padEnd(versionWidth)}  ${release.channel.padEnd(channelWidth)}  ${(release.publishedAt.slice(0, 10) || '-').padEnd(10)}  ${markerValues[index]?.padEnd(markerWidth)}  ${asset.padEnd(5)}  ${release.tag.padEnd(tagWidth)}  ${release.releaseUrl}\n`, state)
  }
  for (const warning of catalog.warnings) writeError(`warning: ${warning}\n`, state)
}

async function runUpgrade(options: MirrorCliOptions, state: CliState): Promise<void> {
  const request = { version: options.upgradeVersion, arch: options.arch, variant: options.variant, dryRun: options.dryRun }
  const text = options.format !== 'json'
  if (text) {
    write('------------------------------------------------------------\n', state)
    write('  Upgrading the CLI\n', state)
    write('------------------------------------------------------------\n', state)
    write('Resolving target...\n', state)
  }

  let result: MirrorUpgradeResult
  try {
    const plan = await resolveUpgradePlan(request)
    if (text) {
      write(`  current : ${plan.currentVersion}\n`, state)
      write(`  target  : ${plan.targetVersion}\n`, state)
      write(`  os      : ${plan.platform}\n`, state)
      write(`  arch    : ${plan.arch}\n`, state)
      write(`  binary  : ${plan.asset}\n`, state)
      write(`  path    : ${plan.executablePath}\n`, state)
      write(`  url     : ${plan.downloadUrl}\n`, state)
      write('------------------------------------------------------------\n', state)
    }
    result = await executeUpgrade(plan, {
      onEvent: text ? (event) => {
        if (event.status !== 'started') return
        if (event.phase === 'download') write('Downloading...\n', state)
        if (event.phase === 'validate') write('Validating...\n', state)
        if (event.phase === 'replace') write('Replacing...\n', state)
        if (event.phase === 'verify') write('Verifying...\n', state)
      } : undefined,
    })
  } catch (error) {
    result = createUpgradeResolutionFailure(error)
  }

  if (!text) {
    write(`${JSON.stringify(publicUpgradeEnvelope(result), null, 2)}\n`, state)
    if (result.outcome === 'failed' || result.outcome === 'rolled-back') process.exitCode = 1
    return
  }

  reportUpgradeOutcome(result, state)
  reportUpgradeRecovery(result.recovery, state)
  if (result.outcome === 'failed' || result.outcome === 'rolled-back') process.exitCode = 1
}

function reportUpgradeOutcome(result: MirrorUpgradeResult, state: CliState): void {
  if (result.outcome === 'upgraded' && result.plan) write(`Upgrade complete: ${result.plan.currentVersion} -> ${result.installedVersion}\n`, state)
  if (result.outcome === 'up-to-date') write(`Already up to date: ${result.installedVersion}\n`, state)
  if (result.outcome === 'dry-run') write('Dry run complete; no files were changed.\n', state)
  if (result.outcome === 'rolled-back') writeError(`Upgrade failed and was rolled back: ${result.failure?.message ?? 'unknown failure'}\n`, state)
  if (result.outcome === 'failed') writeError(`Upgrade failed: ${result.failure?.message ?? 'unknown failure'}\n`, state)
  if (result.failure?.rollbackAttempted) {
    writeError(`Rollback attempted: yes\nRollback succeeded: ${result.failure.rollbackSucceeded ? 'yes' : 'no'}\n`, state)
    if (result.failure.preservedPaths.length > 0) {
      writeError('Preserved recovery artifacts:\n', state)
      for (const path of result.failure.preservedPaths) writeError(`  ${path}\n`, state)
    }
  }
  for (const warning of result.warnings) writeError(`warning [${warning.code}]: ${warning.message}\n`, state)
  if (result.cleanupPending) write('Cleanup pending: the verified upgrade is active; only old-backup deletion remains.\n', state)
}

function reportUpgradeRecovery(recovery: MirrorUpgradeRecovery, state: CliState): void {
  if (recovery.targetSource === 'fallback-current') {
    write(`\nRepair reinstall for installed Mirror ${recovery.targetVersion} (upgrade target was not resolved):\n`, state)
    write(`  ${recovery.installCommand}\n`, state)
    write('\nIf a running Mirror process blocks installation, stop it first:\n', state)
    write(`  ${recovery.stopProcessCommand}\n`, state)
    write('Then rerun the same pinned repair command above.\n', state)
    return
  }
  write(`\nIf the upgrade did not work, install Mirror ${recovery.targetVersion} directly:\n`, state)
  write(`  ${recovery.installCommand}\n`, state)
  write('\nIf a running Mirror process blocks installation, stop it first:\n', state)
  write(`  ${recovery.stopProcessCommand}\n`, state)
  write('Then rerun the same pinned install command above.\n', state)
}

function publicUpgradeEnvelope(result: MirrorUpgradeResult) {
  const failedEvent = [...result.events].reverse().find((event) => event.status === 'failed')
  return {
    schemaVersion: result.schemaVersion,
    command: result.command,
    outcome: result.outcome,
    plan: result.plan
      ? {
        currentVersion: result.plan.currentVersion,
        targetVersion: result.plan.targetVersion,
        targetTag: result.plan.targetTag,
        platform: result.plan.platform,
        arch: result.plan.arch,
        variant: result.plan.variant,
        asset: result.plan.asset,
        downloadUrl: result.plan.downloadUrl,
        executablePath: result.plan.executablePath,
        dryRun: result.plan.dryRun,
        upToDate: result.plan.upToDate,
      }
      : null,
    events: result.events,
    result: result.plan
      ? {
        installedVersion: result.installedVersion,
        rolledBack: result.outcome === 'rolled-back',
        cacheUpdated: result.cacheUpdated,
        cleanupPending: result.cleanupPending,
        warnings: result.warnings,
      }
      : null,
    recovery: result.recovery,
    error: result.failure
      ? {
        phase: failedEvent?.phase ?? 'plan',
        code: result.failure.code,
        message: result.failure.message,
        rollbackAttempted: result.failure.rollbackAttempted,
        rollbackSucceeded: result.failure.rollbackSucceeded,
        preservedPaths: result.failure.preservedPaths,
      }
      : null,
  }
}

async function runUninstall(options: MirrorCliOptions, state: CliState): Promise<void> {
  const result = await uninstallSelf({ dryRun: options.dryRun })
  if (options.format === 'json') {
    write(`${JSON.stringify(result, null, 2)}\n`, state)
    return
  }
  write('mirror uninstall\n', state)
  write(`path: ${result.executablePath}\n`, state)
  if (result.dryRun) {
    write('dry_run: true\n', state)
    return
  }
  write(result.scheduled ? 'Uninstall scheduled after this mirror process exits.\n' : 'Uninstall complete.\n', state)
}

function resolveCliOptions(state: CliState, args: CliArgs): MirrorCliOptions {
  const formatValue = mergedStringArg(state, args, 'format')
  const toolValue = mergedStringArg(state, args, 'tool')
  const upgradeVersion = stringArg(args, 'version')
  const outputValues = repeatableArg(state.rawArgs, 'output')
  const auxiliaryValues = repeatableArg(state.rawArgs, 'auxiliary')

  return {
    cwd: mergedStringArg(state, args, 'cwd'),
    config: mergedStringArg(state, args, 'config'),
    format: formatValue ? assertFormat(formatValue, state) : undefined,
    noColor: mergedBooleanArg(state, args, 'color') === false,
    source: optionalAdapter(mergedStringArg(state, args, 'source'), '--source', state),
    output: outputValues.length > 0 ? outputValues.map((value) => assertAdapter(value, '--output', state)) : undefined,
    packageFile: mergedStringArg(state, args, 'packageFile'),
    jsrFile: mergedStringArg(state, args, 'jsrFile'),
    auxiliary: auxiliaryValues.length > 0 ? auxiliaryValues : undefined,
    tagTemplate: mergedStringArg(state, args, 'tagTemplate'),
    name: mergedStringArg(state, args, 'name'),
    preid: mergedStringArg(state, args, 'preid'),
    dryRun: Boolean(mergedBooleanArg(state, args, 'dryRun')),
    commit: Boolean(mergedBooleanArg(state, args, 'commit')),
    push: Boolean(mergedBooleanArg(state, args, 'push')),
    allowDirty: Boolean(mergedBooleanArg(state, args, 'allowDirty')),
    nonInteractive: Boolean(mergedBooleanArg(state, args, 'nonInteractive')),
    yes: Boolean(mergedBooleanArg(state, args, 'yes')),
    verbose: Boolean(mergedBooleanArg(state, args, 'verbose')),
    tool: toolValue ? assertAgentToolSelection(toolValue, '--tool', state) : undefined,
    upgradeVersion,
    arch: mergedStringArg(state, args, 'arch'),
    variant: mergedStringArg(state, args, 'variant'),
  }
}

async function printCittyHelp(command: CommandDef<any>, options: MirrorCliOptions, state: CliState): Promise<void> {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const discovery = await discoverMirrorConfig(cwd, options.config)
  const configDisplay = discovery.path ? relativeFromCwd(cwd, discovery.path) : ''
  write(mirrorBanner(configDisplay), state)
  await printCachedUpdateNotice(state)
  write(`${await renderUsage(command)}\n`, state)
}

async function printCachedUpdateNotice(state: CliState): Promise<void> {
  const cache = await readUpdateCache()
  if (!cache?.updateAvailable) return
  if (compareVersions(cache.latestVersion, mirrorVersion) <= 0) return
  writeError(`notice: Mirror ${cache.latestVersion} is available. Run \`mirror upgrade\` to update.\n`, state)
}

async function prepareAgents(options: MirrorCliOptions): Promise<void> {
  await runMirrorAgentAutomation(options, (message) => console.error(message))
}

async function handleCliError(error: unknown, state: CliState): Promise<void> {
  if (isCittyUsageError(error)) {
    const message = normalizeCittyUsageMessage(stripAnsi(error.message), state)
    error = new MirrorUsageError(message, state.usagePath)
  }

  if (error instanceof MirrorUsageError) {
    writeError(`error: ${error.message}\n\n`, state)
    writeError(`${await renderUsage(state.usageCommand)}\n`, state)
    if (state.verbose) writeError(`${error.stack ?? ''}\n`, state)
    process.exitCode = error.exitCode
    return
  }

  if (error instanceof MirrorError) {
    writeError(`error: ${error.message}\n`, state)
    if (state.verbose) writeError(`${error.stack ?? ''}\n`, state)
    process.exitCode = error.exitCode
    return
  }

  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  writeError(`error: ${message}\n`, state)
  if (state.verbose && error instanceof Error) writeError(`${error.stack ?? ''}\n`, state)
  process.exitCode = 1
}

function resolveUsagePath(positionals: string[], commands: Map<string, CommandDef<any>>): string[] {
  for (let length = positionals.length; length > 0; length -= 1) {
    const candidate = positionals.slice(0, length)
    if (commands.has(candidate.join(' '))) return candidate
  }
  return []
}

function assertKnownArguments(args: CliArgs, state: CliState): void {
  const unknown = Object.keys(args).find((key) => !allKnownArgumentKeys.has(key))
  if (unknown) throw usageError(state, `Unknown option --${unknown}`)
}

function assertPositionalCount(args: CliArgs, count: number, state: CliState): void {
  if (args._.length <= count) return
  throw usageError(state, `Unexpected positional argument: ${args._[count]}`)
}

function assertAllowedFlags(
  rawArgs: string[],
  argsDefinition: Record<string, { readonly type?: string, readonly alias?: string | readonly string[] }>,
  state: CliState,
): void {
  const allowed = new Set<string>()
  for (const [name, definition] of Object.entries(argsDefinition)) {
    if (definition.type === 'positional') continue
    allowed.add(`--${name}`)
    if (name === 'color') allowed.add('--no-color')
    const aliases = Array.isArray(definition.alias) ? definition.alias : definition.alias ? [definition.alias] : []
    for (const alias of aliases) allowed.add(`-${alias}`)
  }

  for (const token of rawArgs) {
    if (token === '--') break
    if (!token.startsWith('-')) continue
    const flag = token.split('=', 1)[0] ?? token
    if (!allowed.has(flag)) throw usageError(state, `Unknown option ${flag}`)
  }
}

function validateStringFlagValues(rawArgs: string[], state: CliState): void {
  const valueFlags = new Set(['--arch', '--auxiliary', '--config', '--cwd', '--format', '--jsr-file', '--name', '--output', '--package-file', '--preid', '--source', '--tag-template', '--tool', '--variant'])
  for (const [index, token] of rawArgs.entries()) {
    if (!valueFlags.has(token)) continue
    const value = rawArgs[index + 1]
    if (!value || value.startsWith('-')) throw usageError(state, `Missing value for ${token}`)
  }
}

function repeatableArg(rawArgs: string[], name: 'output' | 'auxiliary'): string[] {
  const longFlag = `--${name}`
  return rawArgs.flatMap((token, index) => {
    if (token === longFlag) {
      const value = rawArgs[index + 1]
      return value && !value.startsWith('-') ? splitList(value) : []
    }
    if (token.startsWith(`${longFlag}=`)) return splitList(token.slice(longFlag.length + 1))
    return []
  })
}

function normalizeCompatibilityArgs(rawArgs: string[]): string[] {
  return rawArgs.map((token) => token === '-dy' ? '--dry-run' : token)
}

function mergedStringArg(state: CliState, args: CliArgs, name: string): string | undefined {
  return stringArg(args, name) ?? stringArg(state.inheritedArgs, name) ?? stringArg(state.rootArgs, name)
}

function mergedBooleanArg(state: CliState, args: CliArgs, name: string): boolean | undefined {
  return booleanArg(args, name) ?? booleanArg(state.inheritedArgs, name) ?? booleanArg(state.rootArgs, name)
}

function stringArg(args: CliArgs, name: string): string | undefined {
  const value = args[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function booleanArg(args: CliArgs, name: string): boolean | undefined {
  const value = args[name]
  return typeof value === 'boolean' ? value : undefined
}

function requireStringArg(args: CliArgs, name: string, state: CliState, message: string): string {
  const value = stringArg(args, name)
  if (!value) throw usageError(state, message)
  return value
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function optionalAdapter(value: string | undefined, flagName: string, state: CliState): MirrorAdapterName | undefined {
  return value ? assertAdapter(value, flagName, state) : undefined
}

function assertAdapter(value: string, flagName: string, state: CliState): MirrorAdapterName {
  if (value !== 'package.json' && value !== 'jsr.json' && value !== 'git') throw usageError(state, `Invalid ${flagName} value: ${value}`)
  return value
}

function assertFormat(value: string, state: CliState): MirrorFormat {
  if (value !== 'text' && value !== 'json') throw usageError(state, `Invalid --format value: ${value}`)
  return value
}

function assertAgentToolSelection(value: string, flagName: string, state: CliState): MirrorAgentToolSelection {
  if (value !== 'agents' && value !== 'claude' && value !== 'all') throw usageError(state, `Invalid ${flagName} value: ${value}`)
  return value
}

function adapterArg(value: string | undefined): MirrorAdapterName | undefined {
  if (value === 'package.json' || value === 'jsr.json' || value === 'git') return value
  return undefined
}

function usageError(state: CliState, message: string): MirrorUsageError {
  return new MirrorUsageError(message, state.usagePath)
}

function compareVersions(a: string, b: string): number {
  const left = a.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const right = b.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function isCittyUsageError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'CLIError'
}

function normalizeCittyUsageMessage(message: string, state: CliState): string {
  if (message === 'Missing required positional argument: TARGET') {
    return 'Missing release target. Expected a release type or exact semantic version.'
  }
  if (message.startsWith('Unknown command ')) {
    const unknown = message.slice('Unknown command '.length)
    return `Unknown command: ${[...state.usagePath, unknown].join(' ')}`
  }
  return message
}

function write(value: string, state: CliState): void {
  process.stdout.write(state.noColor ? stripAnsi(value) : value)
}

function writeError(value: string, state: CliState): void {
  process.stderr.write(state.noColor ? stripAnsi(value) : value)
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
}

function stripColorFromConsoleOutput(): () => void {
  const originalLog = console.log
  const originalError = console.error
  console.log = (...values: unknown[]) => originalLog(...values.map(stripAnsiValue))
  console.error = (...values: unknown[]) => originalError(...values.map(stripAnsiValue))
  return () => {
    console.log = originalLog
    console.error = originalError
  }
}

function stripAnsiValue(value: unknown): unknown {
  return typeof value === 'string' ? stripAnsi(value) : value
}
