/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import { describe, expect, test } from 'bun:test'

import { extractReleaseNotes } from './release-notes.js'

describe('release note extraction', () => {
  test('returns only the exact version section through the next level-two heading', () => {
    const changelog = [
      '# Changelog',
      '',
      '## [3.5.20] - 2026-07-20',
      '',
      '- Wrong prefix match.',
      '',
      '## [3.5.2] - 2026-07-19',
      '',
      '### Fixed',
      '',
      '- Exact release note.',
      '',
      '## Unreleased',
      '',
      '- Must not leak.',
      '',
    ].join('\n')

    expect(extractReleaseNotes(changelog, '3.5.2')).toBe([
      '## [3.5.2] - 2026-07-19',
      '',
      '### Fixed',
      '',
      '- Exact release note.',
      '',
    ].join('\n'))
  })

  test('supports the final changelog section and prerelease versions', () => {
    expect(extractReleaseNotes('## [3.6.0-alpha.1]\n\n- Alpha.\r\n', '3.6.0-alpha.1'))
      .toBe('## [3.6.0-alpha.1]\n\n- Alpha.\n')
  })

  test('rejects missing, duplicate, and invalid exact versions', () => {
    expect(() => extractReleaseNotes('## [3.5.1]\n', '3.5.2')).toThrow('does not contain')
    expect(() => extractReleaseNotes('## [3.5.2]\n\n## [3.5.2]\n', '3.5.2')).toThrow('duplicate')
    expect(() => extractReleaseNotes('## [latest]\n', 'latest')).toThrow('Invalid exact semantic version')
  })
})
