/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
  applyVersionPlan,
  buildVersionPlan,
  ensureMirrorAgentsInstructions,
  generateInitConfig,
  hookEnvForAction,
  hookEnvForPlan,
  hookEnvFromConfig,
  installMirrorSkill,
  loadMirrorConfig,
  mirrorSkillName,
  mirrorSkillVersion,
  mirrorAgentsSectionEndMarker,
  mirrorAgentsSectionHeading,
  mirrorAgentsSectionStartMarker,
  normalizeHooksConfig,
  parseMirrorCliOptions,
  readJsrName,
  readJsrVersion,
  readPackageName,
  readPackageVersion,
  readPackageVersionFile,
  renderGitTag,
  renderMirrorConfigJsonSchema,
  resolveInitAnswers,
  resolveMirrorSkillPath,
  resolveNextVersion,
  runHooks,
  runMirrorAgentAutomation,
  validateMirrorConfig,
  versionFromTag,
  writeJsrVersion,
  writePackageVersion,
} from './guiho-mirror.js'
import type { MirrorAdapterName, MirrorInitPrompter, MirrorVersionPlan } from './guiho-mirror.js'
import { dirnamePath, joinPath } from './path.js'
import { ensureDirectory, makeTempDirectory, readTextFile, removePath, writeTextFile } from './runtime.js'

const existsSync = (path: string) => Bun.file(path).exists()
const mkdir = (path: string, _options?: { recursive?: boolean }) => ensureDirectory(path)
const rm = (path: string, _options?: { recursive?: boolean, force?: boolean }) => removePath(path)
const readFile = (path: string, _encoding?: 'utf8') => readTextFile(path)
const writeFile = (path: string, content: string, _encoding?: 'utf8') => writeTextFile(path, content)
const platform = () => process.platform
const dirname = dirnamePath
const join = joinPath

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('Mirror v3', () => {
  test('parses operational and override flags', () => {
    const options = parseMirrorCliOptions([
      '--source',
      'package.json',
      '--output',
      'package.json',
      '--output=jsr.json,git',
      '--package-file=custom-package.json',
      '--jsr-file',
      'custom-jsr.json',
      '--preid',
      'alpha',
      '--dry-run',
      '--commit',
      '--push',
      '--allow-dirty',
      '--yes',
    ])

    expect(options).toMatchObject({
      source: 'package.json',
      output: ['package.json', 'jsr.json', 'git'],
      packageFile: 'custom-package.json',
      jsrFile: 'custom-jsr.json',
      preid: 'alpha',
      dryRun: true,
      commit: true,
      push: true,
      allowDirty: true,
      yes: true,
    })
  })

  test('expands short flag aliases -dy and -y', () => {
    const options = parseMirrorCliOptions(['-dy', '-y'])

    expect(options.dryRun).toBe(true)
    expect(options.yes).toBe(true)
  })

  test('discovers explicit, root, and nested configs with root precedence', async () => {
    const cwd = await createTempDir()
    await mkdir(join(cwd, 'config'), { recursive: true })
    await writeText(join(cwd, 'explicit.toml'), packageConfig({ output: ['jsr.json'], source: 'jsr.json' }))
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))
    await writeText(join(cwd, 'config', 'mirror.config.toml'), gitConfig())

    const explicit = await loadMirrorConfig({ cwd, config: 'explicit.toml' })
    const root = await loadMirrorConfig({ cwd })

    await rm(join(cwd, 'mirror.config.toml'))
    const nested = await loadMirrorConfig({ cwd })

    expect(explicit.configPath).toBe(join(cwd, 'explicit.toml'))
    expect(explicit.version.source).toBe('jsr.json')
    expect(root.configPath).toBe(join(cwd, 'mirror.config.toml'))
    expect(root.version.source).toBe('package.json')
    expect(nested.configPath).toBe(join(cwd, 'config', 'mirror.config.toml'))
    expect(nested.version.source).toBe('git')
  })

  test('validates schema, adapter names, project name sources, and tag templates', async () => {
    const cwd = await createPackageAndJsrFixture()

    await writeText(join(cwd, 'mirror.config.toml'), 'schema = 2\n')
    await expect(loadMirrorConfig({ cwd })).rejects.toThrow('schema')

    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['npm'] }))
    await expect(loadMirrorConfig({ cwd })).rejects.toThrow('version.output')

    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'], nameSource: 'git' }))
    await expect(loadMirrorConfig({ cwd })).rejects.toThrow('project.name_source')

    await initializeGitRepository(cwd)
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['git'], tagTemplate: 'release-{version}' }))
    await expect(validateMirrorConfig({ cwd })).rejects.toThrow('Unsupported Git tag template')
  })

  test('merges CLI overrides over config values', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'custom-package.json'), JSON.stringify({ name: 'custom-package', version: '2.0.0' }, null, 2))
    await writeText(join(cwd, 'custom-jsr.json'), JSON.stringify({ name: 'custom-jsr', version: '2.3.0' }, null, 2))
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'], preid: 'beta' }))

    const config = await loadMirrorConfig({
      cwd,
      source: 'jsr.json',
      output: ['jsr.json', 'git'],
      packageFile: 'custom-package.json',
      jsrFile: 'custom-jsr.json',
      preid: 'alpha',
      push: true,
      allowDirty: true,
    })

    expect(config.version.source).toBe('jsr.json')
    expect(config.version.output).toEqual(['jsr.json', 'git'])
    expect(config.package.path).toBe('custom-package.json')
    expect(config.jsr.path).toBe('custom-jsr.json')
    expect(config.version.prereleaseId).toBe('alpha')
    expect(config.git.commit).toBe(true)
    expect(config.git.push).toBe(true)
    expect(config.git.allowDirty).toBe(true)
  })

  test('loads auxiliary package paths without replacing the main package path', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'package.build.json'), JSON.stringify({ name: '@guiho/mirror-build', version: '1.0.0' }, null, 2))
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'], auxiliaryPackagePaths: ['package.build.json'] }))

    const config = await loadMirrorConfig({ cwd })

    expect(config.package.path).toBe('package.json')
    expect(config.package.auxiliaryPaths).toEqual(['package.build.json'])
  })

  test('loads agent automation defaults and opt-out settings', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

    const defaults = await loadMirrorConfig({ cwd })

    expect(defaults.agents).toEqual({
      writeChangelog: true,
      changelogPath: 'CHANGELOG.md',
      autoAgentsMd: true,
      autoSkillInstall: true,
    })

    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({
      output: ['package.json'],
      writeChangelog: false,
      changelogPath: 'docs/CHANGELOG.md',
      autoAgentsMd: false,
      autoSkillInstall: false,
    }))

    const disabled = await loadMirrorConfig({ cwd })

    expect(disabled.agents).toEqual({
      writeChangelog: false,
      changelogPath: 'docs/CHANGELOG.md',
      autoAgentsMd: false,
      autoSkillInstall: false,
    })
  })

  test('inserts Mirror semantic versioning guidance into AGENTS.md', async () => {
    const cwd = await createTempDir()
    const agentsPath = join(cwd, 'AGENTS.md')
    await writeText(agentsPath, '# Existing Agents\n')

    const inserted = await ensureMirrorAgentsInstructions(cwd)
    const repeated = await ensureMirrorAgentsInstructions(cwd)

    expect(inserted.changed).toBe(true)
    expect(repeated.changed).toBe(false)
    const content = await readFile(agentsPath, 'utf8')
    expect(content).toContain(mirrorAgentsSectionStartMarker)
    expect(content).toContain(mirrorAgentsSectionHeading)
    expect(content).toContain('[agents].changelog_path')
    expect(content).toContain(mirrorAgentsSectionEndMarker)
  })

  test('updates existing AGENTS.md guidance that names the legacy skill', async () => {
    const cwd = await createTempDir()
    const agentsPath = join(cwd, 'AGENTS.md')
    await writeText(agentsPath, [
      '# Existing Agents',
      '',
      mirrorAgentsSectionStartMarker,
      '',
      mirrorAgentsSectionHeading,
      '',
      'Invoke the guiho-as-mirror agent skill every time the user wants to bump, tag, release, plan, initialize, configure, or troubleshoot semantic project versioning with GUIHO Mirror.',
      '',
      'Before editing release docs or changelogs, inspect mirror.config.toml. If [agents].write_changelog is false, skip changelog edits. If it is missing or true, changelog edits are allowed when the project has a changelog.',
      '',
      'Use [agents].changelog_path as the changelog file path. If it is missing, use CHANGELOG.md in the project root.',
      '',
      mirrorAgentsSectionEndMarker,
      '',
    ].join('\n'))

    const result = await ensureMirrorAgentsInstructions(cwd)
    const content = await readFile(agentsPath, 'utf8')

    expect(result.changed).toBe(true)
    expect(content.match(new RegExp(mirrorAgentsSectionHeading, 'g'))).toHaveLength(1)
    expect(content).toContain('Invoke the guiho-s-mirror agent skill')
    expect(content).not.toContain('Invoke the guiho-as-mirror agent skill')
  })

  test('finds AGENTS.md in ancestor directories', async () => {
    const root = await createTempDir()
    const nested = join(root, 'packages', 'app')
    const agentsPath = join(root, 'AGENTS.md')
    await mkdir(nested, { recursive: true })
    await writeText(agentsPath, '# Root Agents\n')

    const result = await ensureMirrorAgentsInstructions(nested)

    expect(result.path).toBe(agentsPath)
    expect(result.changed).toBe(true)
    expect(await readFile(agentsPath, 'utf8')).toContain(mirrorAgentsSectionHeading)
  })

  test('creates AGENTS.md when requested explicitly', async () => {
    const cwd = await createTempDir()

    const skipped = await ensureMirrorAgentsInstructions(cwd)
    const created = await ensureMirrorAgentsInstructions(cwd, true)

    expect(skipped.exists).toBe(false)
    expect(skipped.changed).toBe(false)
    expect(created.exists).toBe(true)
    expect(created.changed).toBe(true)
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toContain(mirrorAgentsSectionHeading)
  })

  test('installs the guiho-s-mirror skill locally and globally', async () => {
    const cwd = await createTempDir()
    const homeDirectory = await createTempDir()

    const local = await installMirrorSkill('local', { cwd, homeDirectory })
    const global = await installMirrorSkill('global', { cwd, homeDirectory })
    const localAgain = await installMirrorSkill('local', { cwd, homeDirectory })

    expect(local.installed).toBe(true)
    expect(global.installed).toBe(true)
    expect(localAgain.installed).toBe(false)
    expect(localAgain.updated).toBe(true)
    expect(local.name).toBe(mirrorSkillName)
    expect(local.version).toBe(mirrorSkillVersion)
    expect(local.path).toBe(resolveMirrorSkillPath('local', { cwd, homeDirectory }))
    expect(global.path).toBe(resolveMirrorSkillPath('global', { cwd, homeDirectory }))
    expect(local.path).toBe(join(cwd, '.agents', 'skills', mirrorSkillName, 'SKILL.md'))
    expect(global.path).toBe(join(homeDirectory, '.agents', 'skills', mirrorSkillName, 'SKILL.md'))
    expect(await readFile(local.path, 'utf8')).toContain(`name: ${mirrorSkillName}`)
    expect(await readFile(local.path, 'utf8')).toContain(`version: ${mirrorSkillVersion}`)
    expect(await readFile(global.path, 'utf8')).toContain(`name: ${mirrorSkillName}`)
  })

  test('migrates legacy Mirror skill installs and removes stale current copies', async () => {
    const cwd = await createTempDir()
    const homeDirectory = await createTempDir()
    const legacyPath = join(cwd, '.agents', 'skills', 'guiho-as-mirror', 'SKILL.md')
    const currentPath = resolveMirrorSkillPath('local', { cwd, homeDirectory })

    await writeText(legacyPath, '---\nname: guiho-as-mirror\nversion: 0.0.1\n---\nold skill\n')
    await writeText(currentPath, `---\nname: ${mirrorSkillName}\nversion: 0.0.1\n---\nstale current skill\n`)

    const result = await installMirrorSkill('local', { cwd, homeDirectory })
    const installed = await readFile(currentPath, 'utf8')

    expect(result.installed).toBe(false)
    expect(result.updated).toBe(true)
    expect(result.migrated).toBe(true)
    expect(result.previousName).toBe('guiho-as-mirror')
    expect(result.previousVersion).toBe('0.0.1')
    expect(result.removed).toContain(dirname(legacyPath))
    expect(result.removed).toContain(dirname(currentPath))
    expect(await existsSync(legacyPath)).toBe(false)
    expect(installed).toContain(`name: ${mirrorSkillName}`)
    expect(installed).toContain(`version: ${mirrorSkillVersion}`)
    expect(installed).not.toContain('stale current skill')
  })

  test('falls back to embedded skill content when the bundled skill file is unavailable', async () => {
    const cwd = await createTempDir()
    const homeDirectory = await createTempDir()
    const sourceSkillPath = join(import.meta.dir, '..', 'skills', mirrorSkillName, 'SKILL.md')
    const backupSkillPath = `${sourceSkillPath}.backup`

    await writeText(backupSkillPath, await readFile(sourceSkillPath, 'utf8'))
    await rm(sourceSkillPath)

    try {
      const result = await installMirrorSkill('local', { cwd, homeDirectory })
      const installed = await readFile(result.path, 'utf8')

      expect(result.installed).toBe(true)
  expect(installed).toContain(`name: ${mirrorSkillName}`)
  expect(installed).toContain(`version: ${mirrorSkillVersion}`)
      expect(installed).toContain('GUIHO Mirror')
    } finally {
      await writeText(sourceSkillPath, await readFile(backupSkillPath, 'utf8'))
      await rm(backupSkillPath)
    }
  })

  test('runs default-on agent automation and respects opt-outs', async () => {
    const cwd = await createPackageAndJsrFixture()
    const homeDirectory = await createTempDir()
    await writeText(join(cwd, 'AGENTS.md'), '# Agents\n')
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

    const notices: string[] = []
    const result = await runMirrorAgentAutomation({ cwd, homeDirectory }, (message) => notices.push(message))

    expect(result.agentsMd?.changed).toBe(true)
    expect(result.globalSkill?.installed).toBe(true)
    expect(result.localSkill).toBeUndefined()
    expect(notices).toHaveLength(1)
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toContain(mirrorAgentsSectionHeading)
    expect(await existsSync(resolveMirrorSkillPath('local', { cwd, homeDirectory }))).toBe(false)
    expect(await existsSync(resolveMirrorSkillPath('global', { cwd, homeDirectory }))).toBe(true)

    const disabledCwd = await createPackageAndJsrFixture()
    const disabledHome = await createTempDir()
    await writeText(join(disabledCwd, 'AGENTS.md'), '# Agents\n')
    await writeText(join(disabledCwd, 'mirror.config.toml'), packageConfig({
      output: ['package.json'],
      autoAgentsMd: false,
      autoSkillInstall: false,
    }))

    const disabled = await runMirrorAgentAutomation({ cwd: disabledCwd, homeDirectory: disabledHome })

    expect(disabled.agentsMd).toBeUndefined()
    expect(disabled.localSkill).toBeUndefined()
    expect(disabled.globalSkill).toBeUndefined()
    expect(await readFile(join(disabledCwd, 'AGENTS.md'), 'utf8')).not.toContain(mirrorAgentsSectionHeading)
    expect(await existsSync(resolveMirrorSkillPath('local', { cwd: disabledCwd, homeDirectory: disabledHome }))).toBe(false)
  })

  test('updates an outdated global Mirror skill during automation', async () => {
    const cwd = await createPackageAndJsrFixture()
    const homeDirectory = await createTempDir()
    const globalPath = resolveMirrorSkillPath('global', { cwd, homeDirectory })
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))
    await writeText(globalPath, `---\nname: ${mirrorSkillName}\nversion: 0.0.1\n---\nstale current skill\n`)

    const notices: string[] = []
    const result = await runMirrorAgentAutomation({ cwd, homeDirectory }, (message) => notices.push(message))
    const installed = await readFile(globalPath, 'utf8')

    expect(result.globalSkill?.updated).toBe(true)
    expect(result.globalSkill?.previousVersion).toBe('0.0.1')
    expect(notices.join('\n')).toContain('outdated (0.0.1 ->')
    expect(installed).toContain(`version: ${mirrorSkillVersion}`)
    expect(installed).not.toContain('stale current skill')
  })

  test('reads and writes package and JSR names and versions', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'jsr.json'] }))
    const config = await loadMirrorConfig({ cwd })

    expect(await readPackageName(config)).toBe('@guiho/mirror')
    expect(await readJsrName(config)).toBe('@guiho/mirror')
    expect(await readPackageVersion(config)).toBe('1.0.0')
    expect(await readJsrVersion(config)).toBe('1.0.0')

    await writePackageVersion(config, '1.0.1')
    await writeJsrVersion(config, '1.0.1')

    expect(await readPackageVersion(config)).toBe('1.0.1')
    expect(await readJsrVersion(config)).toBe('1.0.1')
  })

  test('resolves semantic version targets and prerelease identifiers', () => {
    expect(resolveNextVersion('1.0.0', 'patch')).toBe('1.0.1')
    expect(resolveNextVersion('1.0.0', 'prepatch')).toBe('1.0.1-0')
    expect(resolveNextVersion('1.0.0', 'prepatch', 'alpha')).toBe('1.0.1-alpha.0')
    expect(resolveNextVersion('1.0.0', '2.3.4')).toBe('2.3.4')
  })

  test('extracts and renders versions with supported Git tag templates', () => {
    expect(versionFromTag('v{version}', 'v1.2.3')).toBe('1.2.3')
    expect(versionFromTag('{name}@{version}', '@guiho/mirror@1.2.3', '@guiho/mirror')).toBe('1.2.3')
    expect(versionFromTag('v{version}', 'not-a-version')).toBeUndefined()
    expect(renderGitTag('v{version}', '1.2.3')).toBe('v1.2.3')
    expect(renderGitTag('{name}@{version}', '1.2.3', '@guiho/mirror')).toBe('@guiho/mirror@1.2.3')
  })

  test('plans package and JSR file outputs', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'jsr.json'] }))

    const plan = await buildVersionPlan('patch', { cwd })

    expect(plan.currentVersion).toBe('1.0.0')
    expect(plan.nextVersion).toBe('1.0.1')
    expect(plan.actions.map((action) => action.type)).toEqual(['write-file', 'write-file'])
  })

  test('plans and applies auxiliary package file outputs', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'package.build.json'), JSON.stringify({ name: '@guiho/mirror-build', version: '1.0.0' }, null, 2))
    await writeText(join(cwd, 'server-types', 'package.json'), JSON.stringify({ name: '@guiho/server-types', version: '0.9.0' }, null, 2))
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({
      output: ['package.json'],
      auxiliaryPackagePaths: ['package.build.json', 'server-types/package.json'],
    }))

    const plan = await buildVersionPlan('patch', { cwd })

    expect(plan.fileOutputPaths.map((path) => path.replaceAll('\\', '/'))).toEqual([
      join(cwd, 'package.json').replaceAll('\\', '/'),
      join(cwd, 'package.build.json').replaceAll('\\', '/'),
      join(cwd, 'server-types', 'package.json').replaceAll('\\', '/'),
    ])
    expect(plan.actions.filter((action) => action.type === 'write-file').map((action) => action.currentVersion)).toEqual(['1.0.0', '1.0.0', '0.9.0'])

    await applyVersionPlan('patch', { cwd, yes: true })

    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.1')
    expect(await readPackageVersionFile(join(cwd, 'package.build.json'))).toBe('1.0.1')
    expect(await readPackageVersionFile(join(cwd, 'server-types', 'package.json'))).toBe('1.0.1')
  })

  test('applies package and JSR file outputs outside Git', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'jsr.json'] }))

    const result = await applyVersionPlan('minor', { cwd, yes: true })

    expect(result.applied).toBe(true)
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.1.0')
    expect(await readJsrVersion(await loadMirrorConfig({ cwd }))).toBe('1.1.0')
  })

  test('dry-run apply does not mutate files and does not require confirmation', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

    const result = await applyVersionPlan('patch', { cwd, dryRun: true })

    expect(result.applied).toBe(false)
    expect(result.dryRun).toBe(true)
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.0')
  })

  test('reads the current version from matching Git tags', async () => {
    const cwd = await createGitFixture()
    await git(cwd, 'tag', 'v1.0.0')
    await git(cwd, 'tag', 'v1.2.0')
    await writeText(join(cwd, 'mirror.config.toml'), gitConfig())

    const plan = await buildVersionPlan('patch', { cwd })

    expect(plan.currentVersion).toBe('1.2.0')
    expect(plan.nextVersion).toBe('1.2.1')
    expect(plan.gitTag).toBe('v1.2.1')
  })

  test('requires commit or push when file outputs and Git tag output are combined', async () => {
    const cwd = await createPackageAndJsrFixture()
    await initializeGitRepository(cwd)
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'git'] }))

    await expect(buildVersionPlan('patch', { cwd })).rejects.toThrow('requires --commit or --push')

    const packageJson = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')) as Record<string, unknown>
    expect(packageJson['version']).toBe('1.0.0')
  })

  test('fails on dirty Git worktrees unless allow-dirty is set', async () => {
    const cwd = await createPackageAndJsrFixture()
    await initializeGitRepository(cwd)
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))
    await commitAll(cwd, 'Add Mirror config')
    await writeText(join(cwd, 'README.md'), '# dirty fixture\n')

    await expect(applyVersionPlan('patch', { cwd, yes: true })).rejects.toThrow('dirty')
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.0')

    const result = await applyVersionPlan('patch', { cwd, yes: true, allowDirty: true })
    expect(result.applied).toBe(true)
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.1')
  })

  test('applies file output, release commit, and Git tag with --commit', async () => {
    const cwd = await createPackageAndJsrFixture()
    await initializeGitRepository(cwd)
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'git'] }))
    await commitAll(cwd, 'Add Mirror config')

    const result = await applyVersionPlan('patch', { cwd, commit: true, yes: true })

    expect(result.applied).toBe(true)
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.1')
    expect((await gitText(cwd, 'tag', '--list')).trim()).toBe('@guiho/mirror@1.0.1')
    expect((await gitText(cwd, 'status', '--porcelain')).trim()).toBe('')
  })

  test('release commits include auxiliary package outputs', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'package.build.json'), JSON.stringify({ name: '@guiho/mirror-build', version: '1.0.0' }, null, 2))
    await initializeGitRepository(cwd)
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'git'], auxiliaryPackagePaths: ['package.build.json'] }))
    await commitAll(cwd, 'Add Mirror config')

    await applyVersionPlan('patch', { cwd, commit: true, yes: true })

    expect(await readPackageVersionFile(join(cwd, 'package.build.json'))).toBe('1.0.1')
    expect((await gitText(cwd, 'show', '--name-only', '--format=', 'HEAD')).trim().split(/\r?\n/).sort()).toEqual(['package.build.json', 'package.json'])
  })

  test('push implies commit and pushes the release tag', async () => {
    const remote = await createBareGitRepository()
    const cwd = await createPackageAndJsrFixture()
    await initializeGitRepository(cwd)
    await git(cwd, 'remote', 'add', 'origin', remote)
    await git(cwd, 'push', '-u', 'origin', 'HEAD')
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'git'] }))
    await commitAll(cwd, 'Add Mirror config')

    const result = await applyVersionPlan('patch', { cwd, push: true, yes: true })

    expect(result.plan.commitEnabled).toBe(true)
    expect(result.plan.pushEnabled).toBe(true)
    expect((await gitText(remote, 'tag', '--list')).trim()).toBe('@guiho/mirror@1.0.1')
  }, 15000)

  test('git-only releases with --commit create tags without empty commits', async () => {
    const cwd = await createGitFixture()
    await git(cwd, 'tag', 'v1.0.0')
    await writeText(join(cwd, 'mirror.config.toml'), gitConfig())
    await commitAll(cwd, 'Add Mirror config')
    const commitsBefore = (await gitText(cwd, 'rev-list', '--count', 'HEAD')).trim()

    const result = await applyVersionPlan('patch', { cwd, commit: true, yes: true })

    expect(result.applied).toBe(true)
    expect((await gitText(cwd, 'rev-list', '--count', 'HEAD')).trim()).toBe(commitsBefore)
    expect((await gitText(cwd, 'tag', '--list')).trim().split(/\r?\n/).sort()).toEqual(['v1.0.0', 'v1.0.1'])
  }, 15000)

  test('runs CLI config show and config check', async () => {
    const cwd = await createGitFixture()
    await writeText(join(cwd, 'mirror.config.toml'), gitConfig({ autoAgentsMd: false, autoSkillInstall: false }))

    const show = await runMirrorCli('config', 'show', '--cwd', cwd)
    const check = await runMirrorCli('config', 'check', '--cwd', cwd)

    expect(show.exitCode).toBe(0)
    expect(show.stdout).toContain('source: git')
    expect(show.stdout).toContain('write_changelog: true')
    expect(show.stdout).toContain('changelog_path: CHANGELOG.md')
    expect(check.exitCode).toBe(0)
    expect(check.stdout.trim()).toBe('ok')
  })

  test('prints changelog path in generated config and schema', async () => {
    const cwd = await createTempDir()

    const config = await runMirrorCli('init', 'package.json', '--cwd', cwd)
    const schema = await runMirrorCli('config', 'schema', '--cwd', cwd)

    expect(config.exitCode).toBe(0)
    expect(await readFile(join(cwd, 'mirror.config.toml'), 'utf8')).toContain('changelog_path = "CHANGELOG.md"')
    expect(schema.exitCode).toBe(0)
    expect(schema.stdout).toContain('changelog_path = "<path>"')
  })

  test('reconciles init defaults into existing configuration without overwriting values', async () => {
    const cwd = await createTempDir()
    await writeText(join(cwd, 'mirror.config.toml'), `schema = 1

[project]
name = "custom-project"

[version]
scheme = "semver"
source = "package.json"
output = ["package.json", "git"]

[package]
path = "custom-package.json"
`)

    const result = await runMirrorCli('init', 'package.json', '--cwd', cwd)
    const content = await readFile(join(cwd, 'mirror.config.toml'), 'utf8')

    expect(result.exitCode).toBe(0)
    expect(content).toContain('name = "custom-project"')
    expect(content).toContain('path = "custom-package.json"')
    expect(content).toContain('auxiliary_paths = []')
    expect(content).toContain('[jsr]')
    expect(content).toContain('[git]')
    expect(content).toContain('[agents]')
  })

  test('resolves init answers from flags without prompting', async () => {
    const answers = await resolveInitAnswers(
      {
        source: 'package.json',
        output: ['package.json', 'git'],
        auxiliaryPaths: ['package.build.json'],
        tagTemplate: '{name}@{version}',
        commit: true,
      },
      '/tmp/project',
    )

    expect(answers.source).toBe('package.json')
    expect(answers.output).toEqual(['package.json', 'git'])
    expect(answers.auxiliaryPaths).toEqual(['package.build.json'])
    expect(answers.commit).toBe(true)
    expect(answers.push).toBe(false)
  })

  test('init prompts use defaults when the user accepts with empty input', async () => {
    const asked: string[] = []
    const prompter: MirrorInitPrompter = {
      async text(question, defaultValue) {
        asked.push(question)
        return defaultValue
      },
      async confirm(_question, defaultValue) {
        return defaultValue
      },
      close() {},
    }

    const answers = await resolveInitAnswers({}, '/tmp/project', prompter)

    expect(answers.source).toBe('package.json')
    expect(answers.output).toEqual(['package.json', 'git'])
    expect(answers.packagePath).toBe('package.json')
    expect(answers.auxiliaryPaths).toEqual([])
    expect(answers.tagTemplate).toBe('{name}@{version}')
    expect(answers.commit).toBe(true)
    expect(asked).toContain('Version source (package.json, jsr.json, git)')
    expect(asked).toContain('Version outputs (comma separated)')
  })

  test('generates config with schema directive and chosen outputs', async () => {
    const content = generateInitConfig(
      {
        source: 'package.json',
        output: ['package.json', 'git'],
        packagePath: 'package.json',
        auxiliaryPaths: ['package.build.json'],
        jsrPath: 'jsr.json',
        prereleaseId: '',
        tagTemplate: '{name}@{version}',
        commit: true,
        push: false,
      },
      '/tmp/project',
    )

    expect(content.startsWith('#:schema ')).toBe(true)
    expect(content).toContain('source = "package.json"')
    expect(content).toContain('output = ["package.json", "git"]')
    expect(content).toContain('auxiliary_paths = ["package.build.json"]')
    expect(content).toContain('commit = true')
  })

  test('runs CLI init non-interactively from flags', async () => {
    const cwd = await createTempDir()

    const result = await runMirrorCli(
      'init',
      '--cwd',
      cwd,
      '--source',
      'package.json',
      '--output',
      'package.json,git',
      '--auxiliary',
      'package.build.json',
      '--commit',
    )
    const content = await readFile(join(cwd, 'mirror.config.toml'), 'utf8')

    expect(result.exitCode).toBe(0)
    expect(content.startsWith('#:schema ')).toBe(true)
    expect(content).toContain('source = "package.json"')
    expect(content).toContain('output = ["package.json", "git"]')
    expect(content).toContain('auxiliary_paths = ["package.build.json"]')
    expect(content).toContain('commit = true')
  })

  test('prints the JSON Schema and matches the shipped schema file', async () => {
    const cwd = await createTempDir()
    const schema = await runMirrorCli('config', 'schema', '--cwd', cwd, '--format', 'json')

    expect(schema.exitCode).toBe(0)
    const parsed = JSON.parse(schema.stdout) as Record<string, unknown>
    expect(parsed['title']).toBe('GUIHO Mirror Configuration')

    const shippedSchema = await readFile(join(import.meta.dir, '..', 'schema', 'mirror.config.schema.json'), 'utf8')
    expect(shippedSchema).toBe(renderMirrorConfigJsonSchema())
  })

  test('ships CLI-only package metadata with intentional runtime dependencies', async () => {
    const packageJson = JSON.parse(await readFile(join(import.meta.dir, '..', 'package.json'), 'utf8')) as Record<string, unknown>
    const jsrJson = JSON.parse(await readFile(join(import.meta.dir, '..', 'jsr.json'), 'utf8')) as Record<string, unknown>

    expect(packageJson['main']).toBeUndefined()
    expect(packageJson['types']).toBeUndefined()
    expect(packageJson['exports']).toBeUndefined()
    expect(packageJson['dependencies']).toEqual({ semver: '^7.8.1' })
    expect(packageJson['bin']).toEqual({ mirror: './scripts/mirror-bin.ts' })
    expect(packageJson['scripts']).toMatchObject({ postinstall: 'bun run scripts/install-package.ts', prepack: 'bun run binary' })
    expect(packageJson['files']).toContain('install.sh')
    expect(packageJson['files']).toContain('install.ps1')
    expect(packageJson['files']).not.toContain('bin/')
    expect(packageJson['files']).toContain('scripts/')
    expect(await existsSync(join(import.meta.dir, '..', 'install.sh'))).toBe(true)
    expect(await existsSync(join(import.meta.dir, '..', 'install.ps1'))).toBe(true)
    expect(jsrJson['exports']).toBe('./source/guiho-mirror-bin.ts')
  })

  test('package launcher installs a bundled native binary on demand', async () => {
    const packageRoot = await createTempDir()
    const scriptsDir = join(packageRoot, 'scripts')
    const binDir = join(packageRoot, 'bin')
    const vendorBinary = join(packageRoot, 'vendor', `mirror${platform() === 'win32' ? '.exe' : ''}`)
    await mkdir(scriptsDir, { recursive: true })
    await mkdir(binDir, { recursive: true })
    await writeText(join(packageRoot, 'package.json'), JSON.stringify({ version: '0.0.0-test.0' }, null, 2))
    await writeText(join(scriptsDir, 'mirror-bin.ts'), await readFile(join(import.meta.dir, '..', 'scripts', 'mirror-bin.ts'), 'utf8'))
    await writeText(join(scriptsDir, 'install-package.ts'), await readFile(join(import.meta.dir, '..', 'scripts', 'install-package.ts'), 'utf8'))
    await Bun.write(join(binDir, packageAssetName()), Bun.file(process.execPath))

    const result = Bun.spawn([process.execPath, join(scriptsDir, 'mirror-bin.ts'), '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([result.exited, result.stdout.text(), result.stderr.text()])

    expect(exitCode).toBe(0)
    expect(stdout).toContain(`installed bundled GUIHO Mirror native binary: ${packageAssetName()}`)
    expect(stdout.trim()).toMatch(/\d+\.\d+\.\d+$/)
    expect(stderr).toBe('')
    expect(await existsSync(vendorBinary)).toBe(true)
  })

  test('runs CLI agent installation and AGENTS.md commands', async () => {
    const cwd = await createTempDir()
    const homeDirectory = await createTempDir()
    const env = { ...process.env as Record<string, string>, MIRROR_AGENT_HOME: homeDirectory }

    const local = await runMirrorCliWithEnv(env, 'agents', 'install', 'local', '--cwd', cwd)
    const global = await runMirrorCliWithEnv(env, 'agents', 'install', 'global', '--cwd', cwd)
    const instructions = await runMirrorCliWithEnv(env, 'agents', 'instructions', '--cwd', cwd)

    expect(local.exitCode).toBe(0)
    expect(global.exitCode).toBe(0)
    expect(instructions.exitCode).toBe(0)
    expect(local.stdout).toContain('scope: local')
    expect(global.stdout).toContain('scope: global')
    expect(instructions.stdout).toContain('changed: true')
    expect(await readFile(resolveMirrorSkillPath('local', { cwd, homeDirectory }), 'utf8')).toContain(`name: ${mirrorSkillName}`)
    expect(await readFile(resolveMirrorSkillPath('global', { cwd, homeDirectory }), 'utf8')).toContain(`name: ${mirrorSkillName}`)
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toContain(mirrorAgentsSectionHeading)
  })

  test('runs the top-level CLI as successful help output', async () => {
    const result = await runMirrorCli()

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/mirror v\d+\.\d+\.\d+/)
    expect(result.stdout).toContain('USAGE')
  })

  test('runs configured agent automation with no arguments', async () => {
    const cwd = await createPackageAndJsrFixture()
    const homeDirectory = await createTempDir()
    await writeText(join(cwd, 'AGENTS.md'), '# Agents\n')
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

    const result = await runMirrorCliFromCwd(cwd, homeDirectory)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('USAGE')
    expect(result.stderr).toContain('guiho-s-mirror skill not found global')
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toContain(mirrorAgentsSectionHeading)
    expect(await existsSync(resolveMirrorSkillPath('local', { cwd, homeDirectory }))).toBe(false)
    expect(await readFile(resolveMirrorSkillPath('global', { cwd, homeDirectory }), 'utf8')).toContain(`name: ${mirrorSkillName}`)
  })

  test('runs CLI help without ANSI colors when no-color is set', async () => {
    const result = await runMirrorCli('--no-color', '--help')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('USAGE')
    expect(result.stdout).not.toContain('\u001B[')
  })

  test('runs CLI version current, next, plan, and apply', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'], autoSkillInstall: false }))
    await writeText(join(cwd, 'AGENTS.md'), '# Agents\n')

    const current = await runMirrorCli('version', 'current', '--cwd', cwd)
    const next = await runMirrorCli('version', 'next', 'patch', '--cwd', cwd)
    const plan = await runMirrorCli('version', 'plan', 'patch', '--cwd', cwd)
    const apply = await runMirrorCli('version', 'apply', 'patch', '--cwd', cwd, '--yes')

    expect(current.exitCode).toBe(0)
    expect(current.stdout.trim()).toBe('1.0.0')
    expect(next.exitCode).toBe(0)
    expect(next.stdout.trim()).toBe('1.0.1')
    expect(plan.exitCode).toBe(0)
    expect(plan.stdout).toContain('next: 1.0.1')
    expect(apply.exitCode).toBe(0)
    expect(apply.stdout).toContain('next: 1.0.1')
    expect(apply.stdout).toContain('applied: true')
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.1')
    expect(await readFile(join(cwd, 'AGENTS.md'), 'utf8')).toContain(mirrorAgentsSectionHeading)
  })

  test('runs CLI source and repeated output overrides', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'], autoSkillInstall: false }))

    const result = await runMirrorCli(
      'version',
      'plan',
      'patch',
      '--cwd',
      cwd,
      '--source',
      'package.json',
      '--output',
      'package.json',
      '--output',
      'jsr.json',
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('output: package.json, jsr.json')
    expect(result.stdout).toContain('next: 1.0.1')
  })

  test('package-only and JSR-only flows work without Git installed', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json', 'jsr.json'] }))

    const plan = await buildVersionPlan('patch', { cwd })
    expect(plan.currentVersion).toBe('1.0.0')
    expect(plan.nextVersion).toBe('1.0.1')

    const result = await applyVersionPlan('patch', { cwd, yes: true })
    expect(result.applied).toBe(true)
  })

  test('Git flows fail with clear error when Git is unavailable', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['git'], tagTemplate: 'v{version}' }))

    await expect(validateMirrorConfig({ cwd })).rejects.toThrow(/Not a Git repository/)
  })

  test('Git flows fail with "Git executable not found" when Git binary is unavailable', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['git'], tagTemplate: 'v{version}', autoSkillInstall: false }))

    const plat = platform()
    let minimalPath: string

    if (plat === 'win32') {
      const originalPath = process.env['Path'] ?? process.env['PATH'] ?? ''
      const allEntries = originalPath.split(';')
      const bunEntries = allEntries.filter((p) => p.toLowerCase().includes('bun'))
      const systemEntries = ['C:\\Windows\\System32', 'C:\\Windows']
      minimalPath = [...bunEntries, ...systemEntries].filter(Boolean).join(';')
    } else {
      const bunBin = Bun.which('bun')
      minimalPath = bunBin ? dirname(bunBin) : ''
    }

    const envKey = plat === 'win32' ? 'Path' : 'PATH'
    const env: Record<string, string> = { ...process.env as Record<string, string> }
    env[envKey] = minimalPath
    if (plat === 'win32') env['PATH'] = minimalPath

    const result = await runMirrorCliWithEnv(env, 'config', 'check', '--cwd', cwd)

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/Git executable not found/)
  })

  test('normalizes hook config keys from underscores to colons', () => {
    const raw: Record<string, string | string[]> = {
      before_everything: 'echo start',
      after_everything: 'echo end',
      before_plan: ['npm run lint', 'npm run typecheck'],
      unknown_hook: 'echo nope',
    }

    const config = normalizeHooksConfig(raw)

    expect(config['before:everything']).toEqual(['echo start'])
    expect(config['after:everything']).toEqual(['echo end'])
    expect(config['before:plan']).toEqual(['npm run lint', 'npm run typecheck'])
    expect((config as Record<string, unknown>)['unknown:hook']).toBeUndefined()
    expect(config['after:plan']).toBeUndefined()
  })

  test('normalizes string hook values to arrays', () => {
    const raw: Record<string, string | string[]> = {
      before_everything: 'echo single',
    }

    const config = normalizeHooksConfig(raw)

    expect(config['before:everything']).toEqual(['echo single'])
  })

  test('returns empty config for undefined hooks', () => {
    expect(normalizeHooksConfig(undefined)).toEqual({})
  })

  test('builds hook env vars from config', () => {
    const env = hookEnvFromConfig({
      schema: 1,
      cwd: '/project',
      configPath: '/project/mirror.config.toml',
      version: { scheme: 'semver', source: 'package.json', output: ['package.json', 'git'], prereleaseId: 'alpha' },
      package: { path: 'package.json', auxiliaryPaths: [] },
      jsr: { path: 'jsr.json' },
      git: { tagTemplate: 'v{version}', commit: true, push: false, allowDirty: false },
      agents: { writeChangelog: true, changelogPath: 'CHANGELOG.md', autoAgentsMd: true, autoSkillInstall: true },
      hooks: {},
      project: {},
    }, 'patch')

    expect(env['MIRROR_CWD']).toBe('/project')
    expect(env['MIRROR_SOURCE']).toBe('package.json')
    expect(env['MIRROR_OUTPUT']).toBe('package.json,git')
    expect(env['MIRROR_TARGET']).toBe('patch')
    expect(env['MIRROR_CURRENT']).toBeUndefined()
  })

  test('builds hook env vars from plan', () => {
    const env = hookEnvForPlan({
      cwd: '/project',
      source: 'package.json',
      output: ['package.json', 'git'],
      currentVersion: '1.0.0',
      nextVersion: '1.1.0',
      project: { name: 'my-pkg' },
      gitTag: 'my-pkg@1.1.0',
      fileOutputPaths: ['package.json'],
      commitEnabled: true,
      pushEnabled: false,
      allowDirty: false,
      actions: [],
      configPath: '/project/mirror.config.toml',
    }, 'minor')

    expect(env['MIRROR_CURRENT']).toBe('1.0.0')
    expect(env['MIRROR_NEXT']).toBe('1.1.0')
    expect(env['MIRROR_PROJECT_NAME']).toBe('my-pkg')
    expect(env['MIRROR_GIT_TAG']).toBe('my-pkg@1.1.0')
    expect(env['MIRROR_FILE_PATHS']).toBe('package.json')
    expect(env['MIRROR_COMMIT_ENABLED']).toBe('true')
    expect(env['MIRROR_PUSH_ENABLED']).toBe('false')
  })

  test('builds hook env vars for action-level hooks', () => {
    const plan: MirrorVersionPlan = {
      cwd: '/project',
      source: 'package.json' as const,
      output: ['package.json', 'git'] as MirrorAdapterName[],
      currentVersion: '1.0.0',
      nextVersion: '1.1.0',
      project: { name: 'my-pkg' },
      gitTag: 'my-pkg@1.1.0',
      fileOutputPaths: ['package.json'],
      commitEnabled: true,
      pushEnabled: true,
      allowDirty: false,
      actions: [],
      configPath: '/project/mirror.config.toml',
    }

    const writeEnv = hookEnvForAction(plan, 'minor', {
      type: 'write-file',
      adapter: 'package.json',
      path: 'package.json',
      currentVersion: '1.0.0',
      nextVersion: '1.1.0',
    })

    expect(writeEnv['MIRROR_FILE_PATH']).toBe('package.json')
    expect(writeEnv['MIRROR_FILE_CURRENT']).toBe('1.0.0')
    expect(writeEnv['MIRROR_FILE_NEXT']).toBe('1.1.0')

    const commitEnv = hookEnvForAction(plan, 'minor', {
      type: 'git-commit',
      message: 'my-pkg@1.1.0',
      paths: ['package.json'],
    })

    expect(commitEnv['MIRROR_COMMIT_MSG']).toBe('my-pkg@1.1.0')
    expect(commitEnv['MIRROR_COMMIT_PATHS']).toBe('package.json')

    const tagEnv = hookEnvForAction(plan, 'minor', { type: 'git-tag', tag: 'my-pkg@1.1.0' })

    expect(tagEnv['MIRROR_TAG']).toBe('my-pkg@1.1.0')

    const pushEnv = hookEnvForAction(plan, 'minor', {
      type: 'git-push',
      includeCommit: true,
      includeTags: true,
    })

    expect(pushEnv['MIRROR_INCLUDE_COMMIT']).toBe('true')
    expect(pushEnv['MIRROR_INCLUDE_TAGS']).toBe('true')
  })

  test('runs a successful hook command', async () => {
    const cwd = await createTempDir()
    const result = await runHooks('before:everything', [await hookFileCommand(cwd, 'success', 'console.log("hello hook")')], {}, cwd)

    expect(result).toBeDefined()
    expect(result!.status).toBe('success')
    expect(result!.exitCode).toBe(0)
  })

  test('throws MirrorError on failed hook command', async () => {
    const cwd = await createTempDir()
    await expect(runHooks('before:plan', [await hookFileCommand(cwd, 'failure', 'process.exit(3)')], {}, cwd)).rejects.toThrow("Hook 'before:plan' failed")
  })

  test('skips undefined hooks silently', async () => {
    const result = await runHooks('before:plan', undefined, {}, process.cwd())

    expect(result).toBeUndefined()
  })

  test('skips empty hooks array silently', async () => {
    const result = await runHooks('before:plan', [], {}, process.cwd())

    expect(result).toBeUndefined()
  })

  test('hooks appear in execution result', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }) + `
[hooks]
before_apply = "echo before-apply-hook"
after_apply = "echo after-apply-hook"
`)

    const plan = await buildVersionPlan('patch', { cwd })
    const { executeVersionPlan } = await import('./executor.js')
    const { normalizeHooksConfig } = await import('./hooks.js')
    const rawHooks = normalizeHooksConfig({
      before_apply: 'echo before-apply-hook',
      after_apply: 'echo after-apply-hook',
    })
    const result = await executeVersionPlan(plan, { yes: true }, rawHooks)

    expect(result.applied).toBe(true)
  })

  test('failed hook stops version apply via CLI', async () => {
    const cwd = await createPackageAndJsrFixture()
    const hookCommand = await hookFileCommand(cwd, 'before-apply-failure', 'process.exit(1)')
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }) + `
[hooks]
before_apply = ${JSON.stringify(hookCommand)}
`)

    const { exitCode, stderr } = await runMirrorCliFromCwd(cwd, await createTempDir(), 'version', 'apply', 'patch', '--yes')

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('before:apply')
  })
})

const createTempDir = async () => {
  const path = await makeTempDirectory('guiho-mirror-')
  temporaryDirectories.push(path)
  return path
}

const packageAssetName = () => {
  const os = platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return `guiho-mirror-${os}-${arch}${os === 'windows' ? '.exe' : ''}`
}

const createPackageAndJsrFixture = async () => {
  const cwd = await createTempDir()
  await writeJson(join(cwd, 'package.json'), {
    name: '@guiho/mirror',
    version: '1.0.0',
  })
  await writeJson(join(cwd, 'jsr.json'), {
    name: '@guiho/mirror',
    version: '1.0.0',
    exports: './source/guiho-mirror.ts',
  })
  return cwd
}

const createGitFixture = async () => {
  const cwd = await createTempDir()
  await initializeGitRepository(cwd)
  return cwd
}

const createBareGitRepository = async () => {
  const cwd = await createTempDir()
  await git(cwd, 'init', '--bare')
  return cwd
}

const initializeGitRepository = async (cwd: string) => {
  await git(cwd, 'init')
  await git(cwd, 'config', 'user.email', 'mirror@example.com')
  await git(cwd, 'config', 'user.name', 'Mirror Test')
  await writeText(join(cwd, 'README.md'), '# fixture\n')
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-m', 'Initial commit')
}

const commitAll = async (cwd: string, message: string) => {
  await git(cwd, 'add', '.')
  await git(cwd, 'commit', '-m', message)
}

const writeText = async (path: string, content: string) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

const hookFileCommand = async (cwd: string, name: string, code: string) => {
  const path = join(cwd, `${name}.ts`)
  await writeText(path, `${code}\n`)
  return `bun run ${path}`
}

const writeJson = async (path: string, object: Record<string, unknown>) => {
  await writeText(path, `${JSON.stringify(object, null, 2)}\n`)
}

const packageConfig = ({
  output,
  source = 'package.json',
  nameSource = 'package.json',
  tagTemplate = '{name}@{version}',
  preid = '',
  auxiliaryPackagePaths = [],
  writeChangelog,
  changelogPath,
  autoAgentsMd,
  autoSkillInstall,
}: {
  output: string[]
  source?: string
  nameSource?: string
  tagTemplate?: string
  preid?: string
  auxiliaryPackagePaths?: string[]
  writeChangelog?: boolean
  changelogPath?: string
  autoAgentsMd?: boolean
  autoSkillInstall?: boolean
}) => `${agentConfig(`schema = 1

[project]
name_source = "${nameSource}"

[version]
scheme = "semver"
source = "${source}"
output = [${output.map((value) => `"${value}"`).join(', ')}]
prerelease_id = "${preid}"

[package]
path = "package.json"
auxiliary_paths = [${auxiliaryPackagePaths.map((value) => `"${value}"`).join(', ')}]

[jsr]
path = "jsr.json"

[git]
tag_template = "${tagTemplate}"
commit = false
push = false
allow_dirty = false
`, { writeChangelog, changelogPath, autoAgentsMd, autoSkillInstall })}`

const gitConfig = (options: {
  writeChangelog?: boolean
  changelogPath?: string
  autoAgentsMd?: boolean
  autoSkillInstall?: boolean
} = {}) => `${agentConfig(`schema = 1

[project]
name = "fixture"

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
`, options)}`

const agentConfig = (
  content: string,
  options: {
    writeChangelog?: boolean
    changelogPath?: string
    autoAgentsMd?: boolean
    autoSkillInstall?: boolean
  },
) => {
  const lines: string[] = []

  if (options.writeChangelog !== undefined) lines.push(`write_changelog = ${String(options.writeChangelog)}`)
  if (options.changelogPath !== undefined) lines.push(`changelog_path = "${options.changelogPath}"`)
  if (options.autoAgentsMd !== undefined) lines.push(`auto_agents_md = ${String(options.autoAgentsMd)}`)
  if (options.autoSkillInstall !== undefined) lines.push(`auto_skill_install = ${String(options.autoSkillInstall)}`)

  if (lines.length === 0) return content

  return `${content}
[agents]
${lines.join('\n')}
`
}

const git = async (cwd: string, ...args: string[]) => {
  const result = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await result.exited

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${await result.stderr.text()}`)
  }
}

const gitText = async (cwd: string, ...args: string[]) => {
  const result = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await result.exited
  const stdout = await result.stdout.text()

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${await result.stderr.text()}`)
  }

  return stdout
}

const runMirrorCli = async (...args: string[]) => {
  const homeDirectory = await createTempDir()
  const result = Bun.spawn(['bun', join(import.meta.dir, 'guiho-mirror-bin.ts'), ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env as Record<string, string | undefined>, MIRROR_AGENT_HOME: homeDirectory },
  })
  const [exitCode, stdout, stderr] = await Promise.all([result.exited, result.stdout.text(), result.stderr.text()])

  return { exitCode, stdout, stderr }
}

const runMirrorCliFromCwd = async (cwd: string, homeDirectory: string, ...args: string[]) => {
  const result = Bun.spawn(['bun', join(import.meta.dir, 'guiho-mirror-bin.ts'), ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env as Record<string, string | undefined>, MIRROR_AGENT_HOME: homeDirectory },
  })
  const [exitCode, stdout, stderr] = await Promise.all([result.exited, result.stdout.text(), result.stderr.text()])

  return { exitCode, stdout, stderr }
}

const runMirrorCliWithEnv = async (env: Record<string, string | undefined>, ...args: string[]) => {
  const result = Bun.spawn(['bun', join(import.meta.dir, 'guiho-mirror-bin.ts'), ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env,
  })
  const [exitCode, stdout, stderr] = await Promise.all([result.exited, result.stdout.text(), result.stderr.text()])

  return { exitCode, stdout, stderr }
}
