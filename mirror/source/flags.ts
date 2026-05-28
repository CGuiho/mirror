/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { MirrorAdapterName, MirrorCliOptions, MirrorFormat } from './types.js'
import { MirrorError } from './errors.js'

const booleanFlags = new Set(['dry-run', 'commit', 'push', 'allow-dirty', 'yes', 'no-color', 'verbose', 'help', 'version'])
const adapterNames = new Set(['package.json', 'jsr.json', 'git'])

const shortFlagAliases: Record<string, string> = {
  '-dy': '--dry-run',
  '-y': '--yes',
}

const normalizeKey = (key: string) => key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())

const expandShortFlags = (rawArgs: string[]) => rawArgs.map((token) => shortFlagAliases[token] ?? token)

export const parseMirrorCliOptions = (rawArgs: string[]): MirrorCliOptions => {
  const parsed: Record<string, string | boolean | string[]> = {}
  const args = expandShortFlags(rawArgs)

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]

    if (!token?.startsWith('--')) continue

    const withoutPrefix = token.slice(2)
    const equalsIndex = withoutPrefix.indexOf('=')
    const rawKey = equalsIndex >= 0 ? withoutPrefix.slice(0, equalsIndex) : withoutPrefix
    const key = normalizeKey(rawKey)

    if (booleanFlags.has(rawKey)) {
      parsed[key] = true
      continue
    }

    const value =
      equalsIndex >= 0
        ? withoutPrefix.slice(equalsIndex + 1)
        : args[index + 1] && !args[index + 1]?.startsWith('-')
        ? args[++index] ?? ''
        : ''

    if (!value) throw new MirrorError(`Missing value for --${rawKey}`)

    if (key === 'output') {
      const nextValues = value.split(',').map((item) => item.trim()).filter(Boolean)
      const current = parsed['output']
      parsed['output'] = [...(Array.isArray(current) ? current : current ? [String(current)] : []), ...nextValues]
      continue
    }

    parsed[key] = value
  }

  return {
    cwd: typeof parsed['cwd'] === 'string' ? parsed['cwd'] : undefined,
    config: typeof parsed['config'] === 'string' ? parsed['config'] : undefined,
    format: typeof parsed['format'] === 'string' ? assertFormat(parsed['format']) : undefined,
    noColor: parsed['noColor'] === true,
    source: typeof parsed['source'] === 'string' ? assertAdapter(parsed['source'], '--source') : undefined,
    output: Array.isArray(parsed['output']) ? parsed['output'].map((value) => assertAdapter(value, '--output')) : undefined,
    packageFile: typeof parsed['packageFile'] === 'string' ? parsed['packageFile'] : undefined,
    jsrFile: typeof parsed['jsrFile'] === 'string' ? parsed['jsrFile'] : undefined,
    preid: typeof parsed['preid'] === 'string' ? parsed['preid'] : undefined,
    dryRun: parsed['dryRun'] === true,
    commit: parsed['commit'] === true,
    push: parsed['push'] === true,
    allowDirty: parsed['allowDirty'] === true,
    yes: parsed['yes'] === true,
    verbose: parsed['verbose'] === true,
  }
}

const assertAdapter = (value: string, flagName: string): MirrorAdapterName => {
  if (!adapterNames.has(value)) throw new MirrorError(`Invalid ${flagName} value: ${value}`)
  return value as MirrorAdapterName
}

const assertFormat = (value: string): MirrorFormat => {
  if (value !== 'text' && value !== 'json') throw new MirrorError(`Invalid --format value: ${value}`)
  return value
}
