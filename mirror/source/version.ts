/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { inc, rcompare, valid as validSemver } from 'semver'
import type { ReleaseType } from 'semver'
import { MirrorError } from './errors.js'

export const mirrorReleaseTargets = [
  'major',
  'premajor',
  'minor',
  'preminor',
  'patch',
  'prepatch',
  'prerelease',
] as const satisfies readonly ReleaseType[]

export const isMirrorReleaseTarget = (target: string): target is ReleaseType =>
  (mirrorReleaseTargets as readonly string[]).includes(target)

export const assertValidSemver = (version: string, label: string) => {
  if (!validSemver(version)) throw new MirrorError(`${label} is not a valid semantic version: ${version}`)
}

export const resolveNextVersion = (currentVersion: string, target: string, prereleaseId = '') => {
  assertValidSemver(currentVersion, 'Current version')

  if (validSemver(target)) return target
  if (!isMirrorReleaseTarget(target)) throw new MirrorError(`Invalid version target: ${target}`)

  const nextVersion = prereleaseId ? inc(currentVersion, target, prereleaseId) : inc(currentVersion, target)

  if (!nextVersion) throw new MirrorError(`Failed to resolve next version from ${currentVersion} using ${target}`)

  return nextVersion
}

export const sortSemverDescending = (versions: string[]) => [...versions].sort(rcompare)
