#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { chmodSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { get } from 'node:https'
import { homedir } from 'node:os'
import { join } from 'node:path'
import packageJson from '../package.json' with { type: 'json' }

const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : process.platform
if (platform !== 'windows' && platform !== 'darwin' && platform !== 'linux') {
  process.stderr.write(`Unsupported platform: ${process.platform}\n`)
  process.exit(5)
}
if (process.arch !== 'x64' && process.arch !== 'arm64') {
  process.stderr.write(`Unsupported architecture: ${process.arch}\n`)
  process.exit(5)
}

const variant = process.arch === 'x64'
  ? (process.env.MIRROR_NATIVE_VARIANT ?? 'baseline')
  : ''
if (variant && variant !== 'baseline' && variant !== 'default' && variant !== 'modern') {
  process.stderr.write(`Invalid MIRROR_NATIVE_VARIANT: ${variant}\n`)
  process.exit(2)
}

const extension = platform === 'windows' ? '.exe' : ''
const suffix = process.arch === 'x64' && variant !== 'default' ? `-${variant}` : ''
const asset = `mirror-${platform}-${process.arch}${suffix}${extension}`
const cacheRoot = process.env.MIRROR_NATIVE_CACHE ?? join(homedir(), '.guiho', 'mirror', 'npm', packageJson.version)
const executable = join(cacheRoot, asset)
const releaseBase = process.env.MIRROR_RELEASE_BASE_URL
  ?? `https://github.com/CGuiho/mirror/releases/download/%40guiho%2Fmirror%40${packageJson.version}`
const url = `${releaseBase.replace(/\/$/, '')}/${asset}`

if (!existsSync(executable)) {
  mkdirSync(cacheRoot, { recursive: true })
  const temporary = `${executable}.${process.pid}.tmp`
  try {
    await download(url, temporary)
    if (platform !== 'windows') chmodSync(temporary, 0o755)
    renameSync(temporary, executable)
  } catch (error) {
    rmSync(temporary, { force: true })
    process.stderr.write(`Unable to install Mirror native binary: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(5)
  }
}

const child = spawnSync(executable, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
})
if (child.error) {
  process.stderr.write(`${child.error.message}\n`)
  process.exit(5)
}
process.exit(child.status ?? 1)

function download(url, destination, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects.'))
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { 'User-Agent': '@guiho/mirror npm bootstrap' } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        download(new URL(response.headers.location, url).toString(), destination, redirects + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Download failed with HTTP ${response.statusCode ?? 'unknown'}.`))
        return
      }
      const output = createWriteStream(destination, { mode: 0o755 })
      response.pipe(output)
      output.on('finish', () => output.close(resolve))
      output.on('error', reject)
    })
    request.on('error', reject)
  })
}
