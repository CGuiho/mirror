#!/usr/bin/env bun
import { $ } from 'bun'
import { fail } from 'node:assert'
import { type ReleaseType, inc, valid as isValidVersion } from 'semver'

console.info('\n🪞 GUIHO Mirror\n')

const usage = `
  🪞 GUIHO Mirror - A simple tool to bump package.json versions and create git tags
    🪞 GUIHO Mirror will also update package.build.json if it exists

  Usage: mirror <path-to-package.json> <semver-valid-target-version>
  Usage: mirror <semver-valid-target-version>
  Usage: mirror <command>
  Flags:
    -h, --help: Show this message
  Commands:
    see: Show the current version of the package.json

  🪞 GUIHO Mirror
  `

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(usage)
  process.exit(0)
}

if (process.argv[2] === 'see') {
  const json = await Bun.file('./package.json').json()
  const { version, name } = json
  console.log(`  ${version}`)
  console.log(`  ${name}@${version}`)
  process.exit(0)
}

let pathPackageJson = './package.json'
let targetVersion = ''

if (process.argv[2] && process.argv[3]) {
  pathPackageJson = process.argv[2]
  targetVersion = process.argv[3]
} else if (process.argv[2]) {
  targetVersion = process.argv[2]
} else {
  console.info(usage)
  process.exit(0)
}

const variants: ReleaseType[] = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease']

const isValidTarget = (subject: string): subject is ReleaseType => (variants as string[]).includes(subject)

const isDirty = async () => (await $`git status --porcelain`.quiet()).text()

const json = await Bun.file(pathPackageJson || './package.json').json()
const { version: current, name } = json

if (!isValidVersion(current)) throw new Error(`Invalid current version ${current}`)

if (await isDirty()) console.warn('🚧😬 There are uncommitted changes. Commit them before releasing.')

const desired = isValidVersion(targetVersion)
  ? targetVersion
  : targetVersion && isValidTarget(targetVersion)
  ? inc(current, targetVersion, 'beta', '1')
  : fail('invalid target version')

if (!desired) throw new Error('Failed to bump')
console.info(`${current} —> ${desired}\n`)

const newJson = Object.assign(json, { version: desired })
await Bun.write(pathPackageJson, JSON.stringify(newJson, null, 2))

// package.build.json -- This is a separate file that might exist in some projects
// It must have the exact same version as package.json
const pathPackageJsonBuild = String(pathPackageJson).replace('package.json', 'package.build.json')
const buildJsonExists = await Bun.file(pathPackageJsonBuild).exists()

if (buildJsonExists)
  try {
    const buildJson = await Bun.file(pathPackageJsonBuild).json()
    const newBuildJson = Object.assign(buildJson, { version: desired })
    await Bun.write(pathPackageJsonBuild, JSON.stringify(newBuildJson, null, 2))

    console.info('\npackage.build.json has also been updated. \n')

    await $`git add ${pathPackageJsonBuild}`
  } catch {
    console.info('\nNo package.build.json to update. \n')
  }

await $`git add ${pathPackageJson}`
await $`git commit -m ${name}@${desired}`
await $`git tag ${name}@${desired} -m "Release ${name}@${desired}"`
await $`git push`
await $`git push --tags`

const now = new Date()

console.info(`\n🕗 ${now.toTimeString()} of ${now.toDateString()} \n`)

console.info('✅ Done 🚀🎉 \n')

console.info('🪞 GUIHO Mirror')
