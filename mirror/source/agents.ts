/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type {
  MirrorAgentAutomationResult,
  MirrorAgentSettings,
  MirrorAgentsInstructionsResult,
  MirrorCliOptions,
  MirrorSkillInstallResult,
  MirrorSkillInstallScope,
} from './types.js'
import { gt as isSemverGreater, valid as validSemver } from 'semver'
import { MirrorError } from './errors.js'
import { discoverMirrorConfig, resolveMirrorPath } from './config.js'
import { dirnamePath, resolvePath } from './path.js'
import { fileExists, readTextFile, removePath, writeTextFile } from './runtime.js'
import packageJson from '../package.json' with { type: 'json' }

export const mirrorSkillName = 'guiho-s-mirror'
export const legacyMirrorSkillNames = ['guiho-as-mirror'] as const
export const mirrorSkillVersion = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'
export const mirrorAgentsSectionStartMarker = '<!-- BEGIN GUIHO MIRROR - DO NOT EDIT THIS SECTION -->'
export const mirrorAgentsSectionEndMarker = '<!-- END GUIHO MIRROR -->'
export const mirrorAgentsSectionHeading = '## Semantic Project Versioning -- GUIHO Mirror'

export const defaultMirrorAgentSettings: MirrorAgentSettings = {
  writeChangelog: true,
  changelogPath: 'CHANGELOG.md',
  autoAgentsMd: true,
  autoSkillInstall: true,
}

const mirrorAgentsSectionBody = `${mirrorAgentsSectionHeading}

Invoke the guiho-s-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.

Before editing release docs or changelogs, inspect mirror.config.toml. If [agents].write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.

Use [agents].changelog_path as the changelog file path. If it is missing, use CHANGELOG.md in the project root.
`

const legacyMirrorAgentsSectionBodies = [
  `${mirrorAgentsSectionHeading}

Invoke the guiho-as-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.

Before editing release docs or changelogs, inspect mirror.config.toml. If [agents].write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.

Use [agents].changelog_path as the changelog file path. If it is missing, use CHANGELOG.md in the project root.
`,
]

export const mirrorAgentsSection = `${mirrorAgentsSectionStartMarker}
${mirrorAgentsSectionBody.trimEnd()}
${mirrorAgentsSectionEndMarker}`

type MirrorSkillPathOptions = {
  cwd?: string
  homeDirectory?: string
}

type MirrorSkillInstallOptions = MirrorSkillPathOptions & {
  overwrite?: boolean
}

type InstalledMirrorSkill = {
  name: string
  path: string
  content: string
  version?: string
}

type MirrorAgentAutomationOptions = MirrorCliOptions & {
  homeDirectory?: string
}

const mirrorSkillInstallNames = [...legacyMirrorSkillNames, mirrorSkillName] as const

export const resolveMirrorSkillPath = (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) => {
  return resolveMirrorSkillPathForName(scope, mirrorSkillName, options)
}

export const isMirrorSkillInstalled = async (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) =>
  fileExists(resolveMirrorSkillPath(scope, options))

export const installMirrorSkill = async (
  scope: MirrorSkillInstallScope,
  options: MirrorSkillInstallOptions = {},
): Promise<MirrorSkillInstallResult> => {
  const path = resolveMirrorSkillPath(scope, options)
  const content = await readBundledMirrorSkill()
  const version = readMirrorSkillVersion(content) ?? mirrorSkillVersion
  const installedSkills = await readInstalledMirrorSkills(scope, options)
  const legacySkill = installedSkills.find((skill) => skill.name !== mirrorSkillName)
  const currentSkill = installedSkills.find((skill) => skill.name === mirrorSkillName)
  const previousSkill = legacySkill ?? currentSkill

  if (!shouldWriteBundledMirrorSkill(installedSkills, content, version, options.overwrite)) {
    return {
      scope,
      path,
      name: mirrorSkillName,
      version,
      installed: false,
      updated: false,
      migrated: false,
      removed: [],
      previousName: previousSkill?.name,
      previousVersion: previousSkill?.version,
    }
  }

  const removed = installedSkills.map((skill) => dirnamePath(skill.path))
  for (const target of new Set(removed)) await removePath(target)

  await writeTextFile(path, content)

  return {
    scope,
    path,
    name: mirrorSkillName,
    version,
    installed: installedSkills.length === 0,
    updated: installedSkills.length > 0,
    migrated: Boolean(legacySkill),
    removed,
    previousName: previousSkill?.name,
    previousVersion: previousSkill?.version,
  }
}

export const ensureMirrorAgentsInstructions = async (cwd: string, create = false): Promise<MirrorAgentsInstructionsResult> => {
  const path = await findAgentsFile(cwd) ?? resolvePath(cwd, 'AGENTS.md')
  const exists = await fileExists(path)

  if (!exists && !create) return { path, exists: false, changed: false }

  if (!exists) {
    await writeTextFile(path, `# Project Agents\n\n${mirrorAgentsSection}\n`)
    return { path, exists: true, changed: true }
  }

  const content = await readTextFile(path)
  if (hasCurrentMirrorAgentsSection(content)) return { path, exists: true, changed: false }

  const replacedContent = replaceExistingMirrorAgentsSection(content)
  if (replacedContent !== content) {
    await writeTextFile(path, replacedContent)
    return { path, exists: true, changed: true }
  }

  const nextContent = `${content.trimEnd()}\n\n${mirrorAgentsSection}\n`
  await writeTextFile(path, nextContent)

  return { path, exists: true, changed: true }
}

export const findAgentsFile = async (cwd: string): Promise<string | undefined> => {
  let current = resolvePath(cwd)

  while (true) {
    const path = resolvePath(current, 'AGENTS.md')
    if (await fileExists(path)) return path

    const parent = dirnamePath(current)
    if (parent === current) return undefined
    current = parent
  }
}

export const resolveMirrorAgentSettings = async (options: MirrorCliOptions = {}): Promise<MirrorAgentSettings> => {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const discovered = await discoverMirrorConfig(cwd, options.config)

  if (!discovered.raw) return { ...defaultMirrorAgentSettings }
  if (discovered.raw.schema !== 1) throw new MirrorError('Unsupported or missing configuration schema. Expected `schema = 1`.')

  return {
    writeChangelog: optionalBoolean(discovered.raw.agents?.write_changelog, 'agents.write_changelog') !== false,
    changelogPath: optionalString(discovered.raw.agents?.changelog_path, 'agents.changelog_path') ?? 'CHANGELOG.md',
    autoAgentsMd: optionalBoolean(discovered.raw.agents?.auto_agents_md, 'agents.auto_agents_md') !== false,
    autoSkillInstall: optionalBoolean(discovered.raw.agents?.auto_skill_install, 'agents.auto_skill_install') !== false,
  }
}

export const runMirrorAgentAutomation = async (
  options: MirrorAgentAutomationOptions = {},
  notify: (message: string) => void = () => {},
): Promise<MirrorAgentAutomationResult> => {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const settings = await resolveMirrorAgentSettings(options)
  const result: MirrorAgentAutomationResult = { settings }

  if (settings.autoAgentsMd) result.agentsMd = await ensureMirrorAgentsInstructions(cwd, false)

  if (settings.autoSkillInstall) {
    const scope = 'global'
    const globalSkill = await installMirrorSkill(scope, { cwd, homeDirectory: options.homeDirectory, overwrite: false })

    if (globalSkill.installed || globalSkill.updated || globalSkill.migrated) {
      notify(`notice: ${mirrorSkillName} skill ${describeMirrorSkillInstallReason(globalSkill)} ${scope}; Mirror is installing it at ${globalSkill.path}`)
      result.globalSkill = globalSkill
    }
  }

  return result
}

const readBundledMirrorSkill = async () => {
  try {
    return withBundledMirrorSkillVersion(await Bun.file(new URL('../skills/guiho-s-mirror/SKILL.md', import.meta.url)).text())
  } catch {
    return withBundledMirrorSkillVersion(embeddedMirrorSkillContent)
  }
}

const resolveMirrorSkillPathForName = (scope: MirrorSkillInstallScope, name: string, options: MirrorSkillPathOptions = {}) => {
  if (scope === 'local') return resolvePath(options.cwd ?? process.cwd(), '.agents', 'skills', name, 'SKILL.md')

  return resolvePath(resolveMirrorAgentHome(options.homeDirectory), '.agents', 'skills', name, 'SKILL.md')
}

const readInstalledMirrorSkills = async (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) => {
  const installedSkills: InstalledMirrorSkill[] = []

  for (const name of mirrorSkillInstallNames) {
    const path = resolveMirrorSkillPathForName(scope, name, options)
    if (!(await fileExists(path))) continue

    const content = await readTextFile(path)
    installedSkills.push({ name, path, content, version: readMirrorSkillVersion(content) })
  }

  return installedSkills
}

const shouldWriteBundledMirrorSkill = (installedSkills: InstalledMirrorSkill[], content: string, version: string, overwrite?: boolean) => {
  if (overwrite !== false) return true
  if (installedSkills.length === 0) return true
  if (installedSkills.some((skill) => skill.name !== mirrorSkillName)) return true

  const [currentSkill] = installedSkills

  if (!currentSkill) return true
  if (currentSkill.content === content) return false
  if (!currentSkill.version) return true

  return isMirrorSkillVersionOutdated(currentSkill.version, version)
}

const isMirrorSkillVersionOutdated = (currentVersion: string, bundledVersion: string) => {
  const current = validSemver(currentVersion)
  const bundled = validSemver(bundledVersion)

  if (!current || !bundled) return true

  return isSemverGreater(bundled, current)
}

const readMirrorSkillVersion = (content: string) => readMirrorSkillFrontmatterValue(content, 'version')

const readMirrorSkillFrontmatterValue = (content: string, key: string) => {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1]
  const value = frontmatter ? new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, 'm').exec(frontmatter)?.[1] : undefined

  return value?.trim()
}

const withBundledMirrorSkillVersion = (content: string) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!match) return content

  const frontmatter = match[1] ?? ''
  const nextFrontmatter = /^version:\s*/m.test(frontmatter)
    ? frontmatter.replace(/^version:\s*.*$/m, `version: ${mirrorSkillVersion}`)
    : frontmatter.replace(/^name:\s*.*$/m, (line) => `${line}\nversion: ${mirrorSkillVersion}`)

  return `---\n${nextFrontmatter}\n---${content.slice(match[0].length)}`
}

const describeMirrorSkillInstallReason = (result: MirrorSkillInstallResult) => {
  if (result.installed) return 'not found'
  if (result.migrated) return `legacy ${result.previousName ?? 'skill'} found`
  return `outdated${result.previousVersion ? ` (${result.previousVersion} -> ${result.version})` : ''}`
}

const resolveMirrorAgentHome = (homeDirectory?: string) => {
  const value = homeDirectory ?? process.env['MIRROR_AGENT_HOME'] ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? process.cwd()
  return resolveMirrorPath(process.cwd(), value)
}

const optionalBoolean = (value: unknown, key: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new MirrorError(`Invalid ${key}. Expected true or false.`)
  return value
}

const optionalString = (value: unknown, key: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new MirrorError(`Invalid ${key}. Expected a string.`)
  return value
}

const hasCurrentMirrorAgentsSection = (content: string) => {
  const normalizedContent = normalizeMirrorAgentsSection(content)

  return [mirrorAgentsSection, mirrorAgentsSectionBody].some((section) => {
    return normalizedContent.includes(normalizeMirrorAgentsSection(section))
  })
}

const replaceExistingMirrorAgentsSection = (content: string) => {
  const markerPattern = new RegExp(`${escapeRegExp(mirrorAgentsSectionStartMarker)}[\\s\\S]*?${escapeRegExp(mirrorAgentsSectionEndMarker)}`)
  const markerMatch = markerPattern.exec(content)
  if (markerMatch) return content.replace(markerPattern, mirrorAgentsSection)

  for (const legacySection of legacyMirrorAgentsSectionBodies) {
    const legacyBody = legacySection.trimEnd()
    if (content.includes(legacyBody)) return content.replace(legacyBody, mirrorAgentsSectionBody.trimEnd())
  }

  return content
}

const normalizeMirrorAgentsSection = (content: string) => content.replace(/\s+/g, ' ').trim()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const embeddedMirrorSkillContent = [
  '---',
  'name: guiho-s-mirror',
  `version: ${mirrorSkillVersion}`,
  'description: Use this skill whenever the user asks to version, bump, release, tag, initialize, configure, or troubleshoot a project with GUIHO Mirror. This includes Bun, npm, JSR, package.json, jsr.json, Git tag, semantic versioning, changelog, release-plan, prerelease, and what version comes next workflows.',
  '---',
  '',
  '# GUIHO Mirror',
  '',
  'GUIHO Mirror is a deterministic CLI for semantic project versioning. Use it instead of ad hoc version edits, manual package-manager version commands, or manual release tags.',
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
  '2. Run `<mirror> config show` and read `[git].allow_dirty`, `[agents].write_changelog`, and `[agents].changelog_path`.',
  '3. If `allow_dirty = false` or absent, check `git status --short` and stop if the worktree is dirty.',
  '4. Run the project type checker, commonly `bun run typecheck`.',
  '5. Run the project test suite, commonly `bun test`.',
  '6. Run `<mirror> version plan <target>` and use the planned next version as the source of truth.',
  '7. Update release documentation only when it is part of the project release process.',
  '8. If `[agents].write_changelog = false`, skip changelog edits. Otherwise update `[agents].changelog_path`, defaulting to `CHANGELOG.md` in the project root, and summarize only real changes.',
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
  'Common configuration keys: `[version].source`, `[version].output`, `[version].prerelease_id`, `[git].tag_template`, `[git].commit`, `[git].push`, `[git].allow_dirty`, `[agents].write_changelog`, `[agents].changelog_path`, `[agents].auto_agents_md`, and `[agents].auto_skill_install`.',
  '',
  'Agent automation options default to true. Set `write_changelog = false` to tell agents to skip changelog edits, `changelog_path = "docs/CHANGELOG.md"` to specify the changelog file, `auto_agents_md = false` to stop Mirror from inserting its AGENTS.md section, and `auto_skill_install = false` to stop Mirror from installing `guiho-s-mirror` globally when missing.',
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
