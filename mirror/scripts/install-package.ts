#!/usr/bin/env bun
/**
 * Package-manager install helper for GUIHO Mirror.
 *
 * This script uses Bun APIs only. It downloads the platform-native Mirror binary
 * into `bin/mirror` so the installed command does not need Node.js or Bun at
 * runtime. Package managers still need their own runtime while installing.
 */

type PackageJson = {
  version?: string
  repository?: string | { url?: string }
}

const packageJson = await Bun.file(new URL('../package.json', import.meta.url)).json() as PackageJson
const sourceEntrypoint = Bun.file(new URL('../source/guiho-mirror-bin.ts', import.meta.url))

if (await sourceEntrypoint.exists()) {
  console.log('source checkout detected; skipping native binary download')
  process.exit(0)
}

const version = process.env['MIRROR_VERSION'] ?? packageJson.version ?? 'latest'
const repo = process.env['MIRROR_REPO'] ?? 'CGuiho/mirror'
const asset = detectAsset()
const bundledAsset = Bun.file(new URL(`../bin/${asset}`, import.meta.url))
const destination = new URL('../bin/mirror', import.meta.url)

if (await bundledAsset.exists()) {
  await Bun.write(destination, bundledAsset)
  console.log(`installed bundled GUIHO Mirror native binary: ${asset}`)
  process.exit(0)
}

const tag = version === 'latest' ? 'latest' : `@guiho/mirror@${version}`
const url = tag === 'latest'
  ? `https://github.com/${repo}/releases/latest/download/${asset}`
  : `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${asset}`

const response = await fetch(url)

if (!response.ok) {
  console.error(`error: failed to download ${url}`)
  console.error(`status: ${response.status} ${response.statusText}`)
  process.exit(1)
}

await Bun.write(destination, response)
console.log(`installed GUIHO Mirror native binary: ${asset}`)

function detectAsset() {
  const os = detectOs()
  const arch = detectArch()
  return `guiho-mirror-${os}-${arch}${os === 'windows' ? '.exe' : ''}`
}

function detectOs() {
  if (process.platform === 'linux') return 'linux'
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'
  console.error(`error: unsupported OS: ${process.platform}`)
  process.exit(1)
}

function detectArch() {
  if (process.arch === 'x64') return 'x64'
  if (process.arch === 'arm64') return 'arm64'
  console.error(`error: unsupported architecture: ${process.arch}`)
  process.exit(1)
}
