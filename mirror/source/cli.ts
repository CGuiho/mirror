/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { defineCommand, renderUsage, runCommand as runCittyCommand } from 'citty'
import { readCurrentVersion, resolveProjectName } from './adapters.js'
import {
  ensureMirrorAgentInstructionFiles,
  installMirrorSkills,
  listMirrorSkills,
  mirrorPromptCatalog,
  removeMirrorAgentInstructionFiles,
  showMirrorInstructionTemplate,
  showMirrorPrompt,
  showMirrorSkill,
  uninstallMirrorSkills,
} from './agents.js'
import { configPathForDisplay, loadMirrorConfig, writeInitConfigFromAnswers } from './config.js'
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
  detectNativePlatform,
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
import type { MirrorAdapterName, MirrorCliOptions, MirrorFormat, MirrorHookResult, MirrorInitFlags, MirrorUpgradeRecovery, MirrorUpgradeResult } from './types.js'

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
const mirrorPlatformName = (() => {
  switch (detectNativePlatform()) {
    case 'windows': return 'Windows'
    case 'linux': return 'Linux'
    case 'darwin': return 'macOS'
  }
})()

const commonArgs = {
  cwd: { type: 'string', description: 'Run as if Mirror started in this directory.', valueHint: 'path' },
  config: { type: 'string', description: 'Use this mirror.yaml file.', valueHint: 'path' },
  format: { type: 'string', description: 'Select text or JSON output.', valueHint: 'text|json' },
  color: { type: 'boolean', description: 'Enable ANSI color output.', negativeDescription: 'Disable ANSI color output.' },
  verbose: { type: 'boolean', description: 'Show full error details.' },
  help: { type: 'boolean', alias: 'h', description: 'Show command help.' },
  'help-tree': { type: 'boolean', description: 'Show the command tree from the current command.' },
  'help-tree-depth': { type: 'string', description: 'Limit command-tree recursion to a positive integer.', valueHint: 'depth' },
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
  'dry-run': { type: 'boolean', description: 'Build the plan without applying it.' },
  commit: { type: 'boolean', description: 'Create a release commit when file outputs changed.' },
  push: { type: 'boolean', description: 'Push release refs.' },
  'allow-dirty': { type: 'boolean', description: 'Allow a dirty Git worktree.' },
  yes: { type: 'boolean', description: 'Apply without interactive confirmation.' },
} as const

const initArgs = {
  ...commonArgs,
  ...adapterArgs,
  commit: { type: 'boolean', description: 'Enable release commits.' },
  push: { type: 'boolean', description: 'Enable release pushes.' },
  'non-interactive': { type: 'boolean', description: 'Skip interactive prompts.' },
  yes: { type: 'boolean', description: 'Allow reconciliation without confirmation.' },
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
  'dry-run': { type: 'boolean', description: 'Preview the selected binary without replacing it.' },
} as const

const upgradeListArgs = {
  ...commonArgs,
  arch: { type: 'string', description: 'Override compatibility architecture.', valueHint: 'x64|arm64' },
  variant: { type: 'string', description: 'Override the x64 compatibility variant.', valueHint: 'baseline|default|modern' },
  page: { type: 'string', description: 'Fetch one positive release page.', valueHint: 'page' },
  'per-page': { type: 'string', description: 'Number of releases per page.', valueHint: 'count' },
  'pre-releases': { type: 'boolean', description: 'Include prerelease versions.' },
} as const

const uninstallArgs = {
  ...commonArgs,
  'dry-run': { type: 'boolean', description: 'Show the executable path without deleting it.' },
} as const

const allKnownArgumentKeys = new Set([
  '_',
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
  'filter',
  'format',
  'h',
  'help',
  'help-docs',
  'help-tree',
  'help-tree-depth',
  'helpTreeDepth',
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
  'local',
  'names',
  'page',
  'per-page',
  'perPage',
  'pre-releases',
  'preReleases',
  'v',
  'variant',
  'verbose',
  'version',
  'yes',
])

function createMirrorCommand(): CommandDef<any> {
  return createMirrorCommandTree([]).command
}

async function runMirrorCli(rawArgs = process.argv.slice(2)): Promise<void> {
  const normalizedArgs = rawArgs
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

  const agentScopeArgs = {
    ...commonArgs,
    local: { type: 'boolean', description: 'Use project-local agent directories instead of global directories.' },
  } as const
  const agentSkillInstallCommand = defineCommand({
    meta: { name: 'mirror agent skill install', description: 'Install the bundled Mirror skill into both agent tools.' },
    args: agentScopeArgs,
    setup: withLeafCommand(state, ['agent', 'skill', 'install'], 0, agentScopeArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const scope = options.local ? 'local' : 'global'
      const results = await installMirrorSkills(scope, 'all', { cwd: resolvePath(options.cwd ?? process.cwd()), overwrite: false })
      write(reportSkillInstall(results, options.format), state)
    },
  })
  const agentSkillUpdateCommand = defineCommand({
    meta: { name: 'mirror agent skill update', description: 'Refresh the bundled Mirror skill in both agent tools.' },
    args: agentScopeArgs,
    setup: withLeafCommand(state, ['agent', 'skill', 'update'], 0, agentScopeArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const scope = options.local ? 'local' : 'global'
      write(reportSkillInstall(await installMirrorSkills(scope, 'all', {
        cwd: resolvePath(options.cwd ?? process.cwd()),
        overwrite: true,
      }), options.format), state)
    },
  })
  const agentSkillUninstallCommand = defineCommand({
    meta: { name: 'mirror agent skill uninstall', description: 'Remove Mirror skills from both agent tools.' },
    args: agentScopeArgs,
    setup: withLeafCommand(state, ['agent', 'skill', 'uninstall'], 0, agentScopeArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const removed = await uninstallMirrorSkills(options.local ? 'local' : 'global', { cwd: resolvePath(options.cwd ?? process.cwd()) })
      write(reportValue({ removed }, options.format), state)
    },
  })
  const agentSkillListArgs = {
    ...commonArgs,
    filter: { type: 'string', description: 'Filter skills by keyword.', valueHint: 'keyword' },
  } as const
  const agentSkillListCommand = defineCommand({
    meta: { name: 'mirror agent skill list', description: 'List embedded Mirror skills.' },
    args: agentSkillListArgs,
    setup: withLeafCommand(state, ['agent', 'skill', 'list'], 0, agentSkillListArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const resources = await listMirrorSkills(options.filter)
      write(options.format === 'json'
        ? reportValue(resources, 'json')
        : `${resources.map((resource) => `${resource.id}\t${resource.description}`).join('\n')}\n`, state)
    },
  })
  const resourceShowArgs = {
    id: { type: 'positional', description: 'Embedded resource identifier.', required: true, valueHint: 'id' },
    ...commonArgs,
  } as const
  const agentSkillShowCommand = defineCommand({
    meta: { name: 'mirror agent skill show', description: 'Show embedded skill metadata.' },
    args: resourceShowArgs,
    setup: withLeafCommand(state, ['agent', 'skill', 'show'], 1, resourceShowArgs),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
      const resource = await showMirrorSkill(requireStringArg(args, 'id', state, 'Missing skill id.'))
      const metadata = {
        id: resource.id,
        name: resource.name,
        description: resource.description,
        version: resource.version,
        path: resource.path,
      }
      write(options.format === 'json'
        ? reportValue(metadata, 'json')
        : `id: ${metadata.id}\nname: ${metadata.name}\ndescription: ${metadata.description}\nversion: ${metadata.version}\npath: ${metadata.path}\n`, state)
    },
  })
  const agentSkillCommand = defineCommand({
    meta: { name: 'mirror agent skill', description: 'Manage the embedded Mirror skill.' },
    args: commonArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror agent skill'),
      install: agentSkillInstallCommand,
      uninstall: agentSkillUninstallCommand,
      update: agentSkillUpdateCommand,
      list: agentSkillListCommand,
      show: agentSkillShowCommand,
    },
    setup: withGroupCommand(state, ['agent', 'skill']),
  })
  const instructionMutation = async (args: CliArgs, remove: boolean) => {
    const options = resolveCliOptions(state, args)
    const cwd = resolvePath(options.cwd ?? process.cwd())
    const results = remove
      ? await removeMirrorAgentInstructionFiles(cwd)
      : await ensureMirrorAgentInstructionFiles(cwd, 'agents', true, true)
    write(reportAgentsInstructions(results, options.format), state)
  }
  const agentInstructionApplyCommand = defineCommand({
    meta: { name: 'mirror agent instruction apply', description: 'Apply the managed Mirror instruction block.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['agent', 'instruction', 'apply'], 0, commonArgs),
    run: async ({ args }) => instructionMutation(args, false),
  })
  const agentInstructionRemoveCommand = defineCommand({
    meta: { name: 'mirror agent instruction remove', description: 'Remove the managed Mirror instruction block.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['agent', 'instruction', 'remove'], 0, commonArgs),
    run: async ({ args }) => instructionMutation(args, true),
  })
  const agentInstructionUpdateCommand = defineCommand({
    meta: { name: 'mirror agent instruction update', description: 'Reconcile the managed Mirror instruction block.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['agent', 'instruction', 'update'], 0, commonArgs),
    run: async ({ args }) => instructionMutation(args, false),
  })
  const agentInstructionShowCommand = defineCommand({
    meta: { name: 'mirror agent instruction show', description: 'Print the raw Mirror instruction template.' },
    args: commonArgs,
    setup: withLeafCommand(state, ['agent', 'instruction', 'show'], 0, commonArgs),
    run: () => write(showMirrorInstructionTemplate(), state),
  })
  const agentInstructionCommand = defineCommand({
    meta: { name: 'mirror agent instruction', description: 'Manage Mirror instruction blocks.' },
    args: commonArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror agent instruction'),
      apply: agentInstructionApplyCommand,
      remove: agentInstructionRemoveCommand,
      update: agentInstructionUpdateCommand,
      show: agentInstructionShowCommand,
    },
    setup: withGroupCommand(state, ['agent', 'instruction']),
  })
  const promptListArgs = {
    ...commonArgs,
    names: { type: 'boolean', description: 'Print prompt names only.' },
  } as const
  const agentPromptListCommand = defineCommand({
    meta: { name: 'mirror agent prompt list', description: 'List embedded Mirror prompts.' },
    args: promptListArgs,
    setup: withLeafCommand(state, ['agent', 'prompt', 'list'], 0, promptListArgs),
    run: ({ args }) => {
      const options = resolveCliOptions(state, args)
      const value = options.names ? mirrorPromptCatalog.map((prompt) => prompt.name).join('\n') : mirrorPromptCatalog
      write(options.names ? `${value}\n` : reportValue(value, options.format), state)
    },
  })
  const agentPromptShowCommand = defineCommand({
    meta: { name: 'mirror agent prompt show', description: 'Print a raw embedded Mirror prompt.' },
    args: resourceShowArgs,
    setup: withLeafCommand(state, ['agent', 'prompt', 'show'], 1, resourceShowArgs),
    run: async ({ args }) => write(await showMirrorPrompt(requireStringArg(args, 'id', state, 'Missing prompt id.')), state),
  })
  const agentPromptCommand = defineCommand({
    meta: { name: 'mirror agent prompt', description: 'Inspect embedded Mirror prompts.' },
    args: commonArgs,
    default: '_help',
    subCommands: { _help: createGroupHelpCommand(state, 'mirror agent prompt'), list: agentPromptListCommand, show: agentPromptShowCommand },
    setup: withGroupCommand(state, ['agent', 'prompt']),
  })
  const agentCommand = defineCommand({
    meta: { name: 'mirror agent', description: 'Manage Mirror agent resources.' },
    args: commonArgs,
    default: '_help',
    subCommands: {
      _help: createGroupHelpCommand(state, 'mirror agent'),
      skill: agentSkillCommand,
      instruction: agentInstructionCommand,
      prompt: agentPromptCommand,
    },
    setup: withGroupCommand(state, ['agent']),
  })

  const versionCurrentCommand = defineCommand({
    meta: { name: 'mirror version current', description: 'Print the current project version.' },
    args: { ...commonArgs, ...adapterArgs },
    setup: withLeafCommand(state, ['version', 'current'], 0, { ...commonArgs, ...adapterArgs }),
    run: async ({ args }) => {
      const options = resolveCliOptions(state, args)
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
    setup: withLeafCommand(state, ['uninstall'], 0, uninstallArgs),
    run: async ({ args }) => runUninstall(resolveCliOptions(state, args), state),
  })

  const initCommand = defineCommand({
    meta: { name: 'mirror init', description: 'Create or reconcile mirror.yaml.' },
    args: initArgs,
    setup: withLeafCommand(state, ['init'], 0, initArgs),
    run: async ({ args }) => runInit(resolveCliOptions(state, args), undefined, state),
  })

  const homeCommand = defineCommand({
    meta: { name: 'mirror', description: 'Show the Mirror home page.', hidden: true },
    args: rootArgs,
    run: async () => {
      write(`Hello ${mirrorPlatformName} - mirror v${mirrorVersion}\n`, state)
    },
  })

  const command = defineCommand({
    meta: {
      name: 'mirror',
      version: mirrorVersion,
      description: 'Deterministic semantic versioning for GUIHO projects.',
    },
    args: rootArgs,
    default: '_home',
    subCommands: {
      _home: homeCommand,
      init: initCommand,
      config: configCommand,
      agent: agentCommand,
      version: versionCommand,
      upgrade: upgradeCommand,
      uninstall: uninstallCommand,
    },
    setup: async (context) => {
      state.rootArgs = context.args
      state.usageCommand = command
      state.usagePath = resolveUsagePath(context.args._, state.usageCommands)
      state.usageCommand = state.usageCommands.get(state.usagePath.join(' ')) ?? command
      state.noColor = booleanArg(context.args, 'color') === false || rawArgs.includes('--no-color')
      state.verbose = Boolean(booleanArg(context.args, 'verbose'))
      assertKnownArguments(context.args, state)
      validateStringFlagValues(rawArgs, state)

      if (rawArgs.includes('--mirror-update-check-worker')) {
        await runBackgroundUpdateCheck()
        throw new CliHandled()
      }

      if (rawArgs.length === 1 && (booleanArg(context.args, 'version') || booleanArg(context.args, 'v'))) {
        write(`${mirrorVersion}\n`, state)
        throw new CliHandled()
      }

      const options = resolveCliOptions(state, context.args)
      if (booleanArg(context.args, 'helpTree')) {
        write(`${showMirrorCommandHelpTree(state.usageCommand, options.helpTreeDepth)}\n`, state)
        throw new CliHandled()
      }
      if (booleanArg(context.args, 'helpDocs')) {
        write(showMirrorCommandHelpDocs(state.usageCommand), state)
        throw new CliHandled()
      }
      if (booleanArg(context.args, 'help') || booleanArg(context.args, 'h')) {
        await printCittyHelp(state.usageCommand, state)
        throw new CliHandled()
      }

      await printCachedUpdateNotice(state)
      void scheduleBackgroundUpdateCheck()
    },
  })

  const commands: Array<[string, CommandDef<any>]> = [
    ['init', initCommand],
    ['config', configCommand],
    ['config show', configShowCommand],
    ['config check', configCheckCommand],
    ['config schema', configSchemaCommand],
    ['agent', agentCommand],
    ['agent skill', agentSkillCommand],
    ['agent skill install', agentSkillInstallCommand],
    ['agent skill uninstall', agentSkillUninstallCommand],
    ['agent skill update', agentSkillUpdateCommand],
    ['agent skill list', agentSkillListCommand],
    ['agent skill show', agentSkillShowCommand],
    ['agent instruction', agentInstructionCommand],
    ['agent instruction apply', agentInstructionApplyCommand],
    ['agent instruction remove', agentInstructionRemoveCommand],
    ['agent instruction update', agentInstructionUpdateCommand],
    ['agent instruction show', agentInstructionShowCommand],
    ['agent prompt', agentPromptCommand],
    ['agent prompt list', agentPromptListCommand],
    ['agent prompt show', agentPromptShowCommand],
    ['version', versionCommand],
    ['version current', versionCurrentCommand],
    ['version next', versionNextCommand],
    ['version plan', versionPlanCommand],
    ['version apply', versionApplyCommand],
    ['upgrade', upgradeCommand],
    ['upgrade check', upgradeCheckCommand],
    ['upgrade list', upgradeListCommand],
    ['uninstall', uninstallCommand],
  ]
  for (const [path, definition] of commands) state.usageCommands.set(path, definition)
  state.usageCommand = command

  return { command, state }
}

function createGroupHelpCommand(state: CliState, name: string): CommandDef<any> {
  return defineCommand({
    meta: { name, description: 'Show command help.', hidden: true },
    args: commonArgs,
    run: async () => {
      await printCittyHelp(state.usageCommand, state)
    },
  })
}

function withGroupCommand(state: CliState, path: string[]): (context: CommandContext<any>) => void {
  return (context) => {
    state.inheritedArgs = context.args
    if (state.usagePath.length <= path.length) {
      state.usageCommand = context.cmd
      state.usagePath = path
    }
  }
}

function withLeafCommand(
  state: CliState,
  path: string[],
  positionalCount: number,
  argsDefinition: Record<string, { readonly type?: string, readonly alias?: string | readonly string[] }>,
): (context: CommandContext<any>) => void {
  return (context) => {
    state.usageCommand = context.cmd
    state.usagePath = path
    assertAllowedFlags(context.rawArgs, argsDefinition, state)
    assertPositionalCount(context.args, positionalCount, state)
  }
}

async function runInit(options: MirrorCliOptions, positionalSource: MirrorAdapterName | undefined, state: CliState): Promise<void> {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const flags: MirrorInitFlags = {
    source: options.source ?? positionalSource,
    output: options.output,
    packagePath: options.packageFile,
    auxiliaryPaths: options.auxiliary,
    jsrPath: options.jsrFile,
    tagTemplate: options.tagTemplate,
    name: options.name,
    prereleaseId: options.preid,
    commit: options.commit ? true : undefined,
    push: options.push ? true : undefined,
  }
  const interactive = isInteractiveInit(options)
  const prompter = interactive ? createReadlineInitPrompter() : undefined

  try {
    const answers = await resolveInitAnswers(flags, cwd, prompter)
    const path = await writeInitConfigFromAnswers(answers, cwd, Boolean(options.yes))
    write(reportValue(`created ${path}`, options.format), state)
  } finally {
    await prompter?.close()
  }
}

async function runApply(target: string, options: MirrorCliOptions, state: CliState): Promise<void> {
  const config = await loadMirrorConfig(options)
  const hooks = config.hooks
  const hookResults: MirrorHookResult[] = []
  const baseEnv = hookEnvFromConfig(config, target)

  try {
    await runHooks('before:everything', hooks['before:everything'], baseEnv, config.cwd)
  } catch (error) {
    hookResults.push({
      name: 'before:everything',
      commands: hooks['before:everything'] ?? [],
      status: 'failure',
      durationMs: 0,
      exitCode: error instanceof MirrorError ? error.exitCode : 1,
      stderr: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  try {
    await runHooks('before:plan', hooks['before:plan'], baseEnv, config.cwd)
    const plan = await buildVersionPlan(target, options)
    const planEnv = hookEnvForPlan(plan, target)
    await runHooks('after:plan', hooks['after:plan'], planEnv, config.cwd)

    if (options.format !== 'json') write(mirrorBanner(plan.configPath ? plan.configPath : ''), state)
    if (options.format !== 'json') write(reportPlan(plan, options.format), state)
    await runHooks('before:apply', hooks['before:apply'], planEnv, config.cwd)

    try {
      const result = await executeVersionPlan(plan, options, hooks, target)
      result.hookResults = hookResults
      write(options.format === 'json' ? reportExecution(result, options.format) : reportExecutionSummary(result, options.format), state)
    } finally {
      const resultEnv = hookEnvForResult(plan, target, true, Boolean(options.dryRun))
      await runHooksQuiet('after:apply', hooks['after:apply'], resultEnv, config.cwd, hookResults)
    }
  } finally {
    await runHooksQuiet('after:everything', hooks['after:everything'], baseEnv, config.cwd, hookResults)
  }
}

async function runUpgradeCheck(options: MirrorCliOptions, state: CliState): Promise<void> {
  const result = await checkForLatestVersion()
  if (options.format === 'json') {
    write(`${JSON.stringify(result, null, 2)}\n`, state)
    return
  }
  write(`current: ${mirrorVersion}\n`, state)
  write(`latest: ${result.latestVersion}\n`, state)
  write(`update_available: ${String(result.newVersionAvailable)}\n`, state)
  if (result.newVersionAvailable) write(`Run: ${result.upgradeCommand ?? 'mirror upgrade'}\n`, state)
}

async function runUpgradeList(options: MirrorCliOptions, state: CliState): Promise<void> {
  const catalog = await listAvailableVersions({
    arch: options.arch,
    variant: options.variant,
    page: options.page,
    perPage: options.perPage,
    preReleases: options.preReleases,
  })
  if (options.format === 'json') {
    write(`${JSON.stringify(catalog, null, 2)}\n`, state)
    return
  }
  write('AVAILABLE MIRROR VERSIONS\n\n', state)
  if (catalog.releases.length === 0) {
    write('No published Mirror releases were found.\n', state)
    return
  }
  const versionWidth = Math.max('VERSION'.length, ...catalog.releases.map((release) => release.version.length))
  const channelWidth = Math.max('CHANNEL'.length, ...catalog.releases.map((release) => release.channel.length))
  const markerValues = catalog.releases.map((release) => [release.current ? 'current' : '', release.latestStable ? 'latest-stable' : ''].filter(Boolean).join(','))
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
    write('Initiating GUIHO CLI Upgrade / Installation Sequence...\n', state)
    write('Resolving target...\n', state)
  }

  let result: MirrorUpgradeResult
  try {
    const plan = await resolveUpgradePlan(request)
    if (text) {
      write(`  current : ${plan.currentVersion}\n`, state)
      write(`Target Version: v${plan.targetVersion}\n`, state)
      write(`Architecture:   ${plan.arch}\n`, state)
      write(`Variant:        ${plan.variant}\n`, state)
      write(`Source URL:     ${plan.downloadUrl}\n`, state)
      write(`Executable:     ${plan.executablePath}\n`, state)
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

  if (result.outcome === 'upgraded') {
    await installMirrorSkills('global', 'all', { overwrite: true })
    const cwd = resolvePath(options.cwd ?? process.cwd())
    await ensureMirrorAgentInstructionFiles(cwd, 'agents', false, true)
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
  const upgradeVersion = stringArg(args, 'version')
  const outputValues = repeatableArg(state.rawArgs, 'output')
  const auxiliaryValues = repeatableArg(state.rawArgs, 'auxiliary')

  return {
    cwd: mergedStringArg(state, args, 'cwd'),
    config: mergedStringArg(state, args, 'config'),
    format: formatValue ? assertFormat(formatValue, state) : undefined,
    helpTreeDepth: optionalPositiveInteger(mergedStringArg(state, args, 'helpTreeDepth'), '--help-tree-depth', state),
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
    local: Boolean(mergedBooleanArg(state, args, 'local')),
    filter: mergedStringArg(state, args, 'filter'),
    names: Boolean(mergedBooleanArg(state, args, 'names')),
    page: optionalPositiveInteger(mergedStringArg(state, args, 'page'), '--page', state),
    perPage: optionalPositiveInteger(mergedStringArg(state, args, 'perPage'), '--per-page', state),
    preReleases: Boolean(mergedBooleanArg(state, args, 'preReleases')),
    upgradeVersion,
    arch: mergedStringArg(state, args, 'arch'),
    variant: mergedStringArg(state, args, 'variant'),
  }
}

async function printCittyHelp(command: CommandDef<any>, state: CliState): Promise<void> {
  write(`${await renderUsage(command)}\n`, state)
}

async function printCachedUpdateNotice(state: CliState): Promise<void> {
  const cache = await readUpdateCache()
  if (!cache?.newVersionAvailable) return
  if (compareVersions(cache.latestVersion, mirrorVersion) <= 0) return
  write(`New version available. Run this command to upgrade: ${cache.upgradeCommand ?? 'mirror upgrade'}\n`, state)
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
  const valueFlags = new Set(['--arch', '--auxiliary', '--config', '--cwd', '--filter', '--format', '--help-tree-depth', '--jsr-file', '--name', '--output', '--package-file', '--page', '--per-page', '--preid', '--source', '--tag-template', '--variant'])
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

function optionalPositiveInteger(value: string | undefined, flagName: string, state: CliState): number | undefined {
  if (value === undefined) return undefined
  if (!/^[1-9]\d*$/.test(value)) throw usageError(state, `Invalid ${flagName} value: ${value}. Expected a positive integer.`)
  return Number.parseInt(value, 10)
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
