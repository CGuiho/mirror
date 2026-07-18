/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

import type { CommandDef } from 'citty'

type CommandNode = {
  meta?: { name?: string, description?: string, hidden?: boolean }
  args?: Record<string, {
    type?: string
    alias?: string | readonly string[]
    description?: string
    valueHint?: string
    required?: boolean
  }>
  subCommands?: Record<string, CommandNode>
}

export const showMirrorCommandHelpTree = (command: CommandDef<any>, maxDepth?: number): string => {
  const node = command as unknown as CommandNode
  const lines = ['COMMAND TREE', '', commandLabel(node)]
  lines.push(...renderChildren(node, '', 1, maxDepth))
  return lines.join('\n')
}

export const showMirrorCommandHelpDocs = (command: CommandDef<any>): string => {
  const node = command as unknown as CommandNode
  const lines: string[] = []
  renderMarkdown(node, lines, 1)
  return `${lines.join('\n').trimEnd()}\n`
}

const renderChildren = (command: CommandNode, prefix: string, depth: number, maxDepth?: number): string[] => {
  if (maxDepth !== undefined && depth > maxDepth) return []
  const children: Array<{ label: string, description: string, command?: CommandNode }> = []
  for (const [name, definition] of Object.entries(command.subCommands ?? {})) {
    if (name.startsWith('_') || definition.meta?.hidden) continue
    children.push({
      label: name,
      description: definition.meta?.description ?? '',
      command: definition as CommandNode,
    })
  }
  for (const [name, definition] of Object.entries(command.args ?? {})) {
    if (definition.type === 'positional') continue
    const aliases = definition.alias
      ? `, ${[...(Array.isArray(definition.alias) ? definition.alias : [definition.alias])].map((alias) => `-${alias}`).join(', ')}`
      : ''
    const hint = definition.valueHint ? ` <${definition.valueHint}>` : ''
    children.push({ label: `--${name}${hint}${aliases}`, description: definition.description ?? '' })
  }
  const width = children.reduce((value, child) => Math.max(value, child.label.length), 0)
  return children.flatMap((child, index) => {
    const last = index === children.length - 1
    const branch = last ? '└── ' : '├── '
    const line = `${prefix}${branch}${child.label.padEnd(width)}${child.description ? `  ${child.description}` : ''}`
    if (!child.command) return [line]
    return [line, ...renderChildren(child.command, `${prefix}${last ? '    ' : '│   '}`, depth + 1, maxDepth)]
  })
}

const renderMarkdown = (command: CommandNode, lines: string[], level: number) => {
  const title = commandLabel(command)
  lines.push(`${'#'.repeat(Math.min(level, 6))} ${title}`, '')
  if (command.meta?.description) lines.push(command.meta.description, '')
  lines.push('## Syntax', '', `\`${renderSyntax(command)}\``, '')

  const positionals = Object.entries(command.args ?? {}).filter(([, definition]) => definition.type === 'positional')
  if (positionals.length > 0) {
    lines.push('## Positionals', '')
    for (const [name, definition] of positionals) {
      lines.push(`- \`${name}\` — ${definition.description ?? 'No description.'}`)
    }
    lines.push('')
  }

  const flags = Object.entries(command.args ?? {}).filter(([, definition]) => definition.type !== 'positional')
  if (flags.length > 0) {
    lines.push('## Flags', '')
    for (const [name, definition] of flags) {
      lines.push(`- \`--${name}\` — ${definition.description ?? 'No description.'}`)
    }
    lines.push('')
  }

  const subcommands = Object.entries(command.subCommands ?? {}).filter(([name, definition]) => !name.startsWith('_') && !definition.meta?.hidden)
  if (subcommands.length > 0) {
    lines.push('## Subcommands', '')
    for (const [name, definition] of subcommands) {
      lines.push(`- \`${name}\` — ${definition.meta?.description ?? 'No description.'}`)
    }
    lines.push('')
    for (const [, definition] of subcommands) renderMarkdown(definition as CommandNode, lines, level + 1)
  }
}

const commandLabel = (command: CommandNode) => command.meta?.name ?? 'mirror'

const renderSyntax = (command: CommandNode) => {
  const positionals = Object.entries(command.args ?? {})
    .filter(([, definition]) => definition.type === 'positional')
    .map(([name, definition]) => definition.required ? `<${name}>` : `[${name}]`)
  const flags = Object.values(command.args ?? {}).some((definition) => definition.type !== 'positional') ? ['[options]'] : []
  return [commandLabel(command), ...positionals, ...flags].join(' ')
}
