/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  applyVersionPlan,
  buildVersionPlan,
  loadMirrorConfig,
  parseMirrorCliOptions,
  readJsrName,
  readJsrVersion,
  readPackageName,
  readPackageVersion,
  renderGitTag,
  resolveNextVersion,
  validateMirrorConfig,
  versionFromTag,
  writeJsrVersion,
  writePackageVersion,
} from './guiho-mirror.js'

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
  })

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
  })

  test('runs CLI config show and config check', async () => {
    const cwd = await createGitFixture()
    await writeText(join(cwd, 'mirror.config.toml'), gitConfig())

    const show = await runMirrorCli('config', 'show', '--cwd', cwd)
    const check = await runMirrorCli('config', 'check', '--cwd', cwd)

    expect(show.exitCode).toBe(0)
    expect(show.stdout).toContain('source: git')
    expect(check.exitCode).toBe(0)
    expect(check.stdout.trim()).toBe('ok')
  })

  test('runs the top-level CLI as successful help output', async () => {
    const result = await runMirrorCli()

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toMatch(/mirror v\d+\.\d+\.\d+/)
    expect(result.stdout).toContain('USAGE')
  })

  test('runs CLI help without ANSI colors when no-color is set', async () => {
    const result = await runMirrorCli('--no-color', '--help')

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('USAGE')
    expect(result.stdout).not.toContain('\u001B[')
  })

  test('runs CLI version current, next, plan, and apply', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

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
  })

  test('runs CLI source and repeated output overrides', async () => {
    const cwd = await createPackageAndJsrFixture()
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['package.json'] }))

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
    await writeText(join(cwd, 'mirror.config.toml'), packageConfig({ output: ['git'], tagTemplate: 'v{version}' }))

    const originalPath = process.env['Path'] ?? process.env['PATH'] ?? ''
    const allEntries = originalPath.split(';')
    const bunEntries = allEntries.filter((p) => p.toLowerCase().includes('bun'))
    const systemEntries = ['C:\\Windows\\System32', 'C:\\Windows']
    const minimalPath = [...bunEntries, ...systemEntries].filter(Boolean).join(';')

    const result = await runMirrorCliWithEnv(
      { ...process.env, Path: minimalPath, PATH: minimalPath },
      'config',
      'check',
      '--cwd',
      cwd,
    )

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/Git executable not found/)
  })
})

const createTempDir = async () => {
  const path = await mkdtemp(join(tmpdir(), 'guiho-mirror-'))
  temporaryDirectories.push(path)
  return path
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
  await writeFile(path, content, 'utf8')
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
}: {
  output: string[]
  source?: string
  nameSource?: string
  tagTemplate?: string
  preid?: string
}) => `schema = 1

[project]
name_source = "${nameSource}"

[version]
scheme = "semver"
source = "${source}"
output = [${output.map((value) => `"${value}"`).join(', ')}]
prerelease_id = "${preid}"

[package]
path = "package.json"

[jsr]
path = "jsr.json"

[git]
tag_template = "${tagTemplate}"
commit = false
push = false
allow_dirty = false
`

const gitConfig = () => `schema = 1

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
`

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
  const result = Bun.spawn(['bun', join(import.meta.dir, 'guiho-mirror-bin.ts'), ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
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
