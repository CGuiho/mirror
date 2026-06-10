/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

const windowsDrivePattern = /^[A-Za-z]:\//

export const normalizePath = (path: string) => {
  const slashPath = path.replaceAll('\\', '/')
  const normalized: string[] = []

  for (const part of slashPath.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      const previous = normalized.at(-1)
      if (previous && previous !== '..' && !previous.endsWith(':')) normalized.pop()
      else normalized.push(part)
      continue
    }
    normalized.push(part)
  }

  const prefix = slashPath.startsWith('/') ? '/' : ''
  const joined = `${prefix}${normalized.join('/')}`

  if (!joined) return prefix || '.'
  if (windowsDrivePattern.test(joined)) return joined.replace(/^([A-Za-z]):\//, (_match, drive: string) => `${drive.toUpperCase()}:/`)
  return joined
}

export const isAbsolutePath = (path: string) => {
  const slashPath = path.replaceAll('\\', '/')
  return slashPath.startsWith('/') || windowsDrivePattern.test(slashPath)
}

export const joinPath = (...parts: string[]) => normalizePath(parts.filter(Boolean).join('/'))

export const resolvePath = (...parts: string[]) => {
  let resolved = ''

  for (const part of parts) {
    if (!part) continue
    if (isAbsolutePath(part)) resolved = part
    else resolved = resolved ? `${resolved}/${part}` : part
  }

  if (!resolved || !isAbsolutePath(resolved)) resolved = `${process.cwd()}/${resolved}`

  return normalizePath(resolved)
}

export const dirnamePath = (path: string) => {
  const normalized = normalizePath(path)
  if (normalized === '/' || /^[A-Za-z]:\/$/.test(normalized)) return normalized
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return isAbsolutePath(normalized) ? normalized.slice(0, index + 1) : '.'
  return normalized.slice(0, index)
}

export const basenamePath = (path: string) => {
  const normalized = normalizePath(path)
  const trimmed = normalized.endsWith('/') && normalized.length > 1 ? normalized.slice(0, -1) : normalized
  const index = trimmed.lastIndexOf('/')
  return index >= 0 ? trimmed.slice(index + 1) : trimmed
}

export const relativePath = (from: string, to: string) => {
  const fromPath = resolvePath(from)
  const toPath = resolvePath(to)
  const fromRoot = pathRoot(fromPath)
  const toRoot = pathRoot(toPath)

  if (fromRoot.toLowerCase() !== toRoot.toLowerCase()) return toPath

  const fromParts = stripRoot(fromPath).split('/').filter(Boolean)
  const toParts = stripRoot(toPath).split('/').filter(Boolean)

  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0]?.toLowerCase() === toParts[0]?.toLowerCase()) {
    fromParts.shift()
    toParts.shift()
  }

  return [...fromParts.map(() => '..'), ...toParts].join('/') || '.'
}

const pathRoot = (path: string) => {
  if (path.startsWith('/')) return '/'
  const match = /^([A-Za-z]:)\//.exec(path)
  return match?.[1] ?? ''
}

const stripRoot = (path: string) => {
  const root = pathRoot(path)
  return root ? path.slice(root.length) : path
}
