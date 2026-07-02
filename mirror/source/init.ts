/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { MirrorAdapterName, MirrorInitAnswers, MirrorInitFlags, MirrorInitPrompter } from './types.js'
import { basenamePath } from './path.js'
import { supportedGitTagTemplates } from './adapters.js'

const adapterValues = new Set<MirrorAdapterName>(['package.json', 'jsr.json', 'git'])

export const parseAdapterList = (value: string): MirrorAdapterName[] => {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item): item is MirrorAdapterName => adapterValues.has(item as MirrorAdapterName))

  return [...new Set(values)]
}

const parsePathList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

export const resolveInitAnswers = async (
  flags: MirrorInitFlags,
  cwd: string,
  prompter?: MirrorInitPrompter,
): Promise<MirrorInitAnswers> => {
  const source = flags.source ?? (await askAdapter(prompter, 'Version source (package.json, jsr.json, git)', 'package.json'))

  const output =
    flags.output ?? (await askAdapterList(prompter, 'Version outputs (comma separated)', ['package.json', 'git']))

  const usesPackage = source === 'package.json' || output.includes('package.json')
  const usesJsr = source === 'jsr.json' || output.includes('jsr.json')
  const usesGit = source === 'git' || output.includes('git')
  const hasFileOutput = output.includes('package.json') || output.includes('jsr.json')

  const packagePath = usesPackage
    ? flags.packagePath ?? (prompter ? await prompter.text('package.json path', 'package.json') : 'package.json')
    : 'package.json'

  const auxiliaryPaths = usesPackage
    ? flags.auxiliaryPaths ??
      (prompter ? parsePathList(await prompter.text('Auxiliary package.json paths (comma separated, blank for none)', '')) : [])
    : []

  const jsrPath = usesJsr
    ? flags.jsrPath ?? (prompter ? await prompter.text('jsr.json path', 'jsr.json') : 'jsr.json')
    : 'jsr.json'

  const name = flags.name ?? (source === 'git' ? basenamePath(cwd) : undefined)
  const nameAvailable = source === 'package.json' || source === 'jsr.json' || Boolean(name)
  const defaultTagTemplate = nameAvailable ? '{name}@{version}' : 'v{version}'

  const tagTemplate = usesGit
    ? flags.tagTemplate ?? (prompter ? await askTagTemplate(prompter, defaultTagTemplate) : defaultTagTemplate)
    : defaultTagTemplate

  const defaultCommit = usesGit && hasFileOutput
  const commit = flags.commit ?? (usesGit && prompter ? await prompter.confirm('Create release commits?', defaultCommit) : defaultCommit)
  const push = flags.push ?? (usesGit && prompter ? await prompter.confirm('Push release refs?', false) : false)

  const prereleaseId = flags.prereleaseId ?? ''

  return {
    source,
    output,
    packagePath,
    auxiliaryPaths,
    jsrPath,
    name,
    prereleaseId,
    tagTemplate,
    commit,
    push,
  }
}

export const isInteractiveInit = (options: { yes?: boolean; nonInteractive?: boolean }) =>
  Boolean(process.stdin.isTTY) && options.yes !== true && options.nonInteractive !== true

export const createReadlineInitPrompter = (): MirrorInitPrompter => {
  return {
    async text(question, defaultValue) {
      const suffix = defaultValue.length > 0 ? ` [${defaultValue}]` : ' [none]'
      const answer = (prompt(`${question}${suffix}: `) ?? '').trim()
      return answer.length > 0 ? answer : defaultValue
    },
    async confirm(question, defaultValue) {
      const suffix = defaultValue ? ' [Y/n]' : ' [y/N]'
      const answer = (prompt(`${question}${suffix}: `) ?? '').trim().toLowerCase()
      if (answer.length === 0) return defaultValue
      return answer === 'y' || answer === 'yes'
    },
    async select(question, options, defaultIndex) {
      console.log(`${question}:`)
      for (let i = 0; i < options.length; i += 1) {
        const marker = i === defaultIndex ? ' (default)' : ''
        console.log(`  ${i + 1}. ${options[i]}${marker}`)
      }
      const answer = (prompt(`Choice [${defaultIndex + 1}]: `) ?? '').trim()
      if (answer.length === 0) return options[defaultIndex] ?? options[0]!
      const index = parseInt(answer, 10) - 1
      if (Number.isFinite(index) && index >= 0 && index < options.length) return options[index]!
      return options[defaultIndex] ?? options[0]!
    },
    close() {},
  }
}

const askAdapter = async (prompter: MirrorInitPrompter | undefined, question: string, defaultValue: MirrorAdapterName) => {
  if (!prompter) return defaultValue

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answer = (await prompter.text(question, defaultValue)).trim()
    if (adapterValues.has(answer as MirrorAdapterName)) return answer as MirrorAdapterName
  }

  return defaultValue
}

const askAdapterList = async (prompter: MirrorInitPrompter | undefined, question: string, defaultValue: MirrorAdapterName[]) => {
  if (!prompter) return defaultValue

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answer = await prompter.text(question, defaultValue.join(', '))
    const parsed = parseAdapterList(answer)
    if (parsed.length > 0) return parsed
  }

  return defaultValue
}

const askTagTemplate = async (prompter: MirrorInitPrompter, defaultValue: string) => {
  const options = [...supportedGitTagTemplates]
  const defaultIndex = Math.max(0, options.indexOf(defaultValue as typeof options[number]))

  if (prompter.select) {
    return prompter.select('Git tag template', options, defaultIndex)
  }

  return prompter.text('Git tag template', defaultValue)
}
