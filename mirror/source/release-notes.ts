/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { valid as validSemver } from 'semver'

export const extractReleaseNotes = (changelog: string, version: string) => {
  if (validSemver(version) !== version) {
    throw new Error(`Invalid exact semantic version: ${version}`)
  }

  const lines = changelog.replaceAll('\r\n', '\n').split('\n')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`^## \\[${escapedVersion}\\](?:\\s+-\\s+.+)?\\s*$`)
  const matches = lines
    .map((line, index) => heading.test(line) ? index : -1)
    .filter((index) => index >= 0)

  if (matches.length === 0) {
    throw new Error(`CHANGELOG.md does not contain an exact section for ${version}`)
  }
  if (matches.length > 1) {
    throw new Error(`CHANGELOG.md contains duplicate exact sections for ${version}`)
  }

  const start = matches[0]!
  const followingHeading = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/.test(line))
  const end = followingHeading === -1 ? lines.length : start + 1 + followingHeading
  return `${lines.slice(start, end).join('\n').trimEnd()}\n`
}

if (import.meta.main) {
  const [changelogPath, version, ...extra] = Bun.argv.slice(2)
  if (!changelogPath || !version || extra.length > 0) {
    throw new Error('Usage: bun run source/release-notes.ts <CHANGELOG.md> <exact-version>')
  }
  console.log(extractReleaseNotes(await Bun.file(changelogPath).text(), version).trimEnd())
}
