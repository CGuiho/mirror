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
  showMirrorCommandHelpDocs,
  showMirrorCommandHelpTree,
  showMirrorHelpDocs,
  showMirrorHelpTree,
  detectNativeArch,
  readUpdateCache,
  resolveCachePath,
  upgradeSelf,
  runHooks,
  runMirrorAgentAutomation,
  validateMirrorConfig,
  versionFromTag,
  writeJsrVersion,
  writePackageVersion,
} from './guiho-mirror.js'
import { ensureMirrorAgentInstructionFiles, installMirrorSkills } from './agents.js'
import type { MirrorAdapterName, MirrorInitPrompter, MirrorVersionPlan } from './guiho-mirror.js'
import { dirnamePath, joinPath } from './path.js'
import { ensureDirectory, readTextFile, removePath, writeTextFile } from './runtime.js'

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
  test('renders command tree and Markdown docs', () => {
    expect(showMirrorHelpTree()).toContain('mirror upgrade')
    expect(showMirrorCommandHelpTree(['upgrade'])).toContain('mirror upgrade check')
    expect(showMirrorHelpDocs()).toContain('# mirror CLI')
    expect(showMirrorCommandHelpDocs(['uninstall'])).toContain('mirror uninstall')
  })

  test('self-management helpers resolve cache and dry-run upgrade assets', async () => {
    const dir = await createTempDir()
    const executable = join(dir, platform() === 'win32' ? 'mirror.exe' : 'mirror')
    const previousSelfPath = process.env['MIRROR_SELF_PATH']
    try {
      await writeText(executable, platform() === 'win32' ? 'MZ' : '\x7fELF')
      process.env['MIRROR_SELF_PATH'] = executable

      expect(detectNativeArch('x64')).toBe('x64')
      expect(resolveCachePath({ cacheDir: dir })).toBe(join(dir, 'update.json'))
      expect(await readUpdateCache({ cacheDir: dir })).toBeNull()

      const packageMetadata = await Bun.file(join(import.meta.dir, '..', 'package.json')).json() as { version: string }
      const asset = platform() === 'win32' ? 'guiho-mirror-windows-x64-baseline.exe' : platform() === 'darwin' ? 'guiho-mirror-macos-x64-baseline' : 'guiho-mirror-linux-x64-baseline'
      const releaseServer = Bun.serve({
        port: 0,
        fetch: () => Response.json({
          tag_name: `@guiho/mirror@${packageMetadata.version}`,
          html_url: 'https://example.test/release',
          assets: [{ name: asset, browser_download_url: 'https://example.test/mirror' }],
        }),
      })
      const apiBaseUrl = releaseServer.url.toString().replace(/\/$/, '')
      const current = await upgradeSelf({ version: packageMetadata.version, arch: 'x64', cacheDir: dir, apiBaseUrl })
      expect(current.outcome).toBe('up-to-date')
      expect(current.plan?.asset).toBe(asset)
      expect(await readUpdateCache({ cacheDir: dir })).toBeNull()

      const cli = await runMirrorCliWithEnv({ ...process.env as Record<string, string | undefined>, MIRROR_SELF_PATH: executable, MIRROR_GITHUB_API_URL: apiBaseUrl }, 'upgrade', '--version', packageMetadata.version)
      expect(cli.exitCode).toBe(0)
      expect(cli.stdout).toContain('Already up to date:')
      expect(cli.stdout).not.toContain('Upgrade downloaded.')
      expect(cli.stdout).toContain(`install Mirror ${packageMetadata.version} directly`)

      const cliJson = await runMirrorCliWithEnv(
        { ...process.env as Record<string, string | undefined>, MIRROR_SELF_PATH: executable, MIRROR_GITHUB_API_URL: apiBaseUrl },
        'upgrade',
        '--version',
        packageMetadata.version,
        '--format',
        'json',
      )
      const envelope = JSON.parse(cliJson.stdout) as Record<string, unknown>
      expect(envelope).toMatchObject({
        schemaVersion: 1,
        command: 'mirror upgrade',
        outcome: 'up-to-date',
        error: null,
      })
      expect(envelope).toHaveProperty('result')
      expect(envelope).toHaveProperty('recovery.targetSource', 'resolved')
      expect(envelope).not.toHaveProperty('plan.temporaryPath')
      expect(envelope).not.toHaveProperty('plan.backupPath')
      expect(envelope).not.toHaveProperty('plan.failedArtifactPath')

      const failureServer = Bun.serve({ port: 0, fetch: () => new Response('offline', { status: 503, statusText: 'Service Unavailable' }) })
      const failureApiBaseUrl = failureServer.url.toString().replace(/\/$/, '')
      const fallbackText = await runMirrorCliWithEnv(
        { ...process.env as Record<string, string | undefined>, MIRROR_SELF_PATH: executable, MIRROR_GITHUB_API_URL: failureApiBaseUrl },
        'upgrade',
      )
      expect(fallbackText.exitCode).not.toBe(0)
      expect(fallbackText.stdout).toContain(`Repair reinstall for installed Mirror ${packageMetadata.version} (upgrade target was not resolved):`)
      const fallbackJson = await runMirrorCliWithEnv(
        { ...process.env as Record<string, string | undefined>, MIRROR_SELF_PATH: executable, MIRROR_GITHUB_API_URL: failureApiBaseUrl },
        'upgrade',
        '--format',
        'json',
      )
      expect(JSON.parse(fallbackJson.stdout)).toMatchObject({
        outcome: 'failed',
        plan: null,
        result: null,
        recovery: { targetSource: 'fallback-current' },
        error: {
          phase: 'plan',
          code: 'UPGRADE_RESOLUTION_FAILED',
          rollbackAttempted: false,
          rollbackSucceeded: false,
          preservedPaths: [],
        },
      })
      failureServer.stop(true)

      const dryRunServer = Bun.serve({
        port: 0,
        fetch: () => Response.json({
          tag_name: '@guiho/mirror@3.4.0',
          html_url: 'https://example.test/release/3.4.0',
          assets: [{ name: asset, browser_download_url: 'https://example.test/mirror-3.4.0' }],
        }),
      })
      const result = await upgradeSelf({ version: '3.4.0', arch: 'x64', dryRun: true, apiBaseUrl: dryRunServer.url.toString().replace(/\/$/, '') })
      expect(result.outcome).toBe('dry-run')
      expect(result.plan?.asset).toBe(asset)
      expect(result.plan?.downloadUrl).toBe('https://example.test/mirror-3.4.0')
      dryRunServer.stop(true)
      releaseServer.stop(true)
    } finally {
      if (previousSelfPath === undefined) delete process.env['MIRROR_SELF_PATH']
      else process.env['MIRROR_SELF_PATH'] = previousSelfPath
    }
  })

  test('routes global version and the hidden update worker without project configuration', async () => {
    const packageMetadata = await Bun.file(join(import.meta.dir, '..', 'package.json')).json() as { version: string }
    const env = { ...process.env as Record<string, string | undefined>, MIRROR_DISABLE_UPDATE_CHECK: '1' }

    const version = await runMirrorCliWithEnv(env, '-v')
    const worker = await runMirrorCliWithEnv(env, '--mirror-update-check-worker')

    expect(version.exitCode).toBe(0)
    expect(version.stdout.trim()).toBe(packageMetadata.version)
    expect(version.stderr).toBe('')
    expect(worker.exitCode).toBe(0)
    expect(worker.stdout).toBe('')
    expect(worker.stderr).toBe('')
  })

  test('runs Citty uninstall dry-run without deleting the executable', async () => {
    const cwd = await createTempDir()
    const executable = join(cwd, platform() === 'win32' ? 'mirror.exe' : 'mirror')
    await writeText(executable, platform() === 'win32' ? 'MZ' : '\x7fELF')

    const result = await runMirrorCliWithEnv(
      { ...process.env as Record<string, string | undefined>, MIRROR_SELF_PATH: executable },
      'uninstall',
      '-dy',
      '--format',
      'json',
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ executablePath: executable, dryRun: true, scheduled: false })
    expect(await existsSync(executable)).toBe(true)
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
    const override = await loadMirrorConfig({ cwd, tool: 'all' })

    expect(defaults.agents).toEqual({
      writeChangelog: true,
      changelogPath: 'CHANGELOG.md',
      autoAgentsMd: true,
      autoSkillInstall: true,
      skillTool: 'agents',
    })
    expect(override.agents.skillTool).toBe('all')

    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({
      output: ['package.json'],
      writeChangelog: false,
      changelogPath: 'docs/CHANGELOG.md',
      autoAgentsMd: false,
      autoSkillInstall: false,
      skillTool: 'claude',
    }))

    const disabled = await loadMirrorConfig({ cwd })

    expect(disabled.agents).toEqual({
      writeChangelog: false,
      changelogPath: 'docs/CHANGELOG.md',
      autoAgentsMd: false,
      autoSkillInstall: false,
      skillTool: 'claude',
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

  test('syncs Mirror guidance to discovered AGENTS.md and CLAUDE.md files', async () => {
    const cwd = await createTempDir()
    await writeText(join(cwd, 'AGENTS.md'), '# Agents\n')
    await writeText(join(cwd, 'CLAUDE.md'), '# Claude\n')

    const results = await ensureMirrorAgentInstructionFiles(cwd…10570 tokens truncated…7, 'apply', 'patch', '--cwd', cwd, '-dy')
    const invalid = await runMirrorCli('version', 'plan', 'patch', '--cwd', cwd, '--arch', 'x64')

    expect(dryRun.exitCode).toBe(0)
    expect(dryRun.stdout).toContain('applied: false')
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.0')
    expect(invalid.exitCode).toBe(1)
    expect(invalid.stderr).toContain('error: Unknown option --arch')
    expect(invalid.stderr).toContain('Build a read-only release plan. (mirror version plan)')
    expect(await readPackageVersion(await loadMirrorConfig({ cwd }))).toBe('1.0.0')
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
      agents: { writeChangelog: true, changelogPath: 'CHANGELOG.md', autoAgentsMd: true, autoSkillInstall: true, skillTool: 'agents' },
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
  const root = platform() === 'win32' ? `${process.env['SystemDrive'] ?? 'C:'}\\tmp` : '/tmp'
  const path = join(root, `guiho-mirror-${crypto.randomUUID()}`)
  await ensureDirectory(path)
  temporaryDirectories.push(path)
  return path
}

const packageAssetName = () => {
  const os = platform() === 'win32'
    ? 'windows'
    : platform() === 'darwin'
      ? 'macos'
      : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64-baseline'
  return `guiho-mirror-${os}-${arch}${os === 'windows' ? '.exe' : ''}`
}

const writeMirrorStubBinary = async (path: string) => {
  const source = `${path}.ts`
  await writeText(source, "console.log('3.4.0')\n")
  const result = Bun.spawn([process.execPath, 'build', source, '--compile', '--outfile', path], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([result.exited, result.stdout.text(), result.stderr.text()])

  if (exitCode !== 0) throw new Error(`failed to compile mirror stub binary\n${stderr}\n${stdout}`)
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
  skillTool,
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
  skillTool?: string
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
`, { writeChangelog, changelogPath, autoAgentsMd, autoSkillInstall, skillTool })}`

const gitConfig = (options: {
  writeChangelog?: boolean
  changelogPath?: string
  autoAgentsMd?: boolean
  autoSkillInstall?: boolean
  skillTool?: string
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
    skillTool?: string
  },
) => {
  const lines: string[] = []

  if (options.writeChangelog !== undefined) lines.push(`write_changelog = ${String(options.writeChangelog)}`)
  if (options.changelogPath !== undefined) lines.push(`changelog_path = "${options.changelogPath}"`)
  if (options.autoAgentsMd !== undefined) lines.push(`auto_agents_md = ${String(options.autoAgentsMd)}`)
  if (options.autoSkillInstall !== undefined) lines.push(`auto_skill_install = ${String(options.autoSkillInstall)}`)
  if (options.skillTool !== undefined) lines.push(`skill_tool = "${options.skillTool}"`)

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
