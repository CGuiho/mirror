/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { $ } from 'bun'
import { existsSync } from 'node:fs'
import type { MirrorConfig, MirrorJsonObject } from './types'
import { MirrorError } from './errors'
import { assertValidSemver, sortSemverDescending } from './version'
import { resolveMirrorPath } from './config'

export const supportedGitTagTemplates = ['v{version}', '{name}@{version}'] as const

export const readPackageJson = async (path: string): Promise<MirrorJsonObject> => readJsonObject(path, 'package.json')
export const readJsrJson = async (path: string): Promise<MirrorJsonObject> => readJsonObject(path, 'jsr.json')

export const writeJsonObject = async (path: string, object: MirrorJsonObject) => {
  await Bun.write(path, `${JSON.stringify(object, null, 2)}\n`)
}

export const readPackageVersion = async (config: MirrorConfig) => readVersionField(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
export const readJsrVersion = async (config: MirrorConfig) => readVersionField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')
export const readPackageName = async (config: MirrorConfig) => readNameField(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
export const readJsrName = async (config: MirrorConfig) => readNameField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')

export const writePackageVersion = async (config: MirrorConfig, nextVersion: string) =>
  writeVersionField(resolveMirrorPath(config.cwd, config.package.path), 'package.json', nextVersion)

export const writeJsrVersion = async (config: MirrorConfig, nextVersion: string) =>
  writeVersionField(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json', nextVersion)

export const ensureAdapterFiles = async (config: MirrorConfig) => {
  if (usesAdapter(config, 'package.json')) ensureFile(resolveMirrorPath(config.cwd, config.package.path), 'package.json')
  if (usesAdapter(config, 'jsr.json')) ensureFile(resolveMirrorPath(config.cwd, config.jsr.path), 'jsr.json')
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
  await ensureGitRepository(config.cwd)

  const tagsOutput = await $`git -C ${config.cwd} tag --list`.text()
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
    throw new MirrorError(`Unsupported Git tag template: ${template}. Expected v{version} or {name}@{version}.`)
  }
}

export const isGitRepository = async (cwd: string) => {
  try {
    await $`git -C ${cwd} rev-parse --is-inside-work-tree`.quiet()
    return true
  } catch {
    return false
  }
}

export const isGitDirty = async (cwd: string) => {
  const output = await $`git -C ${cwd} status --porcelain`.quiet().text()
  return output.trim().length > 0
}

export const createGitCommit = async (cwd: string, paths: string[], message: string) => {
  for (const path of paths) await $`git -C ${cwd} add ${path}`.quiet()
  await $`git -C ${cwd} commit -m ${message}`.quiet()
}

export const createGitTag = async (cwd: string, tag: string) => {
  await $`git -C ${cwd} tag ${tag} -m ${`Release ${tag}`}`.quiet()
}

export const pushGitRefs = async (cwd: string, includeCommit: boolean, includeTags: boolean) => {
  if (includeCommit) await $`git -C ${cwd} push`.quiet()
  if (includeTags) await $`git -C ${cwd} push --tags`.quiet()
}

const readJsonObject = async (path: string, label: string): Promise<MirrorJsonObject> => {
  ensureFile(path, label)
  const json = await Bun.file(path).json()

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

const ensureFile = (path: string, label: string) => {
  if (!existsSync(path)) throw new MirrorError(`${label} file not found: ${path}`)
}

const ensureGitRepository = async (cwd: string) => {
  if (!(await isGitRepository(cwd))) throw new MirrorError(`Not a Git repository: ${cwd}`)
}

const usesAdapter = (config: MirrorConfig, adapter: 'package.json' | 'jsr.json' | 'git') =>
  config.version.source === adapter || config.version.output.includes(adapter)

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
