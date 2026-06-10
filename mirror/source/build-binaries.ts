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

const main = async () => {
  await runCommand(['bun', 'build', 'source/guiho-mirror-bin.ts', '--compile', '--production', '--minify-whitespace', '--minify-syntax', '--outfile', 'bin/mirror'])

  const results = await Promise.all(targets.map(async ([target, outfile]) => {
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

    return { target, outfile, result }
  }))

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
}

await main()
