#!/usr/bin/env bun

import { $ } from 'bun'
import { fail } from 'node:assert'
import { type ReleaseType, inc, valid as isValidVersion } from 'semver'

const projectName = process.argv[2]
const pathPackageJson = process.argv[3]
const targetVersion = Bun.argv[4]

const usage = `Usage: ${process.argv[1]} <project-name> <path-to-package.json> <semver-valid-target-version>`

if (!projectName) throw new Error('No project name provided. \n' + usage)
if (!pathPackageJson) throw new Error('No path provided. \n' + usage)
if (!targetVersion) throw new Error('No target version provided. \n' + usage)

const variants: ReleaseType[] = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease']

const isValidTarget = (subject: string): subject is ReleaseType => (variants as string[]).includes(subject)

const isDirty = async () => (await $`git status --porcelain`.quiet()).text()

const json = await Bun.file(pathPackageJson).json()
const { version: current } = json

if (!isValidVersion(current)) throw new Error(`Invalid current version ${current}`)

if (await isDirty()) console.warn('There are uncommitted changes. Commit them before releasing.')

const desired = isValidVersion(targetVersion)
  ? targetVersion
  : targetVersion && isValidTarget(targetVersion)
  ? inc(current, targetVersion, 'beta', '1')
  : fail('invalid target version')

if (!desired) throw new Error('Failed to bump')
console.debug(current, '—>', desired)

await Bun.write(pathPackageJson, JSON.stringify(Object.assign(json, { version: desired }), null, 2))

await $`git add ${pathPackageJson}`
await $`git commit -m ${projectName}@${desired}`
await $`git tag ${projectName}@${desired} -m "Release ${projectName}@${desired}"`
await $`git push`
await $`git push --tags`
