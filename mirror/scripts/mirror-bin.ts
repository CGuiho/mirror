#!/usr/bin/env bun
/**
 * Small package-manager launcher for the downloaded native Mirror binary.
 */

const binaryPath = new URL('../vendor/mirror', import.meta.url)
const binary = Bun.file(binaryPath)

if (!(await binary.exists())) {
  console.error('error: GUIHO Mirror native binary is missing. Reinstall @guiho/mirror or run `bun run scripts/install-package.ts`.')
  process.exit(1)
}

const proc = Bun.spawn([binaryPath.pathname, ...process.argv.slice(2)], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await proc.exited)
