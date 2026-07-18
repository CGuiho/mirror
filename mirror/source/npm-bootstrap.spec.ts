/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import { joinPath } from './path.js'
import { ensureDirectory, makeTempDirectory, removePath, runCommand, writeTextFile } from './runtime.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => removePath(path).catch(() => undefined)))
})

describe('Mirror Node npm bootstrap', () => {
  test('delegates through a cached native binary without Bun on PATH and preserves exit code', async () => {
    const root = await makeTempDirectory('mirror-node-bootstrap-')
    temporaryDirectories.push(root)
    const cache = joinPath(root, 'cache')
    await ensureDirectory(cache)
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux'
    const extension = platform === 'windows' ? '.exe' : ''
    const asset = `mirror-${platform}-${process.arch}-baseline${extension}`
    const source = joinPath(root, 'fixture.ts')
    const executable = joinPath(cache, asset)
    await writeTextFile(source, "console.log(process.argv.slice(2).join('|')); process.exit(7)\n")
    const build = await runCommand(['bun', 'build', source, '--compile', '--outfile', executable])
    expect(build.exitCode).toBe(0)

    const nodeLookup = await runCommand(process.platform === 'win32' ? ['where.exe', 'node.exe'] : ['which', 'node'])
    const node = nodeLookup.stdout.split(/\r?\n/).find(Boolean)
    expect(node).toBeDefined()
    const path = process.platform === 'win32'
      ? `${Bun.env['WINDIR'] ?? 'C:\\Windows'}\\System32`
      : '/usr/bin:/bin'
    const result = await runCommand([node!, joinPath(import.meta.dir, '..', 'scripts', 'mirror-bin.mjs'), 'one', 'two'], {
      env: {
        PATH: path,
        MIRROR_NATIVE_CACHE: cache,
        MIRROR_DISABLE_UPDATE_CHECK: '1',
      },
    })
    expect(result.stdout.trim()).toBe('one|two')
    expect(result.exitCode).toBe(7)
  }, 30_000)
})
