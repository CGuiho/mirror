/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export const nativeReleaseAssetNames = [
  'mirror-linux-arm64',
  'mirror-linux-x64',
  'mirror-linux-x64-baseline',
  'mirror-linux-x64-modern',
  'mirror-darwin-arm64',
  'mirror-darwin-x64',
  'mirror-darwin-x64-baseline',
  'mirror-darwin-x64-modern',
  'mirror-windows-arm64.exe',
  'mirror-windows-x64.exe',
  'mirror-windows-x64-baseline.exe',
  'mirror-windows-x64-modern.exe',
] as const

export const agentReleaseAssetNames = [
  'guiho-s-mirror.md',
  'guiho-i-mirror.md',
] as const

export const releaseAssetNames = [
  ...agentReleaseAssetNames,
  ...nativeReleaseAssetNames,
].sort()

export const assertExactReleaseAssetManifest = () => {
  if (releaseAssetNames.length !== 14) {
    throw new Error(`Expected exactly 14 release assets, found ${releaseAssetNames.length}`)
  }
  if (new Set(releaseAssetNames).size !== releaseAssetNames.length) {
    throw new Error('Release asset manifest contains duplicate filenames')
  }
}

if (import.meta.main) {
  assertExactReleaseAssetManifest()
  console.log(releaseAssetNames.join('\n'))
}
