/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export {
  mirrorHelpRecords,
  showMirrorCommandHelp,
  showMirrorCommandHelpDocs,
  showMirrorCommandHelpTree,
  showMirrorHelp,
  showMirrorHelpDocs,
  showMirrorHelpTree,
}

type HelpFlag = {
  readonly name: string
  readonly description: string
}

type HelpExample = {
  readonly command: string
  readonly description: string
}

type HelpRecord = {
  readonly name: string
  readonly summary: string
  readonly usage: readonly string[]
  readonly description: string
  readonly flags: readonly HelpFlag[]
  readonly examples: readonly HelpExample[]
  readonly subcommands?: readonly HelpRecord[]
}

const globalFlags: readonly HelpFlag[] = [
  { name: '--config <path>', description: 'Path to mirror.config.toml.' },
  { name: '--cwd <path>', description: 'Run as if Mirror started in this directory.' },
  { name: '--format text|json', description: 'Choose text or JSON output.' },
  { name: '--tool agents|claude|all', description: 'Override the configured agent skill target.' },
  { name: '--no-color', description: 'Disable ANSI color output.' },
  { name: '--verbose', description: 'Show full error details.' },
  { name: '--help, -h', description: 'Show help.' },
  { name: '--help-tree', description: 'Show the command tree from the current command.' },
  { name: '--help-docs', description: 'Print Markdown documentation for the current command.' },
  { name: '--version', description: 'Show version.' },
]

const mirrorHelpRecords: readonly HelpRecord[] = [
  {
    name: 'init',
    summary: 'Create or reconcile mirror.config.toml.',
    usage: ['mirror init [package.json|jsr.json|git] [options]'],
    description: 'Creates or reconciles Mirror configuration using an interactive wizard when a TTY is available, or flags/defaults in automation.',
    flags: [
      { name: '--source <adapter>', description: 'package.json, jsr.json, or git.' },
      { name: '--output <adapter>', description: 'Output adapters. Repeat or comma-separate values.' },
      { name: '--package-file <path>', description: 'Override package.json path.' },
      { name: '--jsr-file <path>', description: 'Override jsr.json path.' },
      { name: '--auxiliary <path>', description: 'Extra package.json files to mirror.' },
      { name: '--tag-template <template>', description: 'Git tag template.' },
      { name: '--name <name>', description: 'Project name.' },
      { name: '--preid <identifier>', description: 'Prerelease identifier.' },
      { name: '--commit', description: 'Enable release commits.' },
      { name: '--push', description: 'Enable release pushes.' },
      { name: '--non-interactive', description: 'Skip prompts.' },
      { name: '--yes', description: 'Allow replacement/reconciliation without confirmation.' },
    ],
    examples: [
      { command: 'mirror init package.json', description: 'Initialize package.json versioning.' },
      { command: 'mirror init --non-interactive --yes', description: 'Initialize using defaults in automation.' },
    ],
  },
  group('config', 'Validate and inspect configuration.', [
    subcommand('show', 'Print resolved configuration.', ['mirror config show']),
    subcommand('check', 'Validate configuration and adapter files.', ['mirror config check']),
    subcommand('schema', 'Print configuration schema/reference.', ['mirror config schema']),
  ]),
  group('agents', 'Install Mirror-aware AI-agent guidance.', [
    subcommand('install', 'Install the guiho-s-mirror skill locally or globally.', ['mirror agents install local', 'mirror agents install global']),
    subcommand('instructions', 'Create or refresh AGENTS.md/CLAUDE.md guidance.', ['mirror agents instructions']),
  ]),
  group('version', 'Plan and apply semantic version changes.', [
    subcommand('current', 'Print the current version.', ['mirror version current']),
    subcommand('next', 'Print the next version for a target.', ['mirror version next patch']),
    subcommand('plan', 'Build a read-only release plan.', ['mirror version plan patch']),
    subcommand('apply', 'Apply a planned release target.', ['mirror version apply patch --yes']),
  ], [
    { name: '--dry-run, -dy', description: 'Build and print the plan without applying it.' },
    { name: '--commit', description: 'Create a release commit when file outputs changed.' },
    { name: '--push', description: 'Push release refs.' },
    { name: '--allow-dirty', description: 'Allow a dirty worktree.' },
    { name: '--yes, -y', description: 'Apply without interactive confirmation.' },
  ]),
  {
    name: 'upgrade',
    summary: 'Upgrade the installed Mirror native binary.',
    usage: ['mirror upgrade [--version <version>] [--variant <baseline|default|modern>]', 'mirror upgrade check', 'mirror upgrade list'],
    description: 'Downloads the latest compatible GitHub Release binary and replaces the current installed Mirror binary. x64 installs prefer baseline by default.',
    flags: [
      { name: '--version <version>', description: 'Install a specific version instead of latest.' },
      { name: '--arch <x64|arm64>', description: 'Override detected architecture.' },
      { name: '--variant <baseline|default|modern>', description: 'Override x64 variant preference. Defaults to baseline.' },
      { name: '--dry-run', description: 'Print selected asset and URL without replacing the binary.' },
      { name: '--format text|json', description: 'Output format.' },
    ],
    subcommands: [
      subcommand('check', 'Check whether a new Mirror release is available.', ['mirror upgrade check']),
      subcommand('list', 'List available Mirror release versions.', ['mirror upgrade list']),
    ],
    examples: [
      { command: 'mirror upgrade', description: 'Upgrade to latest compatible release.' },
      { command: 'mirror upgrade --dry-run', description: 'Preview selected asset.' },
    ],
  },
  {
    name: 'uninstall',
    summary: 'Remove the installed Mirror native binary.',
    usage: ['mirror uninstall [--dry-run]'],
    description: 'Deletes the current native Mirror executable. On Windows, removal is scheduled after the current process exits.',
    flags: [
      { name: '--dry-run', description: 'Print executable path without deleting it.' },
      { name: '--format text|json', description: 'Output format.' },
    ],
    examples: [
      { command: 'mirror uninstall --dry-run', description: 'Show what would be removed.' },
    ],
  },
]

function showMirrorHelp(version: string): string {
  return [
    `mirror ${version}`,
    'Deterministic semantic versioning for GUIHO projects',
    '',
    'Usage',
    '',
    '  mirror <command> [options]',
    '',
    'Version Commands',
    ...mirrorHelpRecords
      .filter((record) => ['init', 'config', 'version'].includes(record.name))
      .map((record) => `  ${pad(record.name, 18)}${record.summary}`),
    '',
    'Agent Commands',
    ...mirrorHelpRecords
      .filter((record) => ['agents'].includes(record.name))
      .map((record) => `  ${pad(record.name, 18)}${record.summary}`),
    '',
    'Binary Commands',
    ...mirrorHelpRecords
      .filter((record) => ['upgrade', 'uninstall'].includes(record.name))
      .map((record) => `  ${pad(record.name, 18)}${record.summary}`),
    '',
    'Global Options',
    '',
    ...globalFlags.map((flag) => `  ${pad(flag.name, 28)}${flag.description}`),
    '',
    'Use `mirror <command> --help` for command-specific usage.',
    '',
  ].join('\n')
}

function showMirrorCommandHelp(commandPath: readonly string[], version: string): string {
  const record = findRecord(commandPath)
  if (!record) return showMirrorHelp(version)

  return [
    `mirror ${commandPath.join(' ')} - ${record.summary}`,
    '',
    'USAGE',
    '',
    ...record.usage.map((usage) => `  ${usage}`),
    '',
    record.description,
    '',
    ...(record.subcommands?.length ? ['COMMANDS', '', ...record.subcommands.map((sub) => `  ${pad(sub.name, 18)}${sub.summary}`), ''] : []),
    ...(record.flags.length ? ['OPTIONS', '', ...record.flags.map((flag) => `  ${pad(flag.name, 32)}${flag.description}`), ''] : []),
    'EXAMPLES',
    '',
    ...record.examples.map((example) => `  ${pad(example.command, 42)}${example.description}`),
    '',
  ].join('\n')
}

function showMirrorHelpTree(commandPath: readonly string[] = []): string {
  const records = commandPath.length ? [findRecord(commandPath)].filter((record): record is HelpRecord => Boolean(record)) : [...mirrorHelpRecords]
  const title = commandPath.length ? `mirror ${commandPath.join(' ')} command tree` : 'mirror command tree'

  return [
    title,
    'The tree shows commands, nested subcommands, and flags available at each scope.',
    '------------------------------------------------------------',
    ...records.flatMap((record) => renderTreeRecord(record, `mirror ${record.name}`, 0)),
  ].join('\n')
}

function showMirrorCommandHelpTree(commandPath: readonly string[]): string {
  return showMirrorHelpTree(commandPath)
}

function showMirrorHelpDocs(commandPath: readonly string[] = []): string {
  const records = commandPath.length ? [findRecord(commandPath)].filter((record): record is HelpRecord => Boolean(record)) : [...mirrorHelpRecords]
  const title = commandPath.length ? `mirror ${commandPath.join(' ')}` : 'mirror CLI'

  return [
    `# ${title}`,
    '',
    commandPath.length ? records[0]?.description ?? '' : 'Mirror is a deterministic semantic versioning CLI.',
    '',
    '## Usage',
    '',
    ...records.flatMap((record) => record.usage.map((usage) => `- \`${usage}\``)),
    '',
    '## Commands',
    '',
    ...records.flatMap(renderMarkdownRecord),
  ].join('\n').trim() + '\n'
}

function showMirrorCommandHelpDocs(commandPath: readonly string[]): string {
  return showMirrorHelpDocs(commandPath)
}

function group(name: string, summary: string, subcommands: readonly HelpRecord[], flags: readonly HelpFlag[] = []): HelpRecord {
  return {
    name,
    summary,
    usage: subcommands.flatMap((sub) => sub.usage),
    description: summary,
    flags: [
      { name: '--format text|json', description: 'Output format.' },
      ...flags,
    ],
    subcommands,
    examples: subcommands.slice(0, 2).map((sub) => ({ command: sub.usage[0] ?? `mirror ${name} ${sub.name}`, description: sub.summary })),
  }
}

function subcommand(name: string, summary: string, usage: readonly string[]): HelpRecord {
  return { name, summary, usage, description: summary, flags: [], examples: usage.map((command) => ({ command, description: summary })) }
}

function findRecord(commandPath: readonly string[]): HelpRecord | undefined {
  let current = mirrorHelpRecords.find((record) => record.name === commandPath[0])
  for (const part of commandPath.slice(1)) current = current?.subcommands?.find((record) => record.name === part)
  return current
}

function renderTreeRecord(record: HelpRecord, label: string, depth: number): string[] {
  const indent = '  '.repeat(depth)
  const lines = [`${indent}|- ${label}`, `${indent}|  ${record.summary}`]
  if (record.flags.length > 0) {
    lines.push(`${indent}|  Flags:`)
    for (const flag of record.flags) lines.push(`${indent}|    ${flag.name} - ${flag.description}`)
  }
  for (const sub of record.subcommands ?? []) lines.push(...renderTreeRecord(sub, `${label} ${sub.name}`, depth + 1))
  return lines
}

function renderMarkdownRecord(record: HelpRecord): string[] {
  return [
    `### \`${record.name}\``,
    '',
    record.description,
    '',
    'Usage:',
    '',
    ...record.usage.map((usage) => `- \`${usage}\``),
    '',
    ...(record.flags.length ? ['Flags:', '', ...record.flags.map((flag) => `- \`${flag.name}\`: ${flag.description}`), ''] : []),
    ...(record.examples.length ? ['Examples:', '', ...record.examples.map((example) => `- \`${example.command}\`: ${example.description}`), ''] : []),
    ...(record.subcommands?.length ? ['Subcommands:', '', ...record.subcommands.map((sub) => `- \`${sub.name}\`: ${sub.summary}`), ''] : []),
  ]
}

function pad(value: string, length: number): string {
  return value + ' '.repeat(Math.max(1, length - value.length))
}
