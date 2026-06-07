/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { MirrorCliOptions, MirrorExecutionResult, MirrorHooksConfig } from './types.js'
import { MirrorError } from './errors.js'
import { createGitCommit, createGitTag, isGitDirty, isGitRepository, pushGitRefs, writeJsrVersionFile, writePackageVersionFile } from './adapters.js'
import { buildVersionPlan } from './plan.js'
import { hookEnvForAction, runActionHooks } from './hooks.js'

export const applyVersionPlan = async (target: string, options: MirrorCliOptions = {}): Promise<MirrorExecutionResult> => {
  const plan = await buildVersionPlan(target, options)

  return executeVersionPlan(plan, options)
}

export const executeVersionPlan = async (
  plan: MirrorExecutionResult['plan'],
  options: MirrorCliOptions = {},
  hooks?: MirrorHooksConfig,
  target = plan.nextVersion,
): Promise<MirrorExecutionResult> => {
  const hookResults: MirrorExecutionResult['hookResults'] = []

  if (options.dryRun) return { plan, applied: false, dryRun: true, hookResults }
  if (!plan.allowDirty && (await isGitRepository(plan.cwd)) && (await isGitDirty(plan.cwd))) {
    throw new MirrorError('Git worktree is dirty. Commit changes or pass --allow-dirty.')
  }
  if (!options.yes) throw new MirrorError('Refusing to apply without confirmation. Pass --yes to apply the plan.')

  for (const action of plan.actions) {
    const actionEnv = hookEnvForAction(plan, target, action)

    if (action.type === 'write-file') {
      await runActionHooks('before:write', hooks?.['before:write'], actionEnv, plan.cwd, options)
      if (action.adapter === 'package.json') await writePackageVersionFile(action.path, plan.nextVersion)
      if (action.adapter === 'jsr.json') await writeJsrVersionFile(action.path, plan.nextVersion)
      await runActionHooks('after:write', hooks?.['after:write'], actionEnv, plan.cwd, options)
    }
    if (action.type === 'git-commit') {
      await runActionHooks('before:commit', hooks?.['before:commit'], actionEnv, plan.cwd, options)
      await createGitCommit(plan.cwd, action.paths, action.message)
      await runActionHooks('after:commit', hooks?.['after:commit'], actionEnv, plan.cwd, options)
    }
    if (action.type === 'git-tag') {
      await runActionHooks('before:tag', hooks?.['before:tag'], actionEnv, plan.cwd, options)
      await createGitTag(plan.cwd, action.tag)
      await runActionHooks('after:tag', hooks?.['after:tag'], actionEnv, plan.cwd, options)
    }
    if (action.type === 'git-push') {
      await runActionHooks('before:push', hooks?.['before:push'], actionEnv, plan.cwd, options)
      await pushGitRefs(plan.cwd, action.includeCommit, action.includeTags)
      await runActionHooks('after:push', hooks?.['after:push'], actionEnv, plan.cwd, options)
    }
  }

  return { plan, applied: true, dryRun: false, hookResults }
}
