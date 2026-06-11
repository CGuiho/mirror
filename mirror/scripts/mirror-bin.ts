#!/usr/bin/env bun
/**
 * Small package-manager launcher for the downloaded native Mirror binary.
 */

const binaryPath = new URL(`../vendor/mirror${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url)
const executablePath = Bun.fileURLToPath(binaryPath)
const binary = Bun.file(binaryPath)

if (!(await binary.exists())) {
  const installerPath = new URL('install-package.ts', import.meta.url)
  const proc = Bun.spawn([process.execPath, Bun.fileURLToPath(installerPath)], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0 || !(await Bun.file(binaryPath).exists())) {
    console.error('error: GUIHO Mirror native binary is missing. Reinstall @guiho/mirror or run `bun run scripts/install-package.ts`.')
    process.exit(exitCode || 1)
  }
}

const proc = Bun.spawn([executablePath, ...process.argv.slice(2)], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await proc.exited)
