#!/usr/bin/env bun
/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { runCommand } from './runtime.js'

const targets = [
  ['bun-linux-arm64', 'bin/guiho-mirror-linux-arm64'],
  ['bun-linux-x64', 'bin/guiho-mirror-linux-x64'],
  ['bun-linux-x64-baseline', 'bin/guiho-mirror-linux-x64-baseline'],
  ['bun-linux-x64-modern', 'bin/guiho-mirror-linux-x64-modern'],
  ['bun-windows-arm64', 'bin/guiho-mirror-windows-arm64.exe'],
  ['bun-windows-x64', 'bin/guiho-mirror-windows-x64.exe'],
  ['bun-windows-x64-baseline', 'bin/guiho-mirror-windows-x64-baseline.exe'],
  ['bun-windows-x64-modern', 'bin/guiho-mirror-windows-x64-modern.exe'],
  ['bun-darwin-arm64', 'bin/guiho-mirror-macos-arm64'],
  ['bun-darwin-x64', 'bin/guiho-mirror-macos-x64'],
  ['bun-darwin-x64-baseline', 'bin/guiho-mirror-macos-x64-baseline'],
  ['bun-darwin-x64-modern', 'bin/guiho-mirror-macos-x64-modern'],
] as const

const expectedAssetCount = 12

if (targets.length !== expectedAssetCount) {
  throw new Error(`Expected ${expectedAssetCount} release binary targets, found ${targets.length}`)
}

if (new Set(targets.map(([, outfile]) => outfile)).size !== targets.length) {
  throw new Error('Release binary target matrix contains duplicate output paths')
}

const main = async () => {
  await removeOutput('bin/mirror')
  await removeOutput('bin/mirror.exe')
  await runCommand(['bun', 'build', 'source/guiho-mirror-bin.ts', '--compile', '--production', '--minify-whitespace', '--minify-syntax', '--outfile', 'bin/mirror'])

  const results = []

  for (const [target, outfile] of targets) {
    await removeOutput(outfile)
    const result = await runCommand([
      'bun',
      'build',
      'source/guiho-mirror-bin.ts',
      '--compile',
      '--production',
      '--minify-whitespace',
      '--minify-syntax',
      '--target',
      target,
      '--outfile',
      outfile,
    ])

    results.push({ target, outfile, result })
  }

  let failed = false

  for (const { target, outfile, result } of results) {
    if (result.exitCode === 0) {
      console.log(`  OK ${target} -> ${outfile}`)
      continue
    }

    failed = true
    console.error(`  FAIL ${target} -> ${outfile}`)
    const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n')
    if (details) console.error(details)
  }

  if (failed) process.exit(1)

  for (const [, outfile] of targets) {
    const size = Bun.file(outfile).size
    if (size === 0) throw new Error(`Built binary is empty: ${outfile}`)
  }

  console.log(`verified ${targets.length} native binary assets`)
}

await main()

async function removeOutput(path: string) {
  await Bun.$`rm -f ${path}`.quiet()
}
