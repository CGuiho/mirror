/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type {
  MirrorAgentsInstructionsResult,
  MirrorConfig,
  MirrorExecutionResult,
  MirrorFormat,
  MirrorSkillInstallResult,
  MirrorVersionPlan,
} from './types.js'
import { configPathForDisplay, relativeFromCwd } from './config.js'

export const mirrorBanner = (configPath?: string) => {
  const noColor = process.env['NO_COLOR'] === '1'
  const title = noColor ? '🪞  GUIHO Mirror' : '\x1b[1;36m🪞  GUIHO Mirror\x1b[0m'

  if (configPath === undefined) return `\n${title}\n\n`

  const dim = noColor ? '' : '\x1b[2m'
  const reset = noColor ? '' : '\x1b[0m'
  const status = configPath ? configPath : '(none)'

  return `\n${title}\n\n${dim}config: ${status}${reset}\n\n`
}

export const reportValue = (value: unknown, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(value, null, 2)}\n`
  return `${String(value)}\n`
}

export const reportConfig = (config: MirrorConfig, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(config, null, 2)}\n`

  return [
    `config: ${configPathForDisplay(config)}`,
    `source: ${config.version.source}`,
    `output: ${config.version.output.join(', ')}`,
    `package: ${config.package.path}`,
    `package_auxiliary: ${config.package.auxiliaryPaths.join(', ') || '(none)'}`,
    `jsr: ${config.jsr.path}`,
    `tag_template: ${config.git.tagTemplate}`,
    `commit: ${String(config.git.commit)}`,
    `push: ${String(config.git.push)}`,
    `allow_dirty: ${String(config.git.allowDirty)}`,
    `write_changelog: ${String(config.agents.writeChangelog)}`,
    `changelog_path: ${config.agents.changelogPath}`,
    `auto_agents_md: ${String(config.agents.autoAgentsMd)}`,
    `auto_skill_install: ${String(config.agents.autoSkillInstall)}`,
    '',
  ].join('\n')
}

export const reportConfigSchema = (format: MirrorFormat = 'text') => {
  if (format === 'json') {
    return `${JSON.stringify({ schema: 'See text output for full reference.' }, null, 2)}\n`
  }

  return [
    'MIRROR CONFIGURATION SCHEMA (mirror.config.toml)',
    '',
    '  schema = 1                                Required. Schema version. Must be 1.',
    '',
    '  [project]',
    '  name = "<string>"                         Optional. Explicit project name.',
    '  name_source = "package.json" | "jsr.json" Optional. Read project name from this adapter.',
    '',
    '  [version]',
    '  scheme = "semver"                         Required. Only "semver" is supported.',
    '  source = "package.json" | "jsr.json" | "git"  Required. Adapter to read the current version from.',
    '  output = ["package.json", "jsr.json", "git"]  Required. Adapters to write the next version to.',
    '  prerelease_id = "<string>"                Optional. Default prerelease identifier (e.g. "alpha").',
    '',
    '  [package]',
    '  path = "<path>"                           Optional. Path to package.json. Default: "package.json".',
    '  auxiliary_paths = ["<path>"]              Optional. Extra package.json files that mirror the main package version.',
    '',
    '  [jsr]',
    '  path = "<path>"                           Optional. Path to jsr.json. Default: "jsr.json".',
    '',
    '  [git]',
    '  tag_template = "<template>"               Optional. Git tag format. Default: "v{version}".',
    '                                            Supported: "v{version}", "{name}@{version}", "{name}/v{version}".',
    '  commit = true | false                     Optional. Create release commits. Default: false.',
    '  push = true | false                       Optional. Push release refs. Default: false.',
    '  allow_dirty = true | false                Optional. Allow dirty Git worktree. Default: false.',
    '',
    '  [agents]',
    '  write_changelog = true | false            Optional. Tell agents to write changelog entries. Default: true.',
    '  changelog_path = "<path>"                 Optional. Changelog file path for agents. Default: "CHANGELOG.md".',
    '  auto_agents_md = true | false             Optional. Insert Mirror guidance into AGENTS.md when present. Default: true.',
    '  auto_skill_install = true | false         Optional. Install guiho-as-mirror globally when missing. Default: true.',
    '',
  ].join('\n')
}

export const reportSkillInstall = (result: MirrorSkillInstallResult, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`

  return [
    'skill: guiho-as-mirror',
    `scope: ${result.scope}`,
    `path: ${result.path}`,
    `installed: ${String(result.installed)}`,
    `updated: ${String(result.updated)}`,
    '',
  ].join('\n')
}

export const reportAgentsInstructions = (result: MirrorAgentsInstructionsResult, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`

  return [
    `agents_md: ${result.path}`,
    `exists: ${String(result.exists)}`,
    `changed: ${String(result.changed)}`,
    '',
  ].join('\n')
}

export const reportPlan = (plan: MirrorVersionPlan, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(plan, null, 2)}\n`

  const lines = [
    `current: ${plan.currentVersion}`,
    `next: ${plan.nextVersion}`,
    `source: ${plan.source}`,
    `output: ${plan.output.join(', ')}`,
  ]

  if (plan.project.name) lines.push(`project: ${plan.project.name}`)
  if (plan.configPath) lines.push(`config: ${relativeFromCwd(plan.cwd, plan.configPath)}`)
  if (plan.fileOutputPaths.length > 0) lines.push(`files: ${plan.fileOutputPaths.map((path) => relativeFromCwd(plan.cwd, path)).join(', ')}`)
  if (plan.gitTag) lines.push(`tag: ${plan.gitTag}`)

  lines.push('actions:')

  for (const action of plan.actions) {
    if (action.type === 'write-file') lines.push(`- write ${relativeFromCwd(plan.cwd, action.path)}: ${action.currentVersion} -> ${action.nextVersion}`)
    if (action.type === 'git-commit') lines.push(`- commit ${action.message}`)
    if (action.type === 'git-tag') lines.push(`- tag ${action.tag}`)
    if (action.type === 'git-push') lines.push(`- push commit=${String(action.includeCommit)} tags=${String(action.includeTags)}`)
  }

  return `${lines.join('\n')}\n`
}

export const reportExecution = (result: MirrorExecutionResult, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`
  return `${reportPlan(result.plan, 'text')}applied: ${String(result.applied)}\ndry_run: ${String(result.dryRun)}\n`
}

export const reportExecutionSummary = (result: MirrorExecutionResult, format: MirrorFormat = 'text') => {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`

  const outputs = result.plan.output.join(', ')
  const files = result.plan.fileOutputPaths.map((path) => relativeFromCwd(result.plan.cwd, path)).join(', ')
  const lines = [
    `applied: ${String(result.applied)}`,
    `dry_run: ${String(result.dryRun)}`,
    `version: ${result.plan.nextVersion}`,
    `outputs: ${outputs}`,
  ]

  if (files) lines.push(`files: ${files}`)
  if (result.plan.gitTag) lines.push(`tag: ${result.plan.gitTag}`)

  return `${lines.join('\n')}\n`
}
