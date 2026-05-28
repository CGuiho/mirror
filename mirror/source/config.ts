/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import type {
  MirrorAdapterName,
  MirrorCliOptions,
  MirrorConfig,
  MirrorConfigDiscovery,
  MirrorProjectNameSource,
  MirrorRawConfig,
} from './types.js'
import { MirrorError } from './errors.js'

const adapters = new Set(['package.json', 'jsr.json', 'git'])
const projectNameSources = new Set(['package.json', 'jsr.json'])

export const resolveMirrorPath = (cwd: string, path: string) => (isAbsolute(path) ? path : resolve(cwd, path))

export const relativeFromCwd = (cwd: string, path: string) => {
  const relativePath = relative(cwd, resolveMirrorPath(cwd, path))
  return relativePath || '.'
}

export const discoverMirrorConfig = async (cwd: string, explicitPath?: string): Promise<MirrorConfigDiscovery> => {
  if (explicitPath) {
    const configPath = resolveMirrorPath(cwd, explicitPath)
    return { path: configPath, raw: await readConfigFile(configPath) }
  }

  const rootConfigPath = resolve(cwd, 'mirror.config.toml')
  if (existsSync(rootConfigPath)) return { path: rootConfigPath, raw: await readConfigFile(rootConfigPath) }

  const nestedConfigPath = resolve(cwd, 'config', 'mirror.config.toml')
  if (existsSync(nestedConfigPath)) return { path: nestedConfigPath, raw: await readConfigFile(nestedConfigPath) }

  return {}
}

export const readConfigFile = async (path: string): Promise<MirrorRawConfig> => {
  if (!existsSync(path)) throw new MirrorError(`Configuration file not found: ${path}`)

  const content = await readFile(path, 'utf8')
  let parsed: unknown
  try {
    parsed = parseToml(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Invalid TOML in configuration file: ${path}\n${message}`)
  }

  if (!isRecord(parsed)) throw new MirrorError(`Configuration file must contain a TOML object: ${path}`)

  return parsed as MirrorRawConfig
}

export const loadMirrorConfig = async (options: MirrorCliOptions = {}): Promise<MirrorConfig> => {
  const cwd = resolve(options.cwd ?? process.cwd())
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
  const jsrPath = options.jsrFile ?? optionalString(raw.jsr?.path, 'jsr.path') ?? 'jsr.json'
  const tagTemplate = optionalString(raw.git?.tag_template, 'git.tag_template') ?? 'v{version}'
  const gitCommit = optionalBoolean(raw.git?.commit, 'git.commit') === true
  const gitPush = optionalBoolean(raw.git?.push, 'git.push') === true
  const gitAllowDirty = optionalBoolean(raw.git?.allow_dirty, 'git.allow_dirty') === true

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
  }
}

export const createInitConfig = (kind: MirrorAdapterName, cwd: string) => {
  const projectName = basename(cwd)

  if (kind === 'package.json') {
    return `schema = 1

[project]
name_source = "package.json"

[version]
scheme = "semver"
source = "package.json"
output = ["package.json"]
prerelease_id = ""

[package]
path = "package.json"

[jsr]
path = "jsr.json"

[git]
tag_template = "{name}@{version}"
commit = false
push = false
allow_dirty = false
`
  }

  if (kind === 'jsr.json') {
    return `schema = 1

[project]
name_source = "jsr.json"

[version]
scheme = "semver"
source = "jsr.json"
output = ["jsr.json"]
prerelease_id = ""

[jsr]
path = "jsr.json"

[git]
tag_template = "{name}@{version}"
commit = false
push = false
allow_dirty = false
`
  }

  return `schema = 1

[project]
name = "${projectName}"

[version]
scheme = "semver"
source = "git"
output = ["git"]
prerelease_id = ""

[git]
tag_template = "v{version}"
commit = false
push = false
allow_dirty = false
`
}

export const writeInitConfig = async (kind: MirrorAdapterName, cwd: string, overwrite = false) => {
  const path = join(cwd, 'mirror.config.toml')

  if (existsSync(path) && !overwrite) throw new MirrorError(`Configuration already exists: ${path}`)

  await writeFile(path, createInitConfig(kind, cwd), 'utf8')
  return path
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
