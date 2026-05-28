/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { relative } from 'node:path'
import type { MirrorCliOptions, MirrorConfig, MirrorVersionPlan, MirrorVersionPlanAction } from './types.js'
import { MirrorError } from './errors.js'
import { loadMirrorConfig, relativeFromCwd, resolveMirrorPath } from './config.js'
import { ensureAdapterFiles, readCurrentVersion, renderGitTag, resolveProjectName } from './adapters.js'
import { resolveNextVersion } from './version.js'

export const validateMirrorConfig = async (options: MirrorCliOptions = {}): Promise<MirrorConfig> => {
  const config = await loadMirrorConfig(options)
  await ensureAdapterFiles(config)

  const projectName = await resolveProjectName(config)

  if (config.version.source === 'git' || config.version.output.includes('git')) {
    renderGitTag(config.git.tagTemplate, '0.0.0', projectName)
  }

  return config
}

export const buildVersionPlan = async (target: string, options: MirrorCliOptions = {}): Promise<MirrorVersionPlan> => {
  const config = await validateMirrorConfig(options)

  const projectName = await resolveProjectName(config)
  const currentVersion = await readCurrentVersion(config, projectName)
  const nextVersion = resolveNextVersion(currentVersion, target, config.version.prereleaseId)
  const fileOutputPaths = resolveFileOutputPaths(config)
  const commitEnabled = config.git.commit
  const pushEnabled = config.git.push
  const actions: MirrorVersionPlanAction[] = []

  for (const path of fileOutputPaths) {
    actions.push({
      type: 'write-file',
      adapter: path.endsWith(config.package.path) ? 'package.json' : 'jsr.json',
      path,
      currentVersion,
      nextVersion,
    })
  }

  const gitTag = config.version.output.includes('git') ? renderGitTag(config.git.tagTemplate, nextVersion, projectName) : undefined

  if (fileOutputPaths.length > 0 && gitTag && !commitEnabled && !pushEnabled) {
    throw new MirrorError('Git tag output with file outputs requires --commit or --push so the tag points at the version commit.')
  }

  if (commitEnabled && fileOutputPaths.length > 0) {
    actions.push({
      type: 'git-commit',
      message: releaseLabel(nextVersion, projectName),
      paths: fileOutputPaths.map((path) => relative(config.cwd, path)),
    })
  }

  if (gitTag) actions.push({ type: 'git-tag', tag: gitTag })

  if (pushEnabled) {
    actions.push({
      type: 'git-push',
      includeCommit: fileOutputPaths.length > 0,
      includeTags: Boolean(gitTag),
    })
  }

  return {
    cwd: config.cwd,
    configPath: config.configPath,
    source: config.version.source,
    output: config.version.output,
    currentVersion,
    nextVersion,
    project: { name: projectName },
    commitEnabled,
    pushEnabled,
    allowDirty: config.git.allowDirty,
    fileOutputPaths,
    gitTag,
    actions,
  }
}

export const resolveFileOutputPaths = (config: MirrorConfig) => {
  const paths: string[] = []

  if (config.version.output.includes('package.json')) paths.push(resolveMirrorPath(config.cwd, config.package.path))
  if (config.version.output.includes('jsr.json')) paths.push(resolveMirrorPath(config.cwd, config.jsr.path))

  return paths
}

export const releaseLabel = (version: string, projectName?: string) => (projectName ? `${projectName}@${version}` : `v${version}`)

export const planPathForDisplay = (plan: MirrorVersionPlan, path: string) => relativeFromCwd(plan.cwd, path)
