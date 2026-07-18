/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
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
import { mirrorConfigSchemaReference, MirrorRawConfigSchema, decodeWithSchema } from './schema.js'
import { normalizeHooksConfig } from './hooks.js'
import { basenamePath, isAbsolutePath, joinPath, relativePath, resolvePath } from './path.js'
import { fileExists, readTextFile, writeTextFile } from './runtime.js'

export const resolveMirrorPath = (cwd: string, path: string) => (isAbsolutePath(path) ? resolvePath(path) : resolvePath(cwd, path))

export const relativeFromCwd = (cwd: string, path: string) => {
  const relativePathValue = relativePath(cwd, resolveMirrorPath(cwd, path))
  return relativePathValue || '.'
}

export const resolveMirrorHome = () => {
  const home = Bun.env['HOME'] ?? Bun.env['USERPROFILE']
  if (!home) throw new MirrorError('Unable to resolve the user home directory from HOME or USERPROFILE.', 5)
  return resolvePath(home, '.guiho', 'mirror')
}

export const discoverMirrorConfig = async (cwd: string, explicitPath?: string): Promise<MirrorConfigDiscovery> => {
  if (explicitPath) {
    const configPath = resolveMirrorPath(cwd, explicitPath)
    return { path: configPath, raw: await readConfigFile(configPath) }
  }

  const projectPath = resolvePath(cwd, 'mirror.yaml')
  if (await fileExists(projectPath)) return { path: projectPath, raw: await readConfigFile(projectPath) }

  const globalPath = resolvePath(resolveMirrorHome(), 'mirror.yaml')
  if (await fileExists(globalPath)) return { path: globalPath, raw: await readConfigFile(globalPath) }

  return {}
}

export const readConfigFile = async (path: string): Promise<MirrorRawConfig> => {
  if (!(await fileExists(path))) throw new MirrorError(`Configuration file not found: ${path}`, 3)

  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(await readTextFile(path))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Invalid YAML in configuration file: ${path}\n${message}`, 3)
  }

  return decodeWithSchema<typeof MirrorRawConfigSchema, MirrorRawConfig>(MirrorRawConfigSchema, parsed, `Mirror configuration in ${path}`, 3)
}

export const loadMirrorConfig = async (options: MirrorCliOptions = {}): Promise<MirrorConfig> => {
  const cwd = resolvePath(options.cwd ?? process.cwd())
  const discovered = await discoverMirrorConfig(cwd, options.config)

  if (!discovered.raw) throw new MirrorError('Mirror configuration not found. Run `mirror init`.', 3)

  const config = normalizeMirrorConfig(discovered.raw, cwd, discovered.path, options)
  if (config.configPath && options.reportConfig !== false && options.format !== 'json') {
    process.stdout.write(`configuration file loaded: ${config.configPath}\n`)
  }
  return config
}

export const normalizeMirrorConfig = (
  raw: MirrorRawConfig,
  cwd: string,
  configPath: string | undefined,
  options: MirrorCliOptions = {},
): MirrorConfig => {
  const source = options.source ?? raw.version!.source!
  const output = [...new Set(options.output ?? raw.version!.output!)]
  const nameSource: MirrorProjectNameSource | undefined = raw.project?.name_source
  const projectName = raw.project?.name
  const prereleaseId = options.preid ?? raw.version!.prerelease_id ?? ''
  const packagePath = options.packageFile ?? raw.package?.path ?? 'package.json'
  const packageAuxiliaryPaths = raw.package?.auxiliary_paths ?? []
  const jsrPath = options.jsrFile ?? raw.jsr?.path ?? 'jsr.json'
  const tagTemplate = raw.git?.tag_template ?? 'v{version}'
  const gitCommit = raw.git?.commit === true
  const gitPush = raw.git?.push === true
  const gitAllowDirty = raw.git?.allow_dirty === true

  return {
    schema: 1,
    cwd,
    configPath,
    project: { name: projectName, nameSource },
    version: { scheme: 'semver', source, output, prereleaseId },
    package: { path: packagePath, auxiliaryPaths: packageAuxiliaryPaths },
    jsr: { path: jsrPath },
    git: {
      tagTemplate,
      commit: options.commit === true || options.push === true || gitCommit || gitPush,
      push: options.push === true || gitPush,
      allowDirty: options.allowDirty === true || gitAllowDirty,
    },
    agents: {
      writeChangelog: raw.agents?.write_changelog !== false,
      changelogPath: raw.agents?.changelog_path ?? 'CHANGELOG.md',
    },
    hooks: normalizeHooksConfig(raw.hooks),
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

const yamlScalar = (value: string) => JSON.stringify(value)

export const generateInitConfig = (answers: MirrorInitAnswers, cwd: string) => {
  const project = answers.source === 'git'
    ? `  name: ${yamlScalar(answers.name ?? basenamePath(cwd))}`
    : `  name_source: ${yamlScalar(answers.source)}`
  const output = answers.output.map(yamlScalar).join(', ')
  const auxiliary = answers.auxiliaryPaths.map(yamlScalar).join(', ')

  return [
    `# yaml-language-server: $schema=${mirrorConfigSchemaReference}`,
    'schema: 1',
    'project:',
    project,
    'version:',
    '  scheme: semver',
    `  source: ${yamlScalar(answers.source)}`,
    `  output: [${output}]`,
    `  prerelease_id: ${yamlScalar(answers.prereleaseId)}`,
    'package:',
    `  path: ${yamlScalar(answers.packagePath)}`,
    `  auxiliary_paths: [${auxiliary}]`,
    'jsr:',
    `  path: ${yamlScalar(answers.jsrPath)}`,
    'git:',
    `  tag_template: ${yamlScalar(answers.tagTemplate)}`,
    `  commit: ${String(answers.commit)}`,
    `  push: ${String(answers.push)}`,
    '  allow_dirty: false',
    'agents:',
    '  write_changelog: true',
    '  changelog_path: CHANGELOG.md',
    '',
  ].join('\n')
}

export const createInitConfig = (kind: MirrorAdapterName, cwd: string) => generateInitConfig(defaultInitAnswersForSource(kind, cwd), cwd)

export const writeInitConfig = async (kind: MirrorAdapterName, cwd: string, overwrite = false) =>
  writeInitConfigFromAnswers(defaultInitAnswersForSource(kind, cwd), cwd, overwrite)

export const writeInitConfigFromAnswers = async (answers: MirrorInitAnswers, cwd: string, overwrite = false) => {
  const path = joinPath(cwd, 'mirror.yaml')
  const generated = generateInitConfig(answers, cwd)
  if ((await fileExists(path)) && !overwrite) {
    await writeTextFile(path, reconcileInitConfig(await readTextFile(path), generated))
    return path
  }
  await writeTextFile(path, generated)
  return path
}

export const reconcileInitConfig = (existingContent: string, defaultsContent: string) => {
  let existing: unknown
  let defaults: unknown
  try {
    existing = Bun.YAML.parse(existingContent)
    defaults = Bun.YAML.parse(defaultsContent)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Invalid YAML while reconciling configuration: ${message}`, 3)
  }
  const decodedExisting = decodeWithSchema<typeof MirrorRawConfigSchema, MirrorRawConfig>(MirrorRawConfigSchema, existing, 'existing Mirror configuration', 3)
  const decodedDefaults = decodeWithSchema<typeof MirrorRawConfigSchema, MirrorRawConfig>(MirrorRawConfigSchema, defaults, 'default Mirror configuration', 3)
  const merged = deepMerge(decodedDefaults as Record<string, unknown>, decodedExisting as Record<string, unknown>)
  return `${Bun.YAML.stringify(merged, null, 2).trimEnd()}\n`
}

export const configPathForDisplay = (config: MirrorConfig) => config.configPath ?? '(none)'

const deepMerge = (defaults: Record<string, unknown>, existing: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(existing)) {
    if (isRecord(value) && isRecord(defaults[key])) result[key] = deepMerge(defaults[key], value)
    else result[key] = value
  }
  return result
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
