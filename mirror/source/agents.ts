/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type {
  MirrorAgentTool,
  MirrorAgentToolSelection,
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
export const mirrorAgentsSectionStartMarker = '<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->'
export const mirrorAgentsSectionEndMarker = '<!-- END MIRROR -->'
export const mirrorAgentsSectionHeading = '## Semantic Project Versioning -- GUIHO Mirror'
export const mirrorAgentTools = ['agents', 'claude'] as const
export const mirrorAgentToolSelections = [...mirrorAgentTools, 'all'] as const

export const defaultMirrorAgentSettings: MirrorAgentSettings = {
  writeChangelog: true,
  changelogPath: 'CHANGELOG.md',
}

const mirrorAgentsSectionBody = `${mirrorAgentsSectionHeading}

Invoke the guiho-s-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.

Before editing release docs or changelogs, inspect mirror.yaml. If agents.write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.

Use [agents].changelog_path as the changelog file path. If it is missing, use CHANGELOG.md in the project root.
`

export const mirrorAgentsSection = `${mirrorAgentsSectionStartMarker}
${mirrorAgentsSectionBody.trimEnd()}
${mirrorAgentsSectionEndMarker}`

type MirrorSkillPathOptions = {
  cwd?: string
  homeDirectory?: string
  tool?: MirrorAgentTool
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

type MirrorAgentInstructionTarget = {
  tool: MirrorAgentTool
  path: string
  create: boolean
}

const mirrorSkillInstallNames = [...legacyMirrorSkillNames, mirrorSkillName] as const
const mirrorAgentInstructionFiles: Record<MirrorAgentTool, string> = {
  agents: 'AGENTS.md',
  claude: 'CLAUDE.md',
}
const mirrorAgentInstructionHeadings: Record<MirrorAgentTool, string> = {
  agents: 'Project Agents',
  claude: 'Claude Code',
}

export const resolveMirrorSkillPath = (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) => {
  return resolveMirrorSkillPathForName(scope, mirrorSkillName, options)
}

export const isMirrorSkillInstalled = async (scope: MirrorSkillInstallScope, options: MirrorSkillPathOptions = {}) =>
  fileExists(resolveMirrorSkillPath(scope, options))

export const installMirrorSkill = async (
  scope: MirrorSkillInstallScope,
  options: MirrorSkillInstallOptions = {},
): Promise<MirrorSkillInstallResult> => {
  const tool = options.tool ?? 'agents'
  const path = resolveMirrorSkillPath(scope, options)
  const content = await readBundledMirrorSkill()
  const version = readMirrorSkillVersion(content) ?? mirrorSkillVersion
  const installedSkills = await readInstalledMirrorSkills(scope, options)
  const legacySkill = installedSkills.find((skill) => skill.name !== mirrorSkillName)
  const currentSkill = installedSkills.find((skill) => skill.name === mirrorSkillName)
  const previousSkill = legacySkill ?? currentSkill

  if (!shouldWriteBundledMirrorSkill(installedSkills, content, version, options.overwrite)) {
    return {
      tool,
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
    tool,
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

export const installMirrorSkills = async (
  scope: MirrorSkillInstallScope,
  tool: MirrorAgentToolSelection = 'agents',
  options: MirrorSkillInstallOptions = {},
) => {
  const results: MirrorSkillInstallResult[] = []

  for (const targetTool of resolveMirrorAgentTools(tool)) {
    results.push(await installMirrorSkill(scope, { ...options, tool: targetTool }))
  }

  return results
}

export const uninstallMirrorSkills = async (
  scope: MirrorSkillInstallScope,
  options: MirrorSkillPathOptions = {},
) => {
  const removed: string[] = []
  for (const tool of mirrorAgentTools) {
    for (const name of mirrorSkillInstallNames) {
      const path = resolveMirrorSkillPathForName(scope, name, { ...options, tool })
      const directory = dirnamePath(path)
      if (!(await fileExists(path))) continue
      await removePath(directory)
      removed.push(directory)
    }
  }
  return removed
}

export const listMirrorSkills = async (filter?: string) => {
  const description = readMirrorSkillFrontmatterValue(await readBundledMirrorSkill(), 'description') ?? ''
  const resources = [{ id: mirrorSkillName, name: mirrorSkillName, description, version: mirrorSkillVersion }]
  if (!filter) return resources
  const needle = filter.toLocaleLowerCase()
  return resources.filter((resource) => `${resource.id} ${resource.description}`.toLocaleLowerCase().includes(needle))
}

export const showMirrorSkill = async (id: string) => {
  if (id !== mirrorSkillName) throw new MirrorError(`Unknown skill: ${id}`, 2)
  const content = await readBundledMirrorSkill()
  return {
    id,
    name: id,
    description: readMirrorSkillFrontmatterValue(content, 'description') ?? '',
    version: readMirrorSkillVersion(content) ?? mirrorSkillVersion,
    path: Bun.fileURLToPath(new URL('../skills/guiho-s-mirror/SKILL.md', import.meta.url)),
    content,
  }
}

export const showMirrorInstructionTemplate = () => `${mirrorAgentsSection}\n`

export const removeMirrorAgentInstructionFiles = async (cwd: string): Promise<MirrorAgentsInstructionsResult[]> => {
  const results: MirrorAgentsInstructionsResult[] = []
  for (const tool of mirrorAgentTools) {
    const path = resolvePath(cwd, mirrorAgentInstructionFiles[tool])
    if (!(await fileExists(path))) {
      results.push({ tool, path, exists: false, changed: false })
      continue
    }
    const content = await readTextFile(path)
    const markerPattern = new RegExp(`\\s*${escapeRegExp(mirrorAgentsSectionStartMarker)}[\\s\\S]*?${escapeRegExp(mirrorAgentsSectionEndMarker)}\\s*`)
    const next = content.replace(markerPattern, '\n').trimEnd()
    if (next === content.trimEnd()) {
      results.push({ tool, path, exists: true, changed: false })
      continue
    }
    await writeTextFile(path, `${next}\n`)
    results.push({ tool, path, exists: true, changed: true })
  }
  return results
}

export const mirrorPromptCatalog = [{
  id: 'guiho-i-mirror',
  name: 'guiho-i-mirror',
  description: 'Plan and execute a safe Mirror-managed semantic version release.',
}] as const

export const showMirrorPrompt = async (id: string) => {
  if (id !== 'guiho-i-mirror') throw new MirrorError(`Unknown prompt: ${id}`, 2)
  try {
    return await Bun.file(new URL('../prompts/guiho-i-mirror.md', import.meta.url)).text()
  } catch {
    return '# Mirror Release\n\nInspect mirror.yaml, validate the project, run `mirror version plan <target>`, then apply only after approval.\n'
  }
}

export const ensureMirrorAgentsInstructions = async (cwd: string, create = false): Promise<MirrorAgentsInstructionsResult> => {
  return ensureMirrorAgentInstructions(cwd, 'agents', create)
}

export const ensureMirrorAgentInstructions = async (
  cwd: string,
  tool: MirrorAgentTool,
  create = false,
): Promise<MirrorAgentsInstructionsResult> => {
  const path = await findMirrorAgentInstructionsFile(cwd, tool) ?? resolvePath(cwd, mirrorAgentInstructionFiles[tool])
  const exists = await fileExists(path)

  if (!exists && !create) return { tool, path, exists: false, changed: false }

  if (!exists) {
    await writeTextFile(path, `# ${mirrorAgentInstructionHeadings[tool]}\n\n${mirrorAgentsSection}\n`)
    return { tool, path, exists: true, changed: true }
  }

  const content = await readTextFile(path)
  if (hasCurrentMirrorAgentsSection(content)) return { tool, path, exists: true, changed: false }

  const replacedContent = replaceExistingMirrorAgentsSection(content)
  if (replacedContent !== content) {
    await writeTextFile(path, replacedContent)
    return { tool, path, exists: true, changed: true }
  }

  const nextContent = `${content.trimEnd()}\n\n${mirrorAgentsSection}\n`
  await writeTextFile(path, nextContent)

  return { tool, path, exists: true, changed: true }
}

export const ensureMirrorAgentInstructionFiles = async (
  cwd: string,
  tool: MirrorAgentToolSelection = 'agents',
  create = false,
  detectExisting = true,
): Promise<MirrorAgentsInstructionsResult[]> => {
  const targets = await resolveMirrorAgentInstructionTargets(cwd, tool, create, detectExisting)
  const results: MirrorAgentsInstructionsResult[] = []

  for (const target of targets) {
    results.push(await ensureMirrorAgentInstructionsAtPath(target.path, target.tool, target.create))
  }

  return results
}

export const findAgentsFile = async (cwd: string): Promise<string | undefined> => {
  return findMirrorAgentInstructionsFile(cwd, 'agents')
}

export const findMirrorAgentInstructionsFile = async (cwd: string, tool: MirrorAgentTool): Promise<string | undefined> => {
  const path = resolvePath(cwd, mirrorAgentInstructionFiles[tool])
  return await fileExists(path) ? path : undefined
}

const ensureMirrorAgentInstructionsAtPath = async (
  path: string,
  tool: MirrorAgentTool,
  create: boolean,
): Promise<MirrorAgentsInstructionsResult> => {
  const exists = await fileExists(path)

  if (!exists && !create) return { tool, path, exists: false, changed: false }

  if (!exists) {
    await writeTextFile(path, `# ${mirrorAgentInstructionHeadings[tool]}\n\n${mirrorAgentsSection}\n`)
    return { tool, path, exists: true, changed: true }
  }

  const content = await readTextFile(path)
  if (hasCurrentMirrorAgentsSection(content)) return { tool, path, exists: true, changed: false }

  const replacedContent = replaceExistingMirrorAgentsSection(content)
  if (replacedContent !== content) {
    await writeTextFile(path, replacedContent)
    return { tool, path, exists: true, changed: true }
  }

  const nextContent = `${content.trimEnd()}\n\n${mirrorAgentsSection}\n`
  await writeTextFile(path, nextContent)

  return { tool, path, exists: true, changed: true }
}

const resolveMirrorAgentInstructionTargets = async (
  cwd: string,
  selection: MirrorAgentToolSelection,
  create: boolean,
  detectExisting: boolean,
): Promise<MirrorAgentInstructionTarget[]> => {
  const normalizedCwd = resolvePath(cwd)

  if (selection === 'all' || selection === 'claude' || !detectExisting) {
    const targets: MirrorAgentInstructionTarget[] = []

    for (const tool of resolveMirrorAgentTools(selection)) {
      targets.push({
        tool,
        path: await findMirrorAgentInstructionsFile(normalizedCwd, tool) ?? resolvePath(normalizedCwd, mirrorAgentInstructionFiles[tool]),
        create,
      })
    }

    return targets
  }

  const existingTargets: MirrorAgentInstructionTarget[] = []

  for (const tool of mirrorAgentTools) {
    const path = await findMirrorAgentInstructionsFile(normalizedCwd, tool)
    if (path) existingTargets.push({ tool, path, create: false })
  }

  if (existingTargets.length > 0) return existingTargets

  return [{
    tool: 'agents' as const,
    path: resolvePath(normalizedCwd, mirrorAgentInstructionFiles.agents),
    create,
  }]
}

export const resolveMirrorAgentSettings = async (options: MirrorCliOptions = {}): Promise<MirrorAgentSettings> => {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const discovered = await discoverMirrorConfig(cwd, options.config)

  if (!discovered.raw) return { ...defaultMirrorAgentSettings }
  if (discovered.raw.schema !== 1) throw new MirrorError('Unsupported or missing configuration schema. Expected `schema = 1`.')

  return {
    writeChangelog: optionalBoolean(discovered.raw.agents?.write_changelog, 'agents.write_changelog') !== false,
    changelogPath: optionalString(discovered.raw.agents?.changelog_path, 'agents.changelog_path') ?? 'CHANGELOG.md',
  }
}

const readBundledMirrorSkill = async () => {
  try {
    return withBundledMirrorSkillVersion(await Bun.file(new URL('../skills/guiho-s-mirror/SKILL.md', import.meta.url)).text())
  } catch {
    return withBundledMirrorSkillVersion(embeddedMirrorSkillContent)
  }
}

export const resolveMirrorAgentTools = (selection: MirrorAgentToolSelection = 'agents'): MirrorAgentTool[] => {
  if (selection === 'all') return [...mirrorAgentTools]
  return [selection]
}

const resolveMirrorSkillPathForName = (scope: MirrorSkillInstallScope, name: string, options: MirrorSkillPathOptions = {}) => {
  const tool = options.tool ?? 'agents'
  const directory = tool === 'claude' ? '.claude' : '.agents'

  if (scope === 'local') return resolvePath(options.cwd ?? process.cwd(), directory, 'skills', name, 'SKILL.md')

  return resolvePath(resolveMirrorAgentHome(options.homeDirectory), directory, 'skills', name, 'SKILL.md')
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

  const legacyMarkerPattern = /<!-- BEGIN GUIHO MIRROR - DO NOT EDIT THIS SECTION -->[\s\S]*?<!-- END GUIHO MIRROR -->/
  if (legacyMarkerPattern.test(content)) return content.replace(legacyMarkerPattern, mirrorAgentsSection)

  return content
}

const normalizeMirrorAgentsSection = (content: string) => content.replace(/\s+/g, ' ').trim()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const embeddedMirrorSkillContent = [
  '---',
  'name: guiho-s-mirror',
  `version: ${mirrorSkillVersion}`,
  'description: Use whenever planning, applying, validating, or troubleshooting semantic project versioning with GUIHO Mirror.',
  '---',
  '',
  '# GUIHO Mirror',
  '',
  'Use Mirror instead of manual version edits or manual release tags.',
  '',
  '## Required Workflow',
  '',
  '1. Read `mirror.yaml` and repository instructions.',
  '2. Run project validation.',
  '3. Run `mirror version plan <target>`.',
  '4. Apply only after reviewing the planned file, Git, tag, and push effects.',
  '',
  'Mirror resolves YAML from `--config`, `./mirror.yaml`, then `~/.guiho/mirror/mirror.yaml`.',
  'Use explicit `mirror agent` commands for skill, instruction, and prompt operations.',
  '',
].join('\n')
