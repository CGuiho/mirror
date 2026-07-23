/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristovao GUIHO. All Rights Reserved.
 */

import { dirnamePath, joinPath, resolvePath } from './path.js'
import { MirrorError } from './errors.js'
import { ensureDirectory, fileExists, readTextFile, removePath, runCommand, writeTextFile } from './runtime.js'
import { renderMirrorConfigJsonSchema } from './schema.js'

export type MirrorSchemaSaveStatus = 'created' | 'replaced' | 'current'

export type MirrorSchemaSaveResult = {
  path: string
  schemaVersion: 1
  status: MirrorSchemaSaveStatus
}

export const resolveMirrorSchemaPath = (home?: string) => {
  const resolvedHome = home ?? Bun.env['HOME'] ?? Bun.env['USERPROFILE']
  if (!resolvedHome) throw new MirrorError('Unable to resolve the user home directory from HOME or USERPROFILE.', 5)
  return resolvePath(resolvedHome, '.guiho', 'mirror', 'schema.json')
}

export const saveMirrorConfigSchema = async (home?: string): Promise<MirrorSchemaSaveResult> => {
  const path = resolveMirrorSchemaPath(home)
  const content = renderMirrorConfigJsonSchema()
  JSON.parse(content)

  const existed = await fileExists(path)
  if (existed) {
    try {
      if (await readTextFile(path) === content) return { path, schemaVersion: 1, status: 'current' }
    } catch {
      // A corrupt or unreadable schema is replaced atomically below.
    }
  }

  await ensureDirectory(dirnamePath(path))
  const temporaryPath = joinPath(dirnamePath(path), `.schema-${crypto.randomUUID()}.tmp`)
  await writeTextFile(temporaryPath, content)
  try {
    await moveSchemaFile(temporaryPath, path)
  } catch (error) {
    await removePath(temporaryPath).catch(() => undefined)
    throw error
  }

  return { path, schemaVersion: 1, status: existed ? 'replaced' : 'created' }
}

const moveSchemaFile = async (source: string, destination: string) => {
  const result = process.platform === 'win32'
    ? await runCommand([
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Move-Item -LiteralPath ${quotePowerShell(source)} -Destination ${quotePowerShell(destination)} -Force`,
    ])
    : await runCommand(['mv', '-f', source, destination])

  if (result.exitCode !== 0) {
    throw new MirrorError(result.stderr.trim() || result.stdout.trim() || `Could not save Mirror schema at ${destination}`, 5)
  }
}

const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`
