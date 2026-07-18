/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { discoverMirrorConfig } from './config.js'
import { resolveNextVersion } from './version.js'
import { joinPath } from './path.js'
import { fileExists, makeTempDirectory, readTextFile, removePath, runCommand, writeTextFile } from './runtime.js'
import { buildAssetCandidates, detectNativeArch, detectNativePlatform } from './self-management.js'
import packageJson from '../package.json' with { type: 'json' }

const temporaryDirectories: string[] = []

afterEach(async () => {
  process.exitCode = 0
  await Promise.all(temporaryDirectories.splice(0).map((path) => removePath(path).catch(() => undefined)))
})

describe('Mirror RFC 0034 CLI', () => {
  test('prints the exact no-argument banner', async () => {
    const result = await runCli([])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe(`Hello Windows - mirror v${packageJson.version}\n`)
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

  test('prints a cached update notice before the no-argument banner', async () => {
    const home = await createTemp()
    await writeTextFile(joinPath(home, '.guiho', 'mirror', 'cache.json'), `${JSON.stringify({
      newVersionAvailable: true,
      latestVersion: '999.0.0',
      upgradeCommand: 'mirror upgrade',
      lastCheck: new Date().toISOString(),
    })}\n`)
    const result = await runCli([], { home })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe(
      `New version available. Run this command to upgrade: mirror upgrade\nHello Windows - mirror v${packageJson.version}\n`,
    )
  })

  test('routes parent and nested upgrade version flags into dry-run JSON plans', async () => {
    const platform = detectNativePlatform()
    const arch = detectNativeArch()
    const asset = buildAssetCandidates(platform, arch, 'baseline')[0]!
    const nextVersion = resolveNextVersion(packageJson.version, 'patch')
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const exact = new URL(request.url).pathname.includes('/releases/tags/')
        const version = exact ? packageJson.version : nextVersion
        return Response.json({
          tag_name: `@guiho/mirror@${version}`,
          html_url: `https://example.invalid/releases/${version}`,
          prerelease: false,
          draft: false,
          published_at: '2026-07-18T00:00:00Z',
          assets: [{
            name: asset,
            browser_download_url: `https://example.invalid/assets/${asset}`,
          }],
        })
      },
    })
    try {
      const env = {
        MIRROR_GITHUB_API_URL: server.url.origin,
        MIRROR_SELF_PATH: joinPath(await createTemp(), 'mirror.exe'),
      }
      const latest = await runCli(['upgrade', '--dry-run', '--format', 'json'], { env })
      expect(latest.exitCode).toBe(0)
      expect(JSON.parse(latest.stdout).outcome).toBe('dry-run')
      expect(JSON.parse(latest.stdout).plan.targetVersion).toBe(nextVersion)

      const exact = await runCli(['upgrade', '--version', packageJson.version, '--dry-run', '--format', 'json'], { env })
      expect(exact.exitCode).toBe(0)
      expect(JSON.parse(exact.stdout).outcome).toBe('up-to-date')
      expect(JSON.parse(exact.stdout).plan.targetVersion).toBe(packageJson.version)
      expect(exact.stdout.trim()).not.toBe(packageJson.version)
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
    await writeTextFile(joinPath(root, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n')
    const init = await runCli(['init', '--cwd', root, '--non-interactive'])
    expect(init.exitCode).toBe(0)
    expect(await fileExists(joinPath(root, 'mirror.yaml'))).toBe(true)
    expect(await fileExists(joinPath(root, 'mirror.config.toml'))).toBe(false)
    expect(await readTextFile(joinPath(root, 'mirror.yaml'))).toContain('schema: 1')
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
  })

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
    const binaries = [
      'mirror-linux-arm64',
      'mirror-linux-x64',
      'mirror-linux-x64-baseline',
      'mirror-linux-x64-modern',
      'mirror-darwin-arm64',
      'mirror-darwin-x64',
      'mirror-darwin-x64-baseline',
      'mirror-darwin-x64-modern',
      'mirror-windows-arm64.exe',
      'mirror-windows-x64.exe',
      'mirror-windows-x64-baseline.exe',
      'mirror-windows-x64-modern.exe',
    ]
    for (const asset of [...binaries, 'guiho-s-mirror', 'guiho-i-mirror']) expect(build).toContain(asset)
    expect(new Set(binaries).size + 2).toBe(14)
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
