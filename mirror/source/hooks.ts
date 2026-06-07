/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { MirrorCliOptions, MirrorConfig, MirrorHookCommand, MirrorHookName, MirrorHookResult, MirrorHooksConfig, MirrorVersionPlan, MirrorVersionPlanAction } from './types.js'
import { MirrorError } from './errors.js'

const execAsync = (command: string, options: { cwd: string, env: Record<string, string> }) =>
  promisify(exec)(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    maxBuffer: 10 * 1024 * 1024,
  })

export const mirrorHookNames: MirrorHookName[] = [
  'before:everything', 'after:everything',
  'before:plan', 'after:plan',
  'before:apply', 'after:apply',
  'before:write', 'after:write',
  'before:commit', 'after:commit',
  'before:tag', 'after:tag',
  'before:push', 'after:push',
]

const hookNameSet = new Set<string>(mirrorHookNames)

export const normalizeHooksConfig = (raw: Record<string, MirrorHookCommand> | undefined): MirrorHooksConfig => {
  if (!raw || typeof raw !== 'object') return {}

  const config: MirrorHooksConfig = {}

  for (const [key, value] of Object.entries(raw)) {
    const name = key.replaceAll('_', ':') as MirrorHookName

    if (!hookNameSet.has(name)) continue

    const commands = typeof value === 'string' ? [value] : value
    config[name] = commands
  }

  return config
}

export const runHooks = async (
  name: MirrorHookName,
  commands: string[] | undefined,
  env: Record<string, string>,
  cwd: string,
): Promise<MirrorHookResult | undefined> => {
  if (!commands || commands.length === 0) return undefined

  const start = Date.now()

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i]
    if (!command) continue
    try {
      await execAsync(command, { cwd, env })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const exitCode = typeof (error as Record<string, unknown>)['code'] === 'number' ? (error as Record<string, unknown>)['code'] as number : 1
      throw new MirrorError(`Hook '${name}' failed (exit code ${exitCode}): ${command}\n${message}`, Number(exitCode))
    }
  }

  return {
    name,
    commands,
    status: 'success',
    durationMs: Date.now() - start,
    exitCode: 0,
  }
}

export const runHooksQuiet = async (
  name: MirrorHookName,
  commands: string[] | undefined,
  env: Record<string, string>,
  cwd: string,
  results: MirrorHookResult[],
): Promise<void> => {
  if (!commands || commands.length === 0) return

  try {
    await runHooks(name, commands, env, cwd)
    results.push({ name, commands, status: 'success', durationMs: 0, exitCode: 0 })
  } catch (error) {
    const exitCode = error instanceof MirrorError ? error.exitCode ?? 1 : 1
    results.push({ name, commands, status: 'failure', durationMs: 0, exitCode, stderr: error instanceof Error ? error.message : String(error) })
  }
}

export const runActionHooks = async (
  name: MirrorHookName,
  commands: string[] | undefined,
  env: Record<string, string>,
  cwd: string,
  options: MirrorCliOptions,
): Promise<MirrorHookResult | undefined> => {
  if (options.dryRun || !commands || commands.length === 0) return undefined

  return runHooks(name, commands, env, cwd)
}

export const hookEnvFromConfig = (config: MirrorConfig, target: string): Record<string, string> => ({
  MIRROR_CWD: config.cwd,
  MIRROR_CONFIG_PATH: config.configPath ?? '',
  MIRROR_SOURCE: config.version.source,
  MIRROR_OUTPUT: config.version.output.join(','),
  MIRROR_TARGET: target,
})

export const hookEnvForPlan = (plan: MirrorVersionPlan, target: string): Record<string, string> => ({
  MIRROR_CWD: plan.cwd,
  MIRROR_CONFIG_PATH: plan.configPath ?? '',
  MIRROR_SOURCE: plan.source,
  MIRROR_OUTPUT: plan.output.join(','),
  MIRROR_TARGET: target,
  MIRROR_CURRENT: plan.currentVersion,
  MIRROR_NEXT: plan.nextVersion,
  MIRROR_PROJECT_NAME: plan.project.name ?? '',
  MIRROR_GIT_TAG: plan.gitTag ?? '',
  MIRROR_FILE_PATHS: plan.fileOutputPaths.join(','),
  MIRROR_COMMIT_ENABLED: String(plan.commitEnabled),
  MIRROR_PUSH_ENABLED: String(plan.pushEnabled),
})

export const hookEnvForAction = (plan: MirrorVersionPlan, target: string, action: MirrorVersionPlanAction): Record<string, string> => {
  const env = hookEnvForPlan(plan, target)

  if (action.type === 'write-file') {
    env['MIRROR_FILE_PATH'] = action.path
    env['MIRROR_FILE_CURRENT'] = action.currentVersion
    env['MIRROR_FILE_NEXT'] = action.nextVersion
  }

  if (action.type === 'git-commit') {
    env['MIRROR_COMMIT_MSG'] = action.message
    env['MIRROR_COMMIT_PATHS'] = action.paths.join(' ')
  }

  if (action.type === 'git-tag') {
    env['MIRROR_TAG'] = action.tag
  }

  if (action.type === 'git-push') {
    env['MIRROR_INCLUDE_COMMIT'] = String(action.includeCommit)
    env['MIRROR_INCLUDE_TAGS'] = String(action.includeTags)
  }

  return env
}

export const hookEnvForResult = (plan: MirrorVersionPlan, target: string, applied: boolean, dryRun: boolean): Record<string, string> => ({
  ...hookEnvForPlan(plan, target),
  MIRROR_APPLIED: String(applied),
  MIRROR_DRY_RUN: String(dryRun),
})
