/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { discoverMirrorConfig } from './config.js'
import { resolveMirrorSchemaPath, saveMirrorConfigSchema } from './config-schema.js'
import { renderMirrorConfigJsonSchema } from './schema.js'
import { resolveNextVersion } from './version.js'
import { joinPath } from './path.js'
import { fileExists, makeTempDirectory, readTextFile, removePath, runCommand, writeTextFile } from './runtime.js'
import { buildAssetCandidates, detectNativeArch, detectNativePlatform } from './self-management.js'
import { assertExactReleaseAssetManifest, releaseAssetNames } from './release-assets.js'
import packageJson from '../package.json' with { type: 'json' }

const temporaryDirectories: string[] = []

setDefaultTimeout(15_000)

afterEach(async () => {
  process.exitCode = 0
  await Promise.all(temporaryDirectories.splice(0).map((path) => removePath(path).catch(() => undefined)))
})

describe('Mirror RFC 0034 CLI', () => {
  test('prints the deterministic platform-aware welcome page', async () => {
    const result = await runCli([])
    const platformName = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('╔════════════════════════════════════════════════════╗')
    expect(result.stdout).toContain('║  MIRROR')
    expect(result.stdout).toContain('Semantic project versioning')
    expect(result.stdout).toContain(`platform      ${platformName} ${process.arch}`)
    expect(result.stdout).toContain(`version       v${packageJson.version}`)
    expect(result.stdout).toContain('Run `mirror --help`')
    expect(result.stderr).toBe('')
  })

  test('prints version and help without configuration', async () => {
    const version = await runCli(['-v'])
    expect(version.exitCode).toBe(0)
    expect(version.stdout).toBe(`${packageJson.version}\n`)
    const help = await runCli(['version', 'plan', '--help'])
    expect(help.exitCode).toBe(0)
    expect(help.stdout).toContain('mirror version plan')
    expect(help.stdout).not.toContain('configuration file loaded:')
  })

  test('prints a cached update notice after the welcome page', async () => {
    const home = await createTemp()
    await writeTextFile(joinPath(home, '.guiho', 'mirror', 'cache.json'), `${JSON.stringify({
      newVersionAvailable: true,
      latestVersion: '999.0.0',
      upgradeCommand: 'mirror upgrade',
      lastCheck: new Date().toISOString(),
    })}\n`)
    const result = await runCli([], { home })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.indexOf('MIRROR')).toBeLessThan(result.stdout.indexOf('⚠ New version available: v999.0.0'))
    expect(result.stdout).toContain('Run mirror upgrade to update.')
  })

  test('routes parent and nested upgrade version flags into dry-run JSON plans', async () => {
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const nextVersion = resolveNextVersion(packageJson.version, 'patch')
    let serverUrl = ''
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const path = decodeURIComponent(new URL(request.url).pathname)
        const requested = /\/releases\/tags\/@guiho\/mirror@(.+)$/.exec(path)?.[1]
        const version = requested ?? nextVersion
        return Response.json({
          tag_name: `@guiho/mirror@${version}`,
          html_url: `https://example.invalid/releases/${version}`,
          prerelease: false,
          draft: false,
          published_at: '2026-07-18T00:00:00Z',
          assets: [{
            name: asset,
            browser_download_url: `${serverUrl}/assets/${asset}`,
          }],
        })
      },
    })
    serverUrl = server.url.origin
    try {
      const env = {
        MIRROR_GITHUB_API_URL: server.url.origin,
        MIRROR_SELF_PATH: process.execPath,
      }
      const latest = await runCli(['upgrade', '--dry-run', '--format', 'json'], { env })
      expect(latest.exitCode).toBe(0)
      const latestEnvelope = JSON.parse(latest.stdout)
      expect(latestEnvelope.outcome).toBe('dry-run')
      expect(latestEnvelope.plan.targetVersion).toBe(nextVersion)
      expect(latestEnvelope.events).toBeArray()
      expect(latestEnvelope.recovery.targetVersion).toBe(nextVersion)
      expect(latestEnvelope.recovery.installCommand).toContain(nextVersion)
      expect(latestEnvelope.error).toBeNull()

      const exact = await runCli(['upgrade', '--version', packageJson.version, '--dry-run', '--format', 'json'], { env })
      expect(exact.exitCode).toBe(0)
      const exactEnvelope = JSON.parse(exact.stdout)
      expect(exactEnvelope.outcome).toBe('up-to-date')
      expect(exactEnvelope.plan.targetVersion).toBe(packageJson.version)
      expect(exactEnvelope.recovery.targetVersion).toBe(packageJson.version)
      expect(exactEnvelope.recovery.stopProcessCommand).toContain('mirror')
      expect(exact.stdout.trim()).not.toBe(packageJson.version)

      const exactText = await runCli(['upgrade', '--version', packageJson.version], { env })
      expect(exactText.exitCode).toBe(0)
      expect(exactText.stdout).toContain(`Already up to date: ${packageJson.version}`)
      expect(exactText.stdout).toContain(`install Mirror ${packageJson.version} directly`)
      expect(exactText.stdout).toContain(exactEnvelope.recovery.installCommand)

      const failed = await runCli(['upgrade', '--version', nextVersion, '--format', 'json'], { env })
      expect(failed.exitCode).toBe(1)
      const failedEnvelope = JSON.parse(failed.stdout)
      expect(failedEnvelope.outcome).toBe('failed')
      expect(failedEnvelope.plan.targetVersion).toBe(nextVersion)
      expect(failedEnvelope.events.some((event: { status: string }) => event.status === 'failed')).toBe(true)
      expect(failedEnvelope.recovery.targetVersion).toBe(nextVersion)
      expect(failedEnvelope.error.code).toBe('UPGRADE_DOWNLOAD_INVALID')

      const failedText = await runCli(['upgrade', '--version', nextVersion], { env })
      expect(failedText.exitCode).toBe(1)
      expect(failedText.stdout).toContain(`install Mirror ${nextVersion} directly`)
      expect(failedText.stdout).toContain('If a running Mirror process blocks installation')
      expect(failedText.stdout).toContain(failedEnvelope.recovery.installCommand)
    } finally {
      server.stop(true)
    }
  })

  test('renders tree and Markdown help from the Citty command definitions', async () => {
    const tree = await runCli(['agent', '--help-tree'])
    expect(tree.exitCode).toBe(0)
    expect(tree.stdout).toStartWith('COMMAND TREE\n\nmirror agent')
    expect(tree.stdout).toContain('├── skill')
    expect(tree.stdout).toContain('└── --help-docs')
    expect(tree.stdout).not.toContain('|-')

    const depth = await runCli(['--help-tree', '--help-tree-depth', '1'])
    expect(depth.exitCode).toBe(0)
    expect(depth.stdout).toContain('mirror')
    expect(depth.stdout).not.toContain('mirror agent skill install')

    const docs = await runCli(['agent', 'prompt', '--help-docs'])
    expect(docs.exitCode).toBe(0)
    expect(docs.stdout).toContain('# mirror agent prompt')
    expect(docs.stdout).toContain('## Subcommands')
  })

  test('rejects invalid help depth and forbidden short aliases', async () => {
    for (const value of ['0', '-1', '1.5', 'abc']) {
      const result = await runCli(['--help-tree', '--help-tree-depth', value])
      expect(result.exitCode).toBe(2)
    }
    expect((await runCli(['version', 'plan', 'patch', '-dy'])).exitCode).toBe(2)
    expect((await runCli(['version', 'apply', 'patch', '-y'])).exitCode).toBe(2)
  })

  test('resolves explicit, project, then global YAML configuration', async () => {
    const root = await createTemp()
    const home = await createTemp()
    const explicit = joinPath(root, 'explicit.yaml')
    const project = joinPath(root, 'mirror.yaml')
    const global = joinPath(home, '.guiho', 'mirror', 'mirror.yaml')
    await writeTextFile(explicit, configYaml({ source: 'git', output: ['git'] }))
    await writeTextFile(project, configYaml())
    await writeTextFile(global, configYaml({ source: 'jsr.json', output: ['jsr.json'] }))
    const previousHome = Bun.env['HOME']
    Bun.env['HOME'] = home
    try {
      expect((await discoverMirrorConfig(root, explicit)).path).toBe(explicit)
      expect((await discoverMirrorConfig(root)).path).toBe(project)
      await removePath(project)
      expect((await discoverMirrorConfig(root)).path).toBe(global)
    } finally {
      if (previousHome === undefined) delete Bun.env['HOME']
      else Bun.env['HOME'] = previousHome
    }
  })

  test('decodes YAML strictly and reports its absolute path', async () => {
    const root = await createProject()
    const result = await runCli(['config', 'show', '--cwd', root])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`configuration file loaded: ${joinPath(root, 'mirror.yaml')}`)
    await writeTextFile(joinPath(root, 'mirror.yaml'), 'schema: 1\nversion:\n  source: package.json\n  output: [unknown]\n')
    const invalid = await runCli(['config', 'check', '--cwd', root])
    expect(invalid.exitCode).toBe(3)
    expect(invalid.stderr).toContain('Invalid Mirror configuration')
  })

  test('creates and reconciles mirror.yaml only', async () => {
    const root = await createTemp()
    const home = await createTemp()
    await writeTextFile(joinPath(root, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n')
    const init = await runCli(['init', '--cwd', root, '--non-interactive'], { home })
    expect(init.exitCode).toBe(0)
    expect(await fileExists(joinPath(root, 'mirror.yaml'))).toBe(true)
    expect([...new Bun.Glob('*.toml').scanSync({ cwd: root })]).toHaveLength(0)
    expect(await readTextFile(joinPath(root, 'mirror.yaml'))).toContain('schema: 1')
    expect(await readTextFile(joinPath(root, 'mirror.yaml'))).toContain('https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/schema/mirror.schema.json')
    expect(await readTextFile(resolveMirrorSchemaPath(home))).toBe(renderMirrorConfigJsonSchema())
  })

  test('saves the global schema atomically and idempotently', async () => {
    const home = await createTemp()
    const created = await saveMirrorConfigSchema(home)
    expect(created.status).toBe('created')
    expect(created.path).toBe(resolveMirrorSchemaPath(home))
    expect(JSON.parse(await readTextFile(created.path))).toEqual(JSON.parse(renderMirrorConfigJsonSchema()))
    expect(JSON.parse(await readTextFile(joinPath(import.meta.dir, '..', 'schema', 'mirror.schema.json'))))
      .toEqual(JSON.parse(renderMirrorConfigJsonSchema()))
    expect((await saveMirrorConfigSchema(home)).status).toBe('current')
    await writeTextFile(created.path, '{broken')
    expect((await saveMirrorConfigSchema(home)).status).toBe('replaced')

    const cli = await runCli(['config', 'schema', '--save', '--format', 'json'], { home })
    expect(cli.exitCode).toBe(0)
    expect(JSON.parse(cli.stdout)).toEqual({ path: created.path, schemaVersion: 1, status: 'current' })
  })

  test('preserves Mirror version domain behavior with YAML configuration', async () => {
    const root = await createProject()
    expect(resolveNextVersion('1.2.3', 'minor', '')).toBe('1.3.0')
    expect((await runCli(['version', 'current', '--cwd', root])).stdout).toEndWith('1.2.3\n')
    expect((await runCli(['version', 'next', 'patch', '--cwd', root])).stdout).toEndWith('1.2.4\n')
    const plan = await runCli(['version', 'plan', 'minor', '--cwd', root, '--format', 'json'])
    expect(plan.exitCode).toBe(0)
    expect(JSON.parse(plan.stdout).nextVersion).toBe('1.3.0')
    expect(JSON.parse(await readTextFile(joinPath(root, 'package.json'))).version).toBe('1.2.3')
  })

  test('ordinary config and version commands never mutate agent files', async () => {
    const root = await createProject()
    await runCli(['config', 'show', '--cwd', root])
    await runCli(['version', 'plan', 'patch', '--cwd', root])
    expect(await fileExists(joinPath(root, 'AGENTS.md'))).toBe(false)
    expect(await fileExists(joinPath(root, 'CLAUDE.md'))).toBe(false)
    expect(await fileExists(joinPath(root, '.agents', 'skills', 'guiho-s-mirror', 'SKILL.md'))).toBe(false)
  })

  test('installs, updates, lists, shows, and uninstalls the local skill in both tools', async () => {
    const root = await createTemp()
    const install = await runCli(['agent', 'skill', 'install', '--local', '--cwd', root])
    expect(install.exitCode).toBe(0)
    for (const tool of ['.agents', '.claude']) {
      expect(await fileExists(joinPath(root, tool, 'skills', 'guiho-s-mirror', 'SKILL.md'))).toBe(true)
    }
    expect((await runCli(['agent', 'skill', 'list', '--filter', 'mirror'])).stdout).toContain('guiho-s-mirror')
    expect((await runCli(['agent', 'skill', 'show', 'guiho-s-mirror'])).stdout).toContain('description')
    expect((await runCli(['agent', 'skill', 'update', '--local', '--cwd', root])).exitCode).toBe(0)
    expect((await runCli(['agent', 'skill', 'uninstall', '--local', '--cwd', root])).exitCode).toBe(0)
    for (const tool of ['.agents', '.claude']) {
      expect(await fileExists(joinPath(root, tool, 'skills', 'guiho-s-mirror', 'SKILL.md'))).toBe(false)
    }
  }, 15_000)

  test('applies, updates, shows, and removes exact instruction blocks idempotently', async () => {
    const root = await createTemp()
    await writeTextFile(joinPath(root, 'AGENTS.md'), '# Agents\n')
    await writeTextFile(joinPath(root, 'CLAUDE.md'), '# Claude\n')
    for (let index = 0; index < 2; index += 1) {
      expect((await runCli(['agent', 'instruction', index === 0 ? 'apply' : 'update', '--cwd', root])).exitCode).toBe(0)
    }
    for (const name of ['AGENTS.md', 'CLAUDE.md']) {
      const content = await readTextFile(joinPath(root, name))
      expect(content.match(/<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->/g)?.length).toBe(1)
      expect(content).toContain('<!-- END MIRROR -->')
    }
    expect((await runCli(['agent', 'instruction', 'show'])).stdout).toStartWith('<!-- BEGIN MIRROR')
    expect((await runCli(['agent', 'instruction', 'remove', '--cwd', root])).exitCode).toBe(0)
    expect(await readTextFile(joinPath(root, 'AGENTS.md'))).not.toContain('BEGIN MIRROR')
  })

  test('lists prompt names and prints raw prompt bodies', async () => {
    const names = await runCli(['agent', 'prompt', 'list', '--names'])
    expect(names.stdout).toBe('guiho-i-mirror\n')
    const prompt = await runCli(['agent', 'prompt', 'show', 'guiho-i-mirror'])
    expect(prompt.stdout).toContain('# Mirror Release')
    expect(prompt.stdout).not.toStartWith('{')
  })

  test('keeps core CLI source free of banned Node imports', async () => {
    const sourceFiles = [...new Bun.Glob('*.ts').scanSync({ cwd: import.meta.dir, absolute: true })]
      .filter((path) => !path.endsWith('.spec.ts'))
    const banned = /from ['"]node:(?:fs|fs\/promises|child_process|path|os)['"]/
    for (const path of sourceFiles) expect(await Bun.file(path).text()).not.toMatch(banned)
  })

  test('declares the exact fourteen release asset names', async () => {
    const build = await readTextFile(joinPath(import.meta.dir, 'build-binaries.ts'))
    assertExactReleaseAssetManifest()
    expect(releaseAssetNames).toHaveLength(14)
    expect(new Set(releaseAssetNames).size).toBe(14)
    expect(releaseAssetNames).toContain('guiho-s-mirror.md')
    expect(releaseAssetNames).toContain('guiho-i-mirror.md')
    expect(build).toContain('nativeReleaseAssetNames')
    expect(build).toContain('agentReleaseAssetNames')
  })

  test('keeps the publish workflow exact, unique, and compatible with gh jq syntax', async () => {
    const workflow = await readTextFile(joinPath(import.meta.dir, '..', '..', '.github', 'workflows', 'publish.yml'))
    expect(workflow).not.toContain("--jq -r")
    expect(workflow).toContain("--jq '.assets[].name'")
    expect(workflow).toContain('UNIQUE_COUNT')
    expect(workflow).toContain('cmp -s')
    expect(workflow).toContain('gh release edit')
    expect(workflow).toContain('--notes-file')
  })
})

const createTemp = async () => {
  const path = await makeTempDirectory('mirror-rfc-')
  temporaryDirectories.push(path)
  return path
}

const createProject = async () => {
  const root = await createTemp()
  await writeTextFile(joinPath(root, 'package.json'), '{"name":"fixture","version":"1.2.3"}\n')
  await writeTextFile(joinPath(root, 'mirror.yaml'), configYaml())
  return root
}

const configYaml = (options: { source?: 'package.json' | 'jsr.json' | 'git', output?: Array<'package.json' | 'jsr.json' | 'git'> } = {}) => [
  'schema: 1',
  'project:',
  '  name_source: package.json',
  'version:',
  '  scheme: semver',
  `  source: ${options.source ?? 'package.json'}`,
  `  output: [${(options.output ?? ['package.json']).join(', ')}]`,
  'package:',
  '  path: package.json',
  'git:',
  '  commit: false',
  '  push: false',
  '  allow_dirty: true',
  '',
].join('\n')

const runCli = async (
  args: string[],
  options: { home?: string, env?: Record<string, string> } = {},
) => {
  const home = options.home ?? await createTemp()
  return runCommand(['bun', joinPath(import.meta.dir, 'guiho-mirror-bin.ts'), ...args], {
    env: {
      HOME: home,
      USERPROFILE: home,
      MIRROR_DISABLE_UPDATE_CHECK: '1',
      NO_COLOR: '1',
      ...options.env,
    },
    timeoutMs: 15_000,
  })
}
