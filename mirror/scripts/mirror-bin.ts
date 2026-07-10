#!/usr/bin/env bun
/**
 * Small package-manager launcher for the downloaded native Mirror binary.
 */

const binaryPath = new URL(`../vendor/mirror${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url)
const sourceEntrypointPath = new URL('../source/guiho-mirror-bin.ts', import.meta.url)
const executablePath = Bun.fileURLToPath(binaryPath)
const binary = Bun.file(binaryPath)
const args = process.argv.slice(2)

if (!(await binary.exists())) {
  const sourceEntrypoint = Bun.file(sourceEntrypointPath)
  if (await sourceEntrypoint.exists()) {
    const proc = Bun.spawn([process.execPath, Bun.fileURLToPath(sourceEntrypointPath), ...args], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
    process.exit(await proc.exited)
  }

  console.error('notice: first Mirror run is installing the native CLI binary. This may take a moment...')
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

const proc = Bun.spawn([executablePath, ...args], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await proc.exited)
