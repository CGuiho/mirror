/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import type {
  MirrorAgentAutomationResult,
  MirrorAgentSettings,
  MirrorAgentsInstructionsResult,
  MirrorCliOptions,
  MirrorSkillInstallResult,
  MirrorSkillInstallScope,
} from './types.js'
import { MirrorError } from './errors.js'
import { discoverMirrorConfig, resolveMirrorPath } from './config.js'

export const mirrorSkillName = 'guiho-as-mirror'
export const mirrorAgentsSectionHeading = '## Semantic Project Versioning -- GUIHO Mirror'

export const defaultMirrorAgentSettings: MirrorAgentSettings = {
  writeChangelog: true,
  autoAgentsMd: true,
  autoSkillInstall: true,
}

export const mirrorAgentsSection = `${mirrorAgentsSectionHeading}

Invoke the guiho-as-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.

Before editing release docs or changelogs, inspect mirror.config.toml. If [agents].write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.
`

type MirrorSkillPathOptions = {
  cwd?: string
  homeDirectory?: string
}

type MirrorSkillInstallOptions = MirrorSkillPathOptions & {
  overwrite?: boolean
}

type MirrorAgentAutomationOptions = MirrorCliOptions & {
  homeDirectory?: string
}

export const resolveMirrorSkillPath = (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) => {
  if (scope === 'local') return resolve(options.cwd ?? process.cwd(), '.opencode', 'skills', mirrorSkillName, 'SKILL.md')

  return resolve(resolveMirrorAgentHome(options.homeDirectory), '.config', 'opencode', 'skills', mirrorSkillName, 'SKILL.md')
}

export const isMirrorSkillInstalled = (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) =>
  existsSync(resolveMirrorSkillPath(scope, options))

export const installMirrorSkill = async (
  scope: MirrorSkillInstallScope,
  options: MirrorSkillInstallOptions = {},
): Promise<MirrorSkillInstallResult> => {
  const path = resolveMirrorSkillPath(scope, options)
  const exists = existsSync(path)

  if (exists && options.overwrite === false) return { scope, path, installed: false, updated: false }

  const content = await readBundledMirrorSkill()
  const current = exists ? await readFile(path, 'utf8') : undefined

  if (current === content) return { scope, path, installed: false, updated: false }

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')

  return { scope, path, installed: !exists, updated: exists }
}

export const ensureMirrorAgentsInstructions = async (cwd: string, create = false): Promise<MirrorAgentsInstructionsResult> => {
  const path = findAgentsFile(cwd) ?? resolve(cwd, 'AGENTS.md')
  const exists = existsSync(path)

  if (!exists && !create) return { path, exists: false, changed: false }

  if (!exists) {
    await writeFile(path, `# Project Agents\n\n${mirrorAgentsSection}\n`, 'utf8')
    return { path, exists: true, changed: true }
  }

  const content = await readFile(path, 'utf8')
  if (content.includes(mirrorAgentsSectionHeading)) return { path, exists: true, changed: false }

  const nextContent = `${content.trimEnd()}\n\n${mirrorAgentsSection}\n`
  await writeFile(path, nextContent, 'utf8')

  return { path, exists: true, changed: true }
}

export const findAgentsFile = (cwd: string): string | undefined => {
  let current = resolve(cwd)

  while (true) {
    const path = resolve(current, 'AGENTS.md')
    if (existsSync(path)) return path

    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

export const resolveMirrorAgentSettings = async (options: MirrorCliOptions = {}): Promise<MirrorAgentSettings> => {
  const cwd = resolve(options.cwd ?? process.cwd())
  const discovered = await discoverMirrorConfig(cwd, options.config)

  if (!discovered.raw) return { ...defaultMirrorAgentSettings }
  if (discovered.raw.schema !== 1) throw new MirrorError('Unsupported or missing configuration schema. Expected `schema = 1`.')

  return {
    writeChangelog: optionalBoolean(discovered.raw.agents?.write_changelog, 'agents.write_changelog') !== false,
    autoAgentsMd: optionalBoolean(discovered.raw.agents?.auto_agents_md, 'agents.auto_agents_md') !== false,
    autoSkillInstall: optionalBoolean(discovered.raw.agents?.auto_skill_install, 'agents.auto_skill_install') !== false,
  }
}

export const runMirrorAgentAutomation = async (
  options: MirrorAgentAutomationOptions = {},
  notify: (message: string) => void = () => {},
): Promise<MirrorAgentAutomationResult> => {
  const cwd = resolve(options.cwd ?? process.cwd())
  const settings = await resolveMirrorAgentSettings(options)
  const result: MirrorAgentAutomationResult = { settings }

  if (settings.autoAgentsMd) result.agentsMd = await ensureMirrorAgentsInstructions(cwd, false)

  if (settings.autoSkillInstall) {
    for (const scope of ['local', 'global'] as const) {
      if (isMirrorSkillInstalled(scope, { cwd, homeDirectory: options.homeDirectory })) continue

      const path = resolveMirrorSkillPath(scope, { cwd, homeDirectory: options.homeDirectory })
      notify(`notice: ${mirrorSkillName} skill not found ${scope}; Mirror is installing it at ${path}`)
      const installed = await installMirrorSkill(scope, { cwd, homeDirectory: options.homeDirectory, overwrite: false })
      if (scope === 'local') result.localSkill = installed
      if (scope === 'global') result.globalSkill = installed
    }
  }

  return result
}

const readBundledMirrorSkill = async () => {
  try {
    return await readFile(new URL('../skills/guiho-as-mirror/SKILL.md', import.meta.url), 'utf8')
  } catch {
    return embeddedMirrorSkillContent
  }
}

const resolveMirrorAgentHome = (homeDirectory?: string) => {
  const value = homeDirectory ?? process.env['MIRROR_AGENT_HOME'] ?? homedir()
  return resolveMirrorPath(process.cwd(), value)
}

const optionalBoolean = (value: unknown, key: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new MirrorError(`Invalid ${key}. Expected true or false.`)
  return value
}

const embeddedMirrorSkillContent = [
  '---',
  'name: guiho-as-mirror',
  'description: Use this skill whenever the user asks to version, bump, release, tag, initialize, configure, or troubleshoot a project with GUIHO Mirror. This includes Bun, npm, JSR, package.json, jsr.json, Git tag, semantic versioning, changelog, release-plan, prerelease, and what version comes next workflows.',
  '---',
  '',
  '# GUIHO Mirror',
  '',
  'GUIHO Mirror is a deterministic CLI and TypeScript library for semantic project versioning. Use it instead of ad hoc version edits, manual package-manager version commands, or manual release tags.',
  '',
  '## Command Selection',
  '',
  '1. Use `bun @guiho/mirror` when the package is installed locally and Bun is available.',
  '2. Use `mirror` when a global binary is available.',
  '3. Use `bunx @guiho/mirror` when running without installation.',
  '',
  'Run `mirror --help` or `mirror <command> --help` for command-specific details when needed.',
  '',
  '## Release Workflow',
  '',
  'When the user asks to bump, release, tag, or version a project, follow this sequence:',
  '',
  '1. Confirm the target and project root. Supported targets are `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, or an exact semver like `2.0.0`.',
  '2. Run `<mirror> config show` and read `[git].allow_dirty` plus `[agents].write_changelog`.',
  '3. If `allow_dirty = false` or absent, check `git status --short` and stop if the worktree is dirty.',
  '4. Run the project type checker, commonly `bun run typecheck`.',
  '5. Run the project test suite, commonly `bun test`.',
  '6. Run `<mirror> version plan <target>` and use the planned next version as the source of truth.',
  '7. Update release documentation only when it is part of the project release process.',
  '8. If `[agents].write_changelog = false`, skip changelog edits. Otherwise update `CHANGELOG.md` when present and summarize only real changes.',
  '9. Commit release-preparation changes before applying the version bump.',
  '10. Run `<mirror> version apply <target> --yes`. Include `--commit` when file outputs and Git tag output are combined unless config already enables commits or push.',
  '',
  '## Safety Rules',
  '',
  '- Never skip `version plan`.',
  '- Never hand-edit `package.json` or `jsr.json` version fields as a Mirror substitute.',
  '- Never create Git tags manually for a Mirror-managed release unless recovering intentionally.',
  '- Do not apply a version bump after failed typecheck or tests.',
  '- Do not push release refs unless explicitly requested or configured.',
  '- When plan output is surprising, stop and explain the mismatch.',
  '',
  '## Initialization Workflow',
  '',
  'Use `mirror init package.json`, `mirror init jsr.json`, or `mirror init git`, then validate with `mirror config check`, inspect with `mirror config show`, and test with `mirror version current` plus `mirror version plan patch`.',
  '',
  '## Configuration Reference',
  '',
  'Mirror searches for configuration via `--config <path>`, `./mirror.config.toml`, or `./config/mirror.config.toml`.',
  '',
  'Common configuration keys: `[version].source`, `[version].output`, `[version].prerelease_id`, `[git].tag_template`, `[git].commit`, `[git].push`, `[git].allow_dirty`, `[agents].write_changelog`, `[agents].auto_agents_md`, and `[agents].auto_skill_install`.',
  '',
  'Agent automation options default to true. Set `write_changelog = false` to tell agents to skip changelog edits, `auto_agents_md = false` to stop Mirror from inserting its AGENTS.md section, and `auto_skill_install = false` to stop Mirror from installing `guiho-as-mirror` when missing.',
  '',
  '## CLI Reference',
  '',
  '- `mirror config show`',
  '- `mirror config check`',
  '- `mirror config schema`',
  '- `mirror agents install local`',
  '- `mirror agents install global`',
  '- `mirror agents instructions`',
  '- `mirror version current`',
  '- `mirror version next <target>`',
  '- `mirror version plan <target>`',
  '- `mirror version apply <target> --yes`',
  '',
  '## Response Style',
  '',
  'When reporting a Mirror release result, include the target, current version, planned next version, typecheck/test status, docs or changelog files changed, final apply command, and whether commits, tags, or pushes were created.',
  '',
].join('\n')
