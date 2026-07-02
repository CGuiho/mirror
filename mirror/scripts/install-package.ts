#!/usr/bin/env bun
/**
 * Package-manager install helper for GUIHO Mirror.
 *
 * This script uses Bun APIs only. It downloads the platform-native Mirror binary
 * into `vendor/mirror` or `vendor/mirror.exe`. Package-manager installs use the
 * small Bun launcher in `scripts/mirror-bin.ts`; direct installers remain the
 * no-Bun runtime path.
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

console.log('🪞  Installing GUIHO Mirror native binary...')

const version = process.env['MIRROR_VERSION'] ?? packageJson.version ?? 'latest'
const repo = process.env['MIRROR_REPO'] ?? 'CGuiho/mirror'
const candidates = detectAssetCandidates()
const destination = new URL(`../vendor/mirror${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url)

for (const asset of candidates) {
  const bundledUrl = new URL(`../bin/${asset}`, import.meta.url)
  const bundledAsset = Bun.file(bundledUrl)

  if (await bundledAsset.exists()) {
    await Bun.write(destination, bundledAsset)
    await makeExecutable(destination)
    console.log(`installed bundled GUIHO Mirror native binary: ${asset}`)
    process.exit(0)
  }
}

for (const asset of candidates) {
  const tag = version === 'latest' ? 'latest' : `@guiho/mirror@${version}`
  const url = tag === 'latest'
    ? `https://github.com/${repo}/releases/latest/download/${asset}`
    : `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${asset}`

  console.log(`    Downloading ${asset} from GitHub Releases...`)
  const response = await fetch(url)

  if (!response.ok) {
    if (candidates.length > 1 && asset !== candidates[candidates.length - 1]) {
      console.log(`    ${asset} not available (${response.status}), trying next variant...`)
      continue
    }
    console.error(`error: failed to download ${url}`)
    console.error(`status: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  await Bun.write(destination, response)
  await makeExecutable(destination)
  console.log(`installed GUIHO Mirror native binary: ${asset}`)
  process.exit(0)
}

console.error('error: no compatible GUIHO Mirror binary found for this platform')
process.exit(1)

async function makeExecutable(path: URL) {
  if (process.platform === 'win32') return

  const result = Bun.spawn(['chmod', '755', Bun.fileURLToPath(path)], {
    stdout: 'ignore',
    stderr: 'inherit',
  })
  const exitCode = await result.exited

  if (exitCode !== 0) {
    console.error('error: failed to make GUIHO Mirror native binary executable')
    process.exit(exitCode)
  }
}

function detectAssetCandidates() {
  const os = detectOs()
  const arch = detectArch()
  const ext = os === 'windows' ? '.exe' : ''

  if (arch === 'x64') {
    return [`guiho-mirror-${os}-x64-baseline${ext}`]
  }

  return [`guiho-mirror-${os}-${arch}${ext}`]
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
