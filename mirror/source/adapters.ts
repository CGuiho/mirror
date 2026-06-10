/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { MirrorConfig, MirrorJsonObject } from './types.js'
import { MirrorError } from './errors.js'
import { assertValidSemver, sortSemverDescending } from './version.js'
import { resolveMirrorPath } from './config.js'
import { fileExists, readTextFile, runCommand, writeTextFile } from './runtime.js'

let gitChecked = false
let gitExists = false

const checkGitAvailable = async () => {
  if (gitChecked) return gitExists
  gitChecked = true
  try {
    const result = await runCommand(['git', '--version'])
    gitExists = result.exitCode === 0
  } catch {
    gitExists = false
  }
  return gitExists
}

export const ensureGitAvailable = async () => {
  if (!(await checkGitAvailable())) {
    throw new MirrorError('Git executable not found. Git is required when using git as a source or output.')
  }
}

const gitNotFoundMessage = 'Git executable not found. Git is required when using git as a source or output.'

const runGit = async (cwd: string, args: string[]) => {
  if (!(await checkGitAvailable())) {
    throw new MirrorError(gitNotFoundMessage)
  }
  try {
    const result = await runCommand(['git', ...args], { cwd })
    if (result.exitCode !== 0) throw new MirrorError([result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n') || `exit code ${result.exitCode}`)
    return result.stdout
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new MirrorError(`Git command failed: git ${args.join(' ')}\n${message}`)
  }
}

export const supportedGitTagTemplates = ['v{version}', '{name}@{version}', '{name}/v{version}'] as const

export const readPackageJson = async (path: string): Promise<MirrorJsonObject> => readJsonObject(path, 'package.json')
export const readJsrJson = async (path: string): Promise<MirrorJsonObject> => readJsonObject(path, 'jsr.json')

export const writeJsonObject = async (path: string, object: MirrorJsonObject) => {
  await writeTextFile(path, `${JSON.stringify(object, null, 2)}\n`)
}

export const readPackageVersion = async (config: MirrorConfig) => readVersionField(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
export const readJsrVersion = async (config: MirrorConfig) => readVersionField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')
export const readPackageVersionFile = async (path: string) => readVersionField(path, 'package.json')
export const readJsrVersionFile = async (path: string) => readVersionField(path, 'jsr.json')
export const readPackageName = async (config: MirrorConfig) => readNameField(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
export const readJsrName = async (config: MirrorConfig) => readNameField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')

export const writePackageVersion = async (config: MirrorConfig, nextVersion: string) =>
  writeVersionField(resolveMirrorPath(config.cwd, config.package.path), 'package.json', nextVersion)

export const writeJsrVersion = async (config: MirrorConfig, nextVersion: string) =>
  writeVersionField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json', nextVersion)

export const writePackageVersionFile = async (path: string, nextVersion: string) => writeVersionField(path, 'package.json', nextVersion)
export const writeJsrVersionFile = async (path: string, nextVersion: string) => writeVersionField(path, 'jsr.json', nextVersion)

export const ensureAdapterFiles = async (config: MirrorConfig) => {
  if (usesAdapter(config, 'package.json')) {
    await ensureFile(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
    for (const path of config.package.auxiliaryPaths) await ensureFile(resolveMirrorPath(config.cwd, path), 'package.json')
  }
  if (usesAdapter(config, 'jsr.json')) await ensureFile(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')
  if (usesAdapter(config, 'git')) await ensureGitRepository(config.cwd)
}

export const resolveProjectName = async (config: MirrorConfig) => {
  if (config.project.name) return config.project.name
  if (config.project.nameSource === 'package.json') return readPackageName(config)
  if (config.project.nameSource === 'jsr.json') return readJsrName(config)
  return undefined
}

export const readCurrentVersion = async (config: MirrorConfig, projectName?: string) => {
  if (config.version.source === 'package.json') return readPackageVersion(config)
  if (config.version.source === 'jsr.json') return readJsrVersion(config)
  return readGitVersion(config, projectName)
}

export const readGitVersion = async (config: MirrorConfig, projectName?: string) => {
  await ensureGitAvailable()
  await ensureGitRepository(config.cwd)

  const tagsOutput = await runGit(config.cwd, ['-C', config.cwd, 'tag', '--list'])
  const versions = tagsOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((tag) => versionFromTag(config.git.tagTemplate, tag, projectName))
    .filter((version): version is string => Boolean(version))

  if (versions.length === 0) throw new MirrorError(`No Git tags match template: ${config.git.tagTemplate}`)

  return sortSemverDescending(versions)[0] ?? ''
}

export const renderGitTag = (template: string, version: string, projectName?: string) => {
  assertSupportedGitTagTemplate(template)
  assertValidSemver(version, 'Git tag version')

  if (template.includes('{name}') && !projectName) throw new MirrorError(`Tag template requires a project name: ${template}`)

  return template.replaceAll('{version}', version).replaceAll('{name}', projectName ?? '')
}

export const versionFromTag = (template: string, tag: string, projectName?: string) => {
  assertSupportedGitTagTemplate(template)

  if (template.includes('{name}') && !projectName) throw new MirrorError(`Tag template requires a project name: ${template}`)

  const escapedTemplate = escapeRegex(template)
    .replaceAll('\\{version\\}', '(?<version>.+)')
    .replaceAll('\\{name\\}', escapeRegex(projectName ?? ''))
  const match = new RegExp(`^${escapedTemplate}$`).exec(tag)
  const version = match?.groups?.['version']

  if (!version) return undefined

  try {
    assertValidSemver(version, 'Git tag version')
    return version
  } catch {
    return undefined
  }
}

export const assertSupportedGitTagTemplate = (template: string) => {
  if (!(supportedGitTagTemplates as readonly string[]).includes(template)) {
    throw new MirrorError(`Unsupported Git tag template: ${template}. Expected v{version}, {name}@{version}, or {name}/v{version}.`)
  }
}

export const isGitRepository = async (cwd: string) => {
  if (!(await checkGitAvailable())) return false
  try {
    const result = await runCommand(['git', '-C', cwd, 'rev-parse', '--is-inside-work-tree'], { cwd })
    return result.exitCode === 0
  } catch {
    return false
  }
}

export const isGitDirty = async (cwd: string) => {
  const output = await runGit(cwd, ['-C', cwd, 'status', '--porcelain'])
  return output.trim().length > 0
}

export const createGitCommit = async (cwd: string, paths: string[], message: string) => {
  await ensureGitAvailable()
  for (const path of paths) await runGit(cwd, ['-C', cwd, 'add', path])
  await runGit(cwd, ['-C', cwd, 'commit', '-m', message])
}

export const createGitTag = async (cwd: string, tag: string) => {
  await ensureGitAvailable()
  await runGit(cwd, ['-C', cwd, 'tag', tag, '-m', `Release ${tag}`])
}

export const pushGitRefs = async (cwd: string, includeCommit: boolean, includeTags: boolean) => {
  await ensureGitAvailable()
  if (includeCommit) await runGit(cwd, ['-C', cwd, 'push'])
  if (includeTags) await runGit(cwd, ['-C', cwd, 'push', '--tags'])
}

const readJsonObject = async (path: string, label: string): Promise<MirrorJsonObject> => {
  await ensureFile(path, label)
  const content = await readTextFile(path)
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new MirrorError(`${label} must contain valid JSON: ${path}`)
  }

  if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new MirrorError(`${label} must contain a JSON object: ${path}`)

  return json as MirrorJsonObject
}

const readVersionField = async (path: string, label: string): Promise<string> => {
  const json = await readJsonObject(path, label)
  const version = json['version']

  if (typeof version !== 'string') throw new MirrorError(`${label} must contain a string version field: ${path}`)
  assertValidSemver(version, `${label} version`)

  return version
}

const readNameField = async (path: string, label: string): Promise<string> => {
  const json = await readJsonObject(path, label)
  const name = json['name']

  if (typeof name !== 'string' || name.length === 0) throw new MirrorError(`${label} must contain a string name field: ${path}`)

  return name
}

const writeVersionField = async (path: string, label: string, nextVersion: string) => {
  const json = await readJsonObject(path, label)
  json['version'] = nextVersion
  await writeJsonObject(path, json)
}

const ensureFile = async (path: string, label: string) => {
  if (!(await fileExists(path))) throw new MirrorError(`${label} file not found: ${path}`)
}

const ensureGitRepository = async (cwd: string) => {
  await ensureGitAvailable()
  if (!(await isGitRepository(cwd))) throw new MirrorError(`Not a Git repository: ${cwd}`)
}

const usesAdapter = (config: MirrorConfig, adapter: 'package.json' | 'jsr.json' | 'git') =>
  config.version.source === adapter || config.version.output.includes(adapter)

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
