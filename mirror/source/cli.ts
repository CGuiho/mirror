/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { ensureMirrorAgentsInstructions, installMirrorSkill, runMirrorAgentAutomation } from './agents.js'
import { MirrorError } from './errors.js'
import { readCurrentVersion, resolveProjectName } from './adapters.js'
import { configPathForDisplay, discoverMirrorConfig, loadMirrorConfig, relativeFromCwd, writeInitConfigFromAnswers } from './config.js'
import { executeVersionPlan } from './executor.js'
import { parseMirrorCliOptions } from './flags.js'
import { createReadlineInitPrompter, isInteractiveInit, resolveInitAnswers } from './init.js'
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
import type { MirrorCliOptions, MirrorHookResult, MirrorInitFlags } from './types.js'
import { resolveNextVersion } from './version.js'
import { hookEnvForPlan, hookEnvForResult, hookEnvFromConfig, runHooks, runHooksQuiet } from './hooks.js'
import { resolvePath } from './path.js'
import packageJson from '../package.json' with { type: 'json' }

const mirrorVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'

type CommandContext = {
  rawArgs: string[]
  positional: string[]
  options: MirrorCliOptions
}

export const createMirrorCommand = () => ({ name: 'mirror', version: mirrorVersion })

export const runMirrorCli = async (rawArgs = process.argv.slice(2)) => {
  const effectiveArgs = rawArgs.length === 0 ? ['--help'] : rawArgs
  const verbose = effectiveArgs.includes('--verbose')
  const restoreColorOutput = effectiveArgs.includes('--no-color') ? stripColorFromProcessOutput() : () => {}

  try {
    if (effectiveArgs.includes('--no-color')) process.env['NO_COLOR'] = '1'
    if (rawArgs.length === 0) await prepareAgents({})

    const context = createCommandContext(effectiveArgs)
    if (context.options.noColor) process.env['NO_COLOR'] = '1'

    if (context.rawArgs.includes('--version')) {
      process.stdout.write(`${mirrorVersion}\n`)
      return
    }

    if (context.rawArgs.includes('--help')) {
      await printHelp(context)
      return
    }

    await runCommand(context)
  } catch (error) {
    handleCliError(error, verbose)
  } finally {
    restoreColorOutput()
  }
}

const runCommand = async (context: CommandContext) => {
  const [group, command, subcommand] = context.positional

  if (!group) {
    await printHelp(context)
    return
  }

  if (group === 'init') {
    await runInit(context)
    return
  }

  if (group === 'config' && command === 'show') {
    await prepareAgents(context.options)
    const config = await loadMirrorConfig(context.options)
    if (context.options.format !== 'json') process.stdout.write(mirrorBanner(configPathForDisplay(config)))
    process.stdout.write(reportConfig(config, context.options.format))
    return
  }

  if (group === 'config' && command === 'check') {
    await prepareAgents(context.options)
    await validateMirrorConfig(context.options)
    process.stdout.write(reportValue('ok', context.options.format))
    return
  }

  if (group === 'config' && command === 'schema') {
    if (context.options.format !== 'json') process.stdout.write(mirrorBanner())
    process.stdout.write(reportConfigSchema(context.options.format))
    return
  }

  if (group === 'agents' && command === 'install' && (subcommand === 'local' || subcommand === 'global')) {
    const result = await installMirrorSkill(subcommand, { cwd: resolvePath(context.options.cwd ?? process.cwd()) })
    process.stdout.write(reportSkillInstall(result, context.options.format))
    return
  }

  if (group === 'agents' && command === 'instructions') {
    const result = await ensureMirrorAgentsInstructions(resolvePath(context.options.cwd ?? process.cwd()), true)
    process.stdout.write(reportAgentsInstructions(result, context.options.format))
    return
  }

  if (group === 'version' && command === 'current') {
    await prepareAgents(context.options)
    const config = await loadMirrorConfig(context.options)
    const projectName = await resolveProjectName(config)
    process.stdout.write(reportValue(await readCurrentVersion(config, projectName), context.options.format))
    return
  }

  if (group === 'version' && command === 'next') {
    const target = requireTarget(context)
    await prepareAgents(context.options)
    const config = await loadMirrorConfig(context.options)
    const projectName = await resolveProjectName(config)
    const currentVersion = await readCurrentVersion(config, projectName)
    process.stdout.write(reportValue(resolveNextVersion(currentVersion, target, config.version.prereleaseId), context.options.format))
    return
  }

  if (group === 'version' && command === 'plan') {
    const target = requireTarget(context)
    await prepareAgents(context.options)
    const plan = await buildVersionPlan(target, context.options)
    if (context.options.format !== 'json') process.stdout.write(mirrorBanner(plan.configPath ? plan.configPath : ''))
    process.stdout.write(reportPlan(plan, context.options.format))
    return
  }

  if (group === 'version' && command === 'apply') {
    await runApply(context)
    return
  }

  throw new MirrorError(`Unknown command: ${context.positional.join(' ')}`)
}

const runInit = async (context: CommandContext) => {
  const cwd = resolvePath(context.options.cwd ?? process.cwd())
  const positionalSource = adapterArg(context.positional[1])
  const commitProvided = context.rawArgs.includes('--commit')
  const pushProvided = context.rawArgs.includes('--push')

  const flags: MirrorInitFlags = {
    source: context.options.source ?? positionalSource,
    output: context.options.output,
    packagePath: context.options.packageFile,
    auxiliaryPaths: context.options.auxiliary,
    jsrPath: context.options.jsrFile,
    tagTemplate: context.options.tagTemplate,
    name: context.options.name,
    prereleaseId: context.options.preid,
    commit: commitProvided ? context.options.commit : undefined,
    push: pushProvided ? context.options.push : undefined,
  }

  const interactive = isInteractiveInit(context.options)
  const prompter = interactive ? createReadlineInitPrompter() : undefined

  try {
    const answers = await resolveInitAnswers(flags, cwd, prompter)
    const path = await writeInitConfigFromAnswers(answers, cwd, Boolean(context.options.yes))
    process.stdout.write(reportValue(`created ${path}`, context.options.format))
  } finally {
    await prompter?.close()
  }
}

const runApply = async (context: CommandContext) => {
  const target = requireTarget(context)
  await prepareAgents(context.options)
  const config = await loadMirrorConfig(context.options)
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
    const plan = await buildVersionPlan(target, context.options)
    const planEnv = hookEnvForPlan(plan, target)
    await runHooks('after:plan', hooks['after:plan'], planEnv, config.cwd)

    if (context.options.format !== 'json') process.stdout.write(mirrorBanner(plan.configPath ? plan.configPath : ''))
    if (context.options.format !== 'json') process.stdout.write(reportPlan(plan, context.options.format))

    await runHooks('before:apply', hooks['before:apply'], planEnv, config.cwd)

    try {
      const result = await executeVersionPlan(plan, context.options, hooks, target)
      result.hookResults = hookResults
      process.stdout.write(context.options.format === 'json' ? reportExecution(result, context.options.format) : reportExecutionSummary(result, context.options.format))
    } finally {
      const resultEnv = hookEnvForResult(plan, target, true, Boolean(context.options.dryRun))
      await runHooksQuiet('after:apply', hooks['after:apply'], resultEnv, config.cwd, hookResults)
    }
  } finally {
    await runHooksQuiet('after:everything', hooks['after:everything'], baseEnv, config.cwd, hookResults)
  }
}

const createCommandContext = (rawArgs: string[]): CommandContext => {
  const options = parseMirrorCliOptions(rawArgs)
  const positional = collectPositionals(rawArgs)
  return { rawArgs, positional, options }
}

const collectPositionals = (rawArgs: string[]) => {
  const positional: string[] = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const token = rawArgs[index]
    if (!token) continue
    if (token.startsWith('--')) {
      const rawKey = token.slice(2).split('=', 1)[0] ?? ''
      if (!booleanFlags.has(rawKey) && !token.includes('=')) index += 1
      continue
    }
    if (shortBooleanFlags.has(token)) continue
    positional.push(token)
  }

  return positional
}

const printHelp = async (context: CommandContext) => {
  const cwd = resolvePath(context.options.cwd ?? process.cwd())
  const discovery = await discoverMirrorConfig(cwd, context.options.config)
  const configDisplay = discovery.path ? relativeFromCwd(cwd, discovery.path) : ''
  process.stdout.write(mirrorBanner(configDisplay))
  process.stdout.write([
    `mirror v${mirrorVersion}`,
    '',
    'USAGE',
    '',
    '  mirror init [package.json|jsr.json|git] [options]',
    '  mirror config show|check|schema [options]',
    '  mirror agents install local|global [options]',
    '  mirror agents instructions [options]',
    '  mirror version current [options]',
    '  mirror version next|plan|apply <target> [options]',
    '',
    'GLOBAL OPTIONS',
    '',
    '  --config <path>       Path to mirror.config.toml',
    '  --cwd <path>          Run as if Mirror started in this directory',
    '  --format text|json    Output format',
    '  --no-color            Disable color output',
    '  --verbose             Show full error details',
    '  --help                Show help',
    '  --version             Show version',
    '',
    'EXAMPLES',
    '',
    '  mirror version current',
    '  mirror version plan patch',
    '  mirror version apply minor --commit --yes',
    '  mirror version plan patch --output=package.json,jsr.json,git',
    '  mirror agents install local',
    '  mirror agents instructions',
    '  mirror config schema',
    '',
  ].join('\n'))
}

const requireTarget = (context: CommandContext) => {
  const target = context.positional[2]
  if (!target) throw new MirrorError('Missing release target. Expected a release type or exact semantic version.')
  return target
}

const adapterArg = (value: unknown) => {
  if (value === 'package.json' || value === 'jsr.json' || value === 'git') return value
  return undefined
}

const prepareAgents = async (options: MirrorCliOptions) => {
  await runMirrorAgentAutomation(options, (message) => console.error(message))
}

const handleCliError = (error: unknown, verbose: boolean): never => {
  if (error instanceof MirrorError) {
    console.error(`error: ${error.message}`)
    if (verbose) console.error(error.stack)
    process.exit(error.exitCode)
  }

  if (error instanceof Error) {
    console.error(`error: ${error.message}`)
    if (verbose) console.error(error.stack)
  } else {
    console.error('error: An unexpected error occurred.')
    if (verbose) console.error(error)
  }

  process.exit(1)
}

const stripAnsi = (value: string) => value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')

const stripColorFromProcessOutput = () => {
  const originalLog = console.log
  const originalError = console.error

  console.log = (...values: unknown[]) => originalLog(...values.map(stripAnsiValue))
  console.error = (...values: unknown[]) => originalError(...values.map(stripAnsiValue))

  return () => {
    console.log = originalLog
    console.error = originalError
  }
}

const stripAnsiValue = (value: unknown) => (typeof value === 'string' ? stripAnsi(value) : value)

const booleanFlags = new Set(['dry-run', 'commit', 'push', 'allow-dirty', 'non-interactive', 'yes', 'no-color', 'verbose', 'help', 'version'])
const shortBooleanFlags = new Set(['-dy', '-y'])
