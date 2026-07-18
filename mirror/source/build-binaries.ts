#!/usr/bin/env bun
/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { runCommand, runCommandChecked } from './runtime.js'

const targets = [
  ['bun-linux-arm64', 'bin/mirror-linux-arm64'],
  ['bun-linux-x64', 'bin/mirror-linux-x64'],
  ['bun-linux-x64-baseline', 'bin/mirror-linux-x64-baseline'],
  ['bun-linux-x64-modern', 'bin/mirror-linux-x64-modern'],
  ['bun-darwin-arm64', 'bin/mirror-darwin-arm64'],
  ['bun-darwin-x64', 'bin/mirror-darwin-x64'],
  ['bun-darwin-x64-baseline', 'bin/mirror-darwin-x64-baseline'],
  ['bun-darwin-x64-modern', 'bin/mirror-darwin-x64-modern'],
  ['bun-windows-arm64', 'bin/mirror-windows-arm64.exe'],
  ['bun-windows-x64', 'bin/mirror-windows-x64.exe'],
  ['bun-windows-x64-baseline', 'bin/mirror-windows-x64-baseline.exe'],
  ['bun-windows-x64-modern', 'bin/mirror-windows-x64-modern.exe'],
] as const

const expectedAssetCount = 12
const agentAssets = ['guiho-s-mirror', 'guiho-i-mirror'] as const

if (targets.length !== expectedAssetCount) {
  throw new Error(`Expected ${expectedAssetCount} release binary targets, found ${targets.length}`)
}

if (new Set(targets.map(([, outfile]) => outfile)).size !== targets.length) {
  throw new Error('Release binary target matrix contains duplicate output paths')
}

const main = async () => {
  await Bun.$`rm -rf bin`.quiet()
  await runCommandChecked(
    ['bun', 'build', 'source/guiho-mirror-bin.ts', '--compile', '--production', '--minify-whitespace', '--minify-syntax', '--outfile', 'bin/mirror'],
    { label: 'local native binary build' },
  )

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
  console.log(`verified ${targets.length + agentAssets.length} total release assets`)
}

await main()

async function removeOutput(path: string) {
  await Bun.$`rm -f ${path}`.quiet()
}
