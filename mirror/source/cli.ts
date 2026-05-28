/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { defineCommand, runMain } from 'citty'
import type { ArgsDef } from 'citty'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MirrorError } from './errors.js'
import { readCurrentVersion, resolveProjectName } from './adapters.js'
import { configPathForDisplay, discoverMirrorConfig, loadMirrorConfig, relativeFromCwd, writeInitConfig } from './config.js'
import { executeVersionPlan } from './executor.js'
import { parseMirrorCliOptions } from './flags.js'
import { buildVersionPlan, validateMirrorConfig } from './plan.js'
import { mirrorBanner, reportConfig, reportConfigSchema, reportExecution, reportExecutionSummary, reportPlan, reportValue } from './reporter.js'
import type { MirrorAdapterName, MirrorCliOptions } from './types.js'
import { resolveNextVersion } from './version.js'

const mirrorVersion = readInstalledVersion()

const globalArgs = {
  config: { type: 'string', description: 'Path to mirror.config.toml' },
  cwd: { type: 'string', description: 'Run as if Mirror started in this directory' },
  format: { type: 'enum', options: ['text', 'json'], default: 'text', description: 'Output format' },
  'no-color': { type: 'boolean', description: 'Disable color output' },
  verbose: { type: 'boolean', description: 'Show full error details and stack traces' },
} satisfies ArgsDef

const overrideArgs = {
  ...globalArgs,
  source: { type: 'enum', options: ['package.json', 'jsr.json', 'git'], description: 'Override version source' },
  output: { type: 'string', description: 'Override version output. Repeat or comma-separate values.' },
  'package-file': { type: 'string', description: 'Override package.json path' },
  'jsr-file': { type: 'string', description: 'Override jsr.json path' },
  preid: { type: 'string', description: 'Override prerelease identifier' },
} satisfies ArgsDef

const applyArgs = {
  ...overrideArgs,
  'dry-run': { type: 'boolean', alias: 'dy', description: 'Build and print the plan without applying it' },
  commit: { type: 'boolean', description: 'Create a release commit when file outputs changed' },
  push: { type: 'boolean', description: 'Create the release commit when needed, then push release refs' },
  'allow-dirty': { type: 'boolean', description: 'Allow release in a dirty Git worktree' },
  yes: { type: 'boolean', alias: 'y', description: 'Apply without interactive confirmation' },
} satisfies ArgsDef

const targetArg = {
  target: { type: 'positional', description: 'Release target or exact semantic version', required: true },
} satisfies ArgsDef

export const createMirrorCommand = () =>
  defineCommand({
    meta: {
      name: 'mirror',
      version: mirrorVersion,
      description: 'Open source project versioning for Bun, npm, JSR, and Git.',
    },
    args: globalArgs,
    subCommands: {
      init: createInitCommand(),
      config: createConfigCommand(),
      version: createVersionCommand(),
    },
  })

export const runMirrorCli = async (rawArgs = process.argv.slice(2)) => {
  const effectiveArgs = rawArgs.length === 0 ? ['--help'] : rawArgs
  const verbose = effectiveArgs.includes('--verbose')
  const restoreColorOutput = effectiveArgs.includes('--no-color') ? stripColorFromProcessOutput() : () => {}

  try {
    if (effectiveArgs.includes('--no-color')) process.env['NO_COLOR'] = '1'

    if (effectiveArgs.includes('--help')) {
      const parsed = parseMirrorCliOptions(effectiveArgs)
      const cwd = resolve(parsed.cwd ?? process.cwd())
      const discovery = await discoverMirrorConfig(cwd, parsed.config)
      const configDisplay = discovery.path ? relativeFromCwd(cwd, discovery.path) : ''
      process.stdout.write(mirrorBanner(configDisplay))
    }

    if (rawArgs.length === 0) {
      process.on('exit', () => {
        process.stdout.write([
          'EXAMPLES',
          '',
          '  mirror version current                 # Print the current version',
          '  mirror version plan patch              # Preview a patch release plan',
          '  mirror version apply minor --commit    # Apply a minor release with commit',
          '  mirror version plan patch --output=package.json,jsr.json,git  # Plan with package, jsr, and git',
          '  mirror config schema                   # Print the configuration file reference',
          '',
        ].join('\n') + '\n')
      })
    }

    let capturedError: unknown = undefined
    const originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      if (args.length > 0 && args[0] instanceof Error) {
        capturedError = args[0]
        return
      }
      originalConsoleError(...args)
    }

    const originalProcessExit = process.exit
    let exitCode: number | undefined
    process.exit = ((code?: number) => {
      if (code !== 0 && capturedError) {
        exitCode = code
        return undefined as never
      }
      originalProcessExit(code)
    }) as typeof process.exit

    try {
      await runMain(createMirrorCommand(), { rawArgs: effectiveArgs })
    } finally {
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }

    if (capturedError) {
      handleCliError(capturedError, verbose, exitCode)
    }
  } catch (error) {
    handleCliError(error, verbose)
  } finally {
    restoreColorOutput()
  }
}

const handleCliError = (error: unknown, verbose: boolean, exitCode?: number): never => {
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

  process.exit(exitCode ?? 1)
}

const createInitCommand = () =>
  defineCommand({
    meta: { name: 'init', description: 'Create a Mirror configuration file.' },
    subCommands: {
      'package.json': createInitKindCommand('package.json'),
      'jsr.json': createInitKindCommand('jsr.json'),
      git: createInitKindCommand('git'),
    },
  })

const createInitKindCommand = (kind: MirrorAdapterName) =>
  defineCommand({
    meta: { name: kind, description: `Create ${kind} project configuration.` },
    args: {
      ...globalArgs,
      yes: { type: 'boolean', description: 'Overwrite existing mirror.config.toml' },
    },
    async run(context) {
      const options = cliOptions(context.rawArgs, context.args)
      const path = await writeInitConfig(kind, options.cwd ?? process.cwd(), Boolean(options.yes))
      process.stdout.write(reportValue(`created ${path}`, options.format))
    },
  })

const createConfigCommand = () =>
  defineCommand({
    meta: { name: 'config', description: 'Inspect and validate Mirror configuration.' },
    subCommands: {
      show: defineCommand({
        meta: { name: 'show', description: 'Print the resolved configuration.' },
        args: overrideArgs,
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          const config = await loadMirrorConfig(options)
          if (options.format !== 'json') process.stdout.write(mirrorBanner(configPathForDisplay(config)))
          process.stdout.write(reportConfig(config, options.format))
        },
      }),
      check: defineCommand({
        meta: { name: 'check', description: 'Validate the resolved configuration.' },
        args: overrideArgs,
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          await validateMirrorConfig(options)
          process.stdout.write(reportValue('ok', options.format))
        },
      }),
      schema: defineCommand({
        meta: { name: 'schema', description: 'Print the configuration file reference.' },
        args: globalArgs,
        run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          if (options.format !== 'json') process.stdout.write(mirrorBanner())
          process.stdout.write(reportConfigSchema(options.format))
        },
      }),
    },
  })

const createVersionCommand = () =>
  defineCommand({
    meta: { name: 'version', description: 'Read, plan, and apply version changes.' },
    subCommands: {
      current: defineCommand({
        meta: { name: 'current', description: 'Print the current project version.' },
        args: overrideArgs,
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          const config = await loadMirrorConfig(options)
          const projectName = await resolveProjectName(config)
          process.stdout.write(reportValue(await readCurrentVersion(config, projectName), options.format))
        },
      }),
      next: defineCommand({
        meta: { name: 'next', description: 'Print the next version without checking outputs.' },
        args: { ...overrideArgs, ...targetArg },
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          const config = await loadMirrorConfig(options)
          const projectName = await resolveProjectName(config)
          const currentVersion = await readCurrentVersion(config, projectName)
          process.stdout.write(reportValue(resolveNextVersion(currentVersion, String(context.args['target']), config.version.prereleaseId), options.format))
        },
      }),
      plan: defineCommand({
        meta: { name: 'plan', description: 'Print the release plan without writing anything.' },
        args: { ...overrideArgs, ...targetArg },
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          const plan = await buildVersionPlan(String(context.args['target']), options)
          if (options.format !== 'json') process.stdout.write(mirrorBanner(plan.configPath ? plan.configPath : ''))
          process.stdout.write(reportPlan(plan, options.format))
        },
      }),
      apply: defineCommand({
        meta: { name: 'apply', description: 'Apply the release plan.' },
        args: { ...applyArgs, ...targetArg },
        async run(context) {
          const options = cliOptions(context.rawArgs, context.args)
          const plan = await buildVersionPlan(String(context.args['target']), options)

          if (options.format !== 'json') process.stdout.write(mirrorBanner(plan.configPath ? plan.configPath : ''))
          if (options.format !== 'json') process.stdout.write(reportPlan(plan, options.format))

          const result = await executeVersionPlan(plan, options)
          process.stdout.write(options.format === 'json' ? reportExecution(result, options.format) : reportExecutionSummary(result, options.format))
        },
      }),
    },
  })

const cliOptions = (rawArgs: string[], args: Record<string, unknown>): MirrorCliOptions => {
  const parsed = parseMirrorCliOptions(rawArgs)

  return {
    ...parsed,
    config: parsed.config ?? stringArg(args['config']),
    cwd: parsed.cwd ?? stringArg(args['cwd']),
    format: parsed.format ?? (args['format'] === 'json' ? 'json' : 'text'),
    source: parsed.source ?? adapterArg(args['source']),
    output: parsed.output ?? outputArg(args['output']),
    packageFile: parsed.packageFile ?? stringArg(args['packageFile']),
    jsrFile: parsed.jsrFile ?? stringArg(args['jsrFile']),
    preid: parsed.preid ?? stringArg(args['preid']),
    dryRun: parsed.dryRun || args['dryRun'] === true,
    commit: parsed.commit || args['commit'] === true,
    push: parsed.push || args['push'] === true,
    allowDirty: parsed.allowDirty || args['allowDirty'] === true,
    yes: parsed.yes || args['yes'] === true,
    verbose: parsed.verbose || args['verbose'] === true,
  }
}

const stringArg = (value: unknown) => (typeof value === 'string' ? value : undefined)

const adapterArg = (value: unknown) => {
  if (value === 'package.json' || value === 'jsr.json' || value === 'git') return value
  return undefined
}

const outputArg = (value: unknown): MirrorCliOptions['output'] => {
  if (typeof value !== 'string') return undefined

  const values = value.split(',').map((item) => item.trim()).filter(Boolean)

  if (values.length === 0) return undefined

  return values.map((item) => {
    const adapter = adapterArg(item)
    if (!adapter) throw new MirrorError(`Invalid --output value: ${item}`)
    return adapter
  })
}

function readInstalledVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, unknown>
    return typeof packageJson['version'] === 'string' ? packageJson['version'] : '0.0.0'
  } catch {
    return '0.0.0'
  }
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
