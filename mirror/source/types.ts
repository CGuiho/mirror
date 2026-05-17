/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { ReleaseType } from 'semver'

export type MirrorAdapterName = 'package.json' | 'jsr.json' | 'git'
export type MirrorProjectNameSource = 'package.json' | 'jsr.json'
export type MirrorFormat = 'text' | 'json'
export type MirrorVersionTarget = ReleaseType | string
export type MirrorJsonObject = Record<string, unknown>

export type MirrorRawConfig = Partial<{
  schema: number
  project: Partial<{
    name: string
    name_source: MirrorProjectNameSource
  }>
  version: Partial<{
    scheme: 'semver'
    source: MirrorAdapterName
    output: MirrorAdapterName[]
    prerelease_id: string
  }>
  package: Partial<{ path: string }>
  jsr: Partial<{ path: string }>
  git: Partial<{
    tag_template: string
    commit: boolean
    push: boolean
    allow_dirty: boolean
  }>
}>

export type MirrorConfig = {
  schema: 1
  cwd: string
  configPath?: string
  project: {
    name?: string
    nameSource?: MirrorProjectNameSource
  }
  version: {
    scheme: 'semver'
    source: MirrorAdapterName
    output: MirrorAdapterName[]
    prereleaseId: string
  }
  package: { path: string }
  jsr: { path: string }
  git: {
    tagTemplate: string
    commit: boolean
    push: boolean
    allowDirty: boolean
  }
}

export type MirrorCliOptions = {
  cwd?: string
  config?: string
  format?: MirrorFormat
  noColor?: boolean
  source?: MirrorAdapterName
  output?: MirrorAdapterName[]
  packageFile?: string
  jsrFile?: string
  preid?: string
  dryRun?: boolean
  commit?: boolean
  push?: boolean
  allowDirty?: boolean
  yes?: boolean
  verbose?: boolean
}

export type MirrorConfigDiscovery = {
  path?: string
  raw?: MirrorRawConfig
}

export type MirrorProject = {
  name?: string
}

export type MirrorVersionPlanAction =
  | {
      type: 'write-file'
      adapter: 'package.json' | 'jsr.json'
      path: string
      currentVersion: string
      nextVersion: string
    }
  | {
      type: 'git-commit'
      message: string
      paths: string[]
    }
  | {
      type: 'git-tag'
      tag: string
    }
  | {
      type: 'git-push'
      includeCommit: boolean
      includeTags: boolean
    }

export type MirrorVersionPlan = {
  cwd: string
  configPath?: string
  source: MirrorAdapterName
  output: MirrorAdapterName[]
  currentVersion: string
  nextVersion: string
  project: MirrorProject
  commitEnabled: boolean
  pushEnabled: boolean
  allowDirty: boolean
  fileOutputPaths: string[]
  gitTag?: string
  actions: MirrorVersionPlanAction[]
}

export type MirrorExecutionResult = {
  plan: MirrorVersionPlan
  applied: boolean
  dryRun: boolean
}
