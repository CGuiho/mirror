/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { ReleaseType } from 'semver'

export type MirrorAdapterName = 'package.json' | 'jsr.json' | 'git'
export type MirrorProjectNameSource = 'package.json' | 'jsr.json'
export type MirrorFormat = 'text' | 'json'
export type MirrorVersionTarget = ReleaseType | string
export type MirrorJsonObject = Record<string, unknown>
export type MirrorSkillInstallScope = 'local' | 'global'

export type MirrorHookName =
  | 'before:everything' | 'after:everything'
  | 'before:plan' | 'after:plan'
  | 'before:apply' | 'after:apply'
  | 'before:write' | 'after:write'
  | 'before:commit' | 'after:commit'
  | 'before:tag' | 'after:tag'
  | 'before:push' | 'after:push'

export type MirrorHookCommand = string | string[]

export type MirrorHooksConfig = Partial<Record<MirrorHookName, string[]>>

export type MirrorHookResult = {
  name: MirrorHookName
  commands: string[]
  status: 'success' | 'failure' | 'skipped'
  durationMs: number
  exitCode?: number
  stdout?: string
  stderr?: string
}

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
  package: Partial<{
    path: string
    auxiliary_paths: string[]
  }>
  jsr: Partial<{ path: string }>
  git: Partial<{
    tag_template: string
    commit: boolean
    push: boolean
    allow_dirty: boolean
  }>
  agents: Partial<{
    write_changelog: boolean
    changelog_path: string
    auto_agents_md: boolean
    auto_skill_install: boolean
  }>
  hooks: Record<string, MirrorHookCommand>
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
  package: {
    path: string
    auxiliaryPaths: string[]
  }
  jsr: { path: string }
  git: {
    tagTemplate: string
    commit: boolean
    push: boolean
    allowDirty: boolean
  }
  agents: MirrorAgentSettings
  hooks: MirrorHooksConfig
}

export type MirrorAgentSettings = {
  writeChangelog: boolean
  changelogPath: string
  autoAgentsMd: boolean
  autoSkillInstall: boolean
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
  auxiliary?: string[]
  tagTemplate?: string
  name?: string
  preid?: string
  dryRun?: boolean
  commit?: boolean
  push?: boolean
  allowDirty?: boolean
  nonInteractive?: boolean
  yes?: boolean
  verbose?: boolean
}

export type MirrorInitAnswers = {
  source: MirrorAdapterName
  output: MirrorAdapterName[]
  packagePath: string
  auxiliaryPaths: string[]
  jsrPath: string
  name?: string
  prereleaseId: string
  tagTemplate: string
  commit: boolean
  push: boolean
}

export type MirrorInitFlags = Partial<{
  source: MirrorAdapterName
  output: MirrorAdapterName[]
  packagePath: string
  auxiliaryPaths: string[]
  jsrPath: string
  name: string
  prereleaseId: string
  tagTemplate: string
  commit: boolean
  push: boolean
}>

export type MirrorInitPrompter = {
  text(question: string, defaultValue: string): Promise<string>
  confirm(question: string, defaultValue: boolean): Promise<boolean>
  select?(question: string, options: string[], defaultIndex: number): Promise<string>
  close(): Promise<void> | void
}

export type MirrorConfigDiscovery = {
  path?: string
  raw?: MirrorRawConfig
}

export type MirrorSkillInstallResult = {
  scope: MirrorSkillInstallScope
  path: string
  name: string
  version: string
  installed: boolean
  updated: boolean
  migrated: boolean
  removed: string[]
  previousName?: string
  previousVersion?: string
}

export type MirrorAgentsInstructionsResult = {
  path: string
  exists: boolean
  changed: boolean
}

export type MirrorAgentAutomationResult = {
  settings: MirrorAgentSettings
  agentsMd?: MirrorAgentsInstructionsResult
  localSkill?: MirrorSkillInstallResult
  globalSkill?: MirrorSkillInstallResult
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
  hookResults?: MirrorHookResult[]
}
