/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { dirnamePath } from './path.js'
import { MirrorError } from './errors.js'

export type CommandResult = {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export const fileExists = async (path: string) => Bun.file(path).exists()

export const readTextFile = async (path: string) => Bun.file(path).text()

export const writeTextFile = async (path: string, content: string) => {
  await Bun.write(path, content)
}

export const removePath = async (path: string) => {
  await Bun.$`rm -rf ${path}`.quiet()
}

export const makeTempDirectory = async (prefix = 'mirror-temp-') => {
  const root = process.env['TMPDIR'] ?? process.env['TEMP'] ?? process.env['TMP'] ?? '/tmp'
  const path = `${root.replaceAll('\\', '/')}/${prefix}${crypto.randomUUID()}`
  await Bun.write(`${path}/.keep`, '')
  await removePath(`${path}/.keep`)
  return path
}

export const ensureDirectory = async (path: string) => {
  await Bun.write(`${path.replaceAll('\\', '/')}/.keep`, '')
  await removePath(`${path.replaceAll('\\', '/')}/.keep`)
}

export const ensureParentDirectory = async (path: string) => {
  await ensureDirectory(dirnamePath(path))
}

export const runCommand = async (command: string[], options: { cwd?: string, env?: Record<string, string>, timeoutMs?: number } = {}): Promise<CommandResult> => {
  const proc = Bun.spawn(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  let timedOut = false
  const timeout = options.timeoutMs
    ? setTimeout(() => {
      timedOut = true
      proc.kill()
    }, options.timeoutMs)
    : null
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (timeout) clearTimeout(timeout)

  return { stdout, stderr, exitCode, timedOut }
}

export const runCommandChecked = async (command: string[], options: { cwd?: string, env?: Record<string, string>, label?: string, timeoutMs?: number } = {}) => {
  const result = await runCommand(command, options)
  if (result.exitCode !== 0) {
    const label = options.label ?? command.join(' ')
    const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n')
    throw new MirrorError(`${label} failed (exit code ${result.exitCode})${details ? `\n${details}` : ''}`, result.exitCode)
  }
  return result
}

export const runShellCommand = async (command: string, options: { cwd?: string, env?: Record<string, string> } = {}) => {
  const shell = process.platform === 'win32' ? process.env['COMSPEC'] ?? 'cmd.exe' : process.env['SHELL'] ?? '/bin/sh'
  const args = process.platform === 'win32' ? [shell, '/d', '/c', command] : [shell, '-c', command]
  return runCommand(args, options)
}
