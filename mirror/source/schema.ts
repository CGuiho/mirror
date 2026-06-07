/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

export const mirrorConfigSchemaReference = './node_modules/@guiho/mirror/schema/mirror.config.schema.json'

export const mirrorConfigJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://guiho.co/schema/mirror.config.schema.json',
  title: 'GUIHO Mirror Configuration',
  description: 'Configuration schema for mirror.config.toml.',
  type: 'object',
  required: ['schema', 'version'],
  additionalProperties: false,
  properties: {
    schema: {
      const: 1,
      description: 'Configuration schema version. Must be 1.',
    },
    project: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          description: 'Explicit project name.',
        },
        name_source: {
          enum: ['package.json', 'jsr.json'],
          description: 'Adapter used to read the project name.',
        },
      },
    },
    version: {
      type: 'object',
      additionalProperties: false,
      required: ['source', 'output'],
      properties: {
        scheme: {
          const: 'semver',
          description: 'Versioning scheme. Only "semver" is supported.',
        },
        source: {
          enum: ['package.json', 'jsr.json', 'git'],
          description: 'Adapter Mirror reads the current version from.',
        },
        output: {
          type: 'array',
          minItems: 1,
          items: { enum: ['package.json', 'jsr.json', 'git'] },
          description: 'Adapters Mirror writes the next version to.',
        },
        prerelease_id: {
          type: 'string',
          description: 'Default prerelease identifier, for example "alpha".',
        },
      },
    },
    package: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the main package.json.',
        },
        auxiliary_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Extra package.json files that mirror the main package version.',
        },
      },
    },
    jsr: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Path to jsr.json.',
        },
      },
    },
    git: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tag_template: {
          enum: ['v{version}', '{name}@{version}', '{name}/v{version}'],
          description: 'Git tag format.',
        },
        commit: {
          type: 'boolean',
          description: 'Create release commits.',
        },
        push: {
          type: 'boolean',
          description: 'Push release refs.',
        },
        allow_dirty: {
          type: 'boolean',
          description: 'Allow release in a dirty Git worktree.',
        },
      },
    },
    agents: {
      type: 'object',
      additionalProperties: false,
      properties: {
        write_changelog: {
          type: 'boolean',
          description: 'Tell agents whether changelog edits are allowed.',
        },
        changelog_path: {
          type: 'string',
          description: 'Changelog file path for agents.',
        },
        auto_agents_md: {
          type: 'boolean',
          description: 'Insert Mirror guidance into AGENTS.md when present.',
        },
        auto_skill_install: {
          type: 'boolean',
          description: 'Install guiho-as-mirror globally when missing.',
        },
      },
    },
    hooks: {
      type: 'object',
      description: 'Lifecycle hook commands that run at defined points during version apply.',
      additionalProperties: {
        oneOf: [
          { type: 'string', description: 'A single shell command.' },
          { type: 'array', items: { type: 'string' }, description: 'Multiple shell commands run sequentially.' },
        ],
      },
      properties: Object.fromEntries([
        'before_everything', 'after_everything',
        'before_plan', 'after_plan',
        'before_apply', 'after_apply',
        'before_write', 'after_write',
        'before_commit', 'after_commit',
        'before_tag', 'after_tag',
        'before_push', 'after_push',
      ].map((key) => [key, {
        oneOf: [
          { type: 'string', description: `A single shell command to run at the ${key.replaceAll('_', ':')} lifecycle point.` },
          { type: 'array', items: { type: 'string' }, description: `Multiple shell commands to run sequentially at the ${key.replaceAll('_', ':')} lifecycle point.` },
        ],
      }])),
    },
  },
} as const

export const renderMirrorConfigJsonSchema = () => `${JSON.stringify(mirrorConfigJsonSchema, null, 2)}\n`
