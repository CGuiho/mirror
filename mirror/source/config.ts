/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type {
  MirrorAdapterName,
  MirrorCliOptions,
  MirrorConfig,
  MirrorConfigDiscovery,
  MirrorInitAnswers,
  MirrorProjectNameSource,
  MirrorRawConfig,
} from './types.js'
import { MirrorError } from './errors.js'
import { mirrorConfigSchemaReference } from './schema.js'
import { normalizeHooksConfig } from './hooks.js'
import { basenamePath, isAbsolutePath, joinPath, relativePath, resolvePath } from './path.js'
import { fileExists, readTextFile, writeTextFile } from './runtime.js'

const adapters = new Set(['package.json', 'jsr.json', 'git'])
const projectNameSources = new Set(['package.json', 'jsr.json'])

export const resolveMirrorPath = (cwd: string, path: string) => (isAbsolutePath(path) ? resolvePath(path) : resolvePath(cwd, path))

export const relativeFromCwd = (cwd: string, path: string) => {
  const relativePathValue = relativePath(cwd, resolveMirrorPath(cwd, path))
  return relativePathValue || '.'
}

export const discoverMirrorConfig = async (cwd: string, explicitPath?: string): Promise<MirrorConfigDiscovery> => {
  if (explicitPath) {
    const configPath = resolveMirrorPath(cwd, explicitPath)
    return { path: configPath, raw: await readConfigFile(configPath) }
  }

  const rootConfigPath = resolvePath(cwd, 'mirror.config.toml')
  if (await fileExists(rootConfigPath)) return { path: rootConfigPath, raw: await readConfigFile(rootConfigPath) }

  const nestedConfigPath = resolvePath(cwd, 'config', 'mirror.config.toml')
  if (await fileExists(nestedConfigPath)) return { path: nestedConfigPath, raw: await readConfigFile(nestedConfigPath) }

  return {}
}

export const readConfigFile = async (path: string): Promise<MirrorRawConfig> => {
  if (!(await fileExists(path))) throw new MirrorError(`Configuration file not found: ${path}`)

  const content = await readTextFile(path)
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Invalid TOML in configuration file: ${path}\n${message}`)
  }

  if (!isRecord(parsed)) throw new MirrorError(`Configuration file must contain a TOML object: ${path}`)

  return parsed as MirrorRawConfig
}

export const loadMirrorConfig = async (options: MirrorCliOptions = {}): Promise<MirrorConfig> => {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const discovered = await discoverMirrorConfig(cwd, options.config)

  if (!discovered.raw) throw new MirrorError('Mirror configuration not found. Run `mirror init package`, `mirror init jsr`, or `mirror init git`.')

  return normalizeMirrorConfig(discovered.raw, cwd, discovered.path, options)
}

export const normalizeMirrorConfig = (
  raw: MirrorRawConfig,
  cwd: string,
  configPath: string | undefined,
  options: MirrorCliOptions = {},
): MirrorConfig => {
  if (raw.schema !== 1) throw new MirrorError('Unsupported or missing configuration schema. Expected `schema = 1`.')
  if (raw.version?.scheme !== undefined && raw.version.scheme !== 'semver') throw new MirrorError('Only `version.scheme = "semver"` is supported.')

  const source = options.source ?? assertAdapter(raw.version?.source, 'version.source')
  const output = dedupeAdapters(options.output ?? assertOutput(raw.version?.output))
  const nameSource: MirrorProjectNameSource | undefined = raw.project?.name_source
    ? assertProjectNameSource(raw.project.name_source, 'project.name_source')
    : undefined
  const projectName = optionalString(raw.project?.name, 'project.name')
  const prereleaseId = options.preid ?? optionalString(raw.version?.prerelease_id, 'version.prerelease_id') ?? ''
  const packagePath = options.packageFile ?? optionalString(raw.package?.path, 'package.path') ?? 'package.json'
  const packageAuxiliaryPaths = assertStringArray(raw.package?.auxiliary_paths, 'package.auxiliary_paths')
  const jsrPath = options.jsrFile ?? optionalString(raw.jsr?.path, 'jsr.path') ?? 'jsr.json'
  const tagTemplate = optionalString(raw.git?.tag_template, 'git.tag_template') ?? 'v{version}'
  const gitCommit = optionalBoolean(raw.git?.commit, 'git.commit') === true
  const gitPush = optionalBoolean(raw.git?.push, 'git.push') === true
  const gitAllowDirty = optionalBoolean(raw.git?.allow_dirty, 'git.allow_dirty') === true
  const writeChangelog = optionalBoolean(raw.agents?.write_changelog, 'agents.write_changelog') !== false
  const changelogPath = optionalString(raw.agents?.changelog_path, 'agents.changelog_path') ?? 'CHANGELOG.md'
  const autoAgentsMd = optionalBoolean(raw.agents?.auto_agents_md, 'agents.auto_agents_md') !== false
  const autoSkillInstall = optionalBoolean(raw.agents?.auto_skill_install, 'agents.auto_skill_install') !== false
  const hooks = normalizeHooksConfig(raw.hooks)

  return {
    schema: 1,
    cwd,
    configPath,
    project: {
      name: projectName,
      nameSource,
    },
    version: {
      scheme: 'semver',
      source,
      output,
      prereleaseId,
    },
    package: {
      path: packagePath,
      auxiliaryPaths: packageAuxiliaryPaths,
    },
    jsr: {
      path: jsrPath,
    },
    git: {
      tagTemplate,
      commit: options.commit === true || options.push === true || gitCommit || gitPush,
      push: options.push === true || gitPush,
      allowDirty: options.allowDirty === true || gitAllowDirty,
    },
    agents: {
      writeChangelog,
      changelogPath,
      autoAgentsMd,
      autoSkillInstall,
    },
    hooks,
  }
}

export const defaultInitAnswersForSource = (kind: MirrorAdapterName, cwd: string): MirrorInitAnswers => ({
  source: kind,
  output: kind === 'git' ? ['git'] : [kind, 'git'],
  packagePath: 'package.json',
  auxiliaryPaths: [],
  jsrPath: 'jsr.json',
  name: kind === 'git' ? basenamePath(cwd) : undefined,
  prereleaseId: '',
  tagTemplate: '{name}@{version}',
  commit: kind !== 'git',
  push: false,
})

export const generateInitConfig = (answers: MirrorInitAnswers, cwd: string) => {
  const lines: string[] = []

  lines.push(`#:schema ${mirrorConfigSchemaReference}`)
  lines.push('')
  lines.push('schema = 1')
  lines.push('')
  lines.push('[project]')
  if (answers.source === 'package.json') lines.push('name_source = "package.json"')
  else if (answers.source === 'jsr.json') lines.push('name_source = "jsr.json"')
  else lines.push(`name = "${answers.name ?? basenamePath(cwd)}"`)
  lines.push('')
  lines.push('[version]')
  lines.push('scheme = "semver"')
  lines.push(`source = "${answers.source}"`)
  lines.push(`output = [${answers.output.map((value) => `"${value}"`).join(', ')}]`)
  lines.push(`prerelease_id = "${answers.prereleaseId}"`)
  lines.push('')
  lines.push('[package]')
  lines.push(`path = "${answers.packagePath}"`)
  lines.push(`auxiliary_paths = [${answers.auxiliaryPaths.map((value) => `"${value}"`).join(', ')}]`)
  lines.push('')
  lines.push('[jsr]')
  lines.push(`path = "${answers.jsrPath}"`)
  lines.push('')
  lines.push('[git]')
  lines.push(`tag_template = "${answers.tagTemplate}"`)
  lines.push(`commit = ${String(answers.commit)}`)
  lines.push(`push = ${String(answers.push)}`)
  lines.push('allow_dirty = false')
  lines.push('')
  lines.push('[agents]')
  lines.push('write_changelog = true')
  lines.push('changelog_path = "CHANGELOG.md"')
  lines.push('auto_agents_md = true')
  lines.push('auto_skill_install = true')

  return `${lines.join('\n')}\n`
}

export const createInitConfig = (kind: MirrorAdapterName, cwd: string) => generateInitConfig(defaultInitAnswersForSource(kind, cwd), cwd)

export const writeInitConfig = async (kind: MirrorAdapterName, cwd: string, overwrite = false) =>
  writeInitConfigFromAnswers(defaultInitAnswersForSource(kind, cwd), cwd, overwrite)

export const writeInitConfigFromAnswers = async (answers: MirrorInitAnswers, cwd: string, overwrite = false) => {
  const path = joinPath(cwd, 'mirror.config.toml')
  const generated = generateInitConfig(answers, cwd)

  if ((await fileExists(path)) && !overwrite) {
    await writeTextFile(path, reconcileInitConfig(await readTextFile(path), generated))
    return path
  }

  await writeTextFile(path, generated)
  return path
}

export const reconcileInitConfig = (existingContent: string, defaultsContent: string) => {
  const existingRaw = parseConfigContent(existingContent, 'existing configuration')
  const defaultsRaw = parseConfigContent(defaultsContent, 'default configuration')
  const additions: string[] = []

  for (const [sectionName, defaultSection] of Object.entries(defaultsRaw)) {
    if (!isRecord(defaultSection)) continue

    const existingSection = existingRaw[sectionName]

    if (!isRecord(existingSection)) {
      additions.push(renderTomlSection(sectionName, defaultSection))
      continue
    }

    const missingValues = Object.fromEntries(
      Object.entries(defaultSection).filter(([key]) => existingSection[key] === undefined),
    )

    if (Object.keys(missingValues).length > 0) existingContent = insertTomlValuesIntoSection(existingContent, sectionName, missingValues)
  }

  if (additions.length === 0) return existingContent

  return `${existingContent.trimEnd()}\n\n${additions.join('\n\n')}\n`
}

export const configPathForDisplay = (config: MirrorConfig) => (config.configPath ? relativeFromCwd(config.cwd, config.configPath) : '(none)')

const assertAdapter = (value: unknown, key: string): MirrorAdapterName => {
  if (typeof value !== 'string' || !adapters.has(value)) throw new MirrorError(`Invalid or missing ${key}. Expected package.json, jsr.json, or git.`)
  return value as MirrorAdapterName
}

const assertProjectNameSource = (value: unknown, key: string): MirrorProjectNameSource => {
  if (typeof value !== 'string' || !projectNameSources.has(value)) throw new MirrorError(`Invalid ${key}. Expected package.json or jsr.json.`)
  return value as MirrorProjectNameSource
}

const assertOutput = (value: unknown): MirrorAdapterName[] => {
  if (!Array.isArray(value) || value.length === 0) throw new MirrorError('Invalid or missing version.output. Expected at least one output adapter.')
  return value.map((item) => assertAdapter(item, 'version.output'))
}

const assertStringArray = (value: unknown, key: string) => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new MirrorError(`Invalid ${key}. Expected an array of strings.`)
  return value.map((item) => {
    if (typeof item !== 'string' || item.length === 0) throw new MirrorError(`Invalid ${key}. Expected an array of strings.`)
    return item
  })
}

const dedupeAdapters = (value: MirrorAdapterName[]) => [...new Set(value)]

const optionalString = (value: unknown, key: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new MirrorError(`Invalid ${key}. Expected a string.`)
  return value
}

const optionalBoolean = (value: unknown, key: string) => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new MirrorError(`Invalid ${key}. Expected true or false.`)
  return value
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const parseConfigContent = (content: string, label: string): Record<string, unknown> => {
  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Invalid TOML in ${label}:\n${message}`)
  }

  if (!isRecord(parsed)) throw new MirrorError(`Invalid ${label}. Expected a TOML object.`)
  return parsed
}

const renderTomlSection = (sectionName: string, values: Record<string, unknown>) => {
  const lines = [`[${sectionName}]`]

  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key} = ${renderTomlValue(value)}`)
  }

  return lines.join('\n')
}

const insertTomlValuesIntoSection = (content: string, sectionName: string, values: Record<string, unknown>) => {
  const lines = content.split(/\r?\n/)
  const sectionIndex = lines.findIndex((line) => line.trim() === `[${sectionName}]`)

  if (sectionIndex === -1) return `${content.trimEnd()}\n\n${renderTomlSection(sectionName, values)}\n`

  const nextSectionIndex = lines.findIndex((line, index) => index > sectionIndex && /^\[[^\]]+]\s*$/.test(line.trim()))
  const insertIndex = nextSectionIndex === -1 ? lines.length : nextSectionIndex
  const renderedValues = Object.entries(values).map(([key, value]) => `${key} = ${renderTomlValue(value)}`)

  lines.splice(insertIndex, 0, ...renderedValues)

  return lines.join('\n')
}

const renderTomlValue = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(renderTomlValue).join(', ')}]`
  throw new MirrorError('Cannot render unsupported init configuration value.')
}
