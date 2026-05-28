/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { MirrorCliOptions, MirrorExecutionResult } from './types.js'
import { MirrorError } from './errors.js'
import { createGitCommit, createGitTag, isGitDirty, isGitRepository, pushGitRefs, writeJsrVersion, writePackageVersion } from './adapters.js'
import { loadMirrorConfig } from './config.js'
import { buildVersionPlan } from './plan.js'

export const applyVersionPlan = async (target: string, options: MirrorCliOptions = {}): Promise<MirrorExecutionResult> => {
  const plan = await buildVersionPlan(target, options)

  return executeVersionPlan(plan, options)
}

export const executeVersionPlan = async (
  plan: MirrorExecutionResult['plan'],
  options: MirrorCliOptions = {},
): Promise<MirrorExecutionResult> => {
  if (options.dryRun) return { plan, applied: false, dryRun: true }
  if (!plan.allowDirty && (await isGitRepository(plan.cwd)) && (await isGitDirty(plan.cwd))) {
    throw new MirrorError('Git worktree is dirty. Commit changes or pass --allow-dirty.')
  }
  if (!options.yes) throw new MirrorError('Refusing to apply without confirmation. Pass --yes to apply the plan.')

  const config = await loadMirrorConfig(options)

  if (config.version.output.includes('package.json')) await writePackageVersion(config, plan.nextVersion)
  if (config.version.output.includes('jsr.json')) await writeJsrVersion(config, plan.nextVersion)

  for (const action of plan.actions) {
    if (action.type === 'git-commit') await createGitCommit(plan.cwd, action.paths, action.message)
    if (action.type === 'git-tag') await createGitTag(plan.cwd, action.tag)
    if (action.type === 'git-push') await pushGitRefs(plan.cwd, action.includeCommit, action.includeTags)
  }

  return { plan, applied: true, dryRun: false }
}
