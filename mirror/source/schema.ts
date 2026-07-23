/**
 * @copyright Copyright (c) 2026 GUIHO Technologies as represented by CristÃ³vÃ£o GUIHO. All Rights Reserved.
 */

import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { MirrorError } from './errors.js'

export const mirrorConfigSchemaReference = 'https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/schema/mirror.schema.json'

export const MirrorAdapterSchema = Type.Union([
  Type.Literal('package.json'),
  Type.Literal('jsr.json'),
  Type.Literal('git'),
])
export const MirrorProjectNameSourceSchema = Type.Union([Type.Literal('package.json'), Type.Literal('jsr.json')])
export const MirrorFormatSchema = Type.Union([Type.Literal('text'), Type.Literal('json')])
export const MirrorArchSchema = Type.Union([Type.Literal('x64'), Type.Literal('arm64')])
export const MirrorVariantSchema = Type.Union([Type.Literal('baseline'), Type.Literal('default'), Type.Literal('modern')])
export const PositiveIntegerStringSchema = Type.RegExp(/^[1-9]\d*$/)
export const SemverSchema = Type.RegExp(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
export const MirrorJsonObjectSchema = Type.Record(Type.String(), Type.Unknown())
export const MirrorVersionDocumentSchema = Type.Intersect([
  MirrorJsonObjectSchema,
  Type.Object({
    version: SemverSchema,
    name: Type.Optional(Type.String({ minLength: 1 })),
  }),
])

const HookCommandSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
])

export const MirrorRawConfigSchema = Type.Object({
  schema: Type.Literal(1),
  project: Type.Optional(Type.Object({
    name: Type.Optional(Type.String({ minLength: 1 })),
    name_source: Type.Optional(MirrorProjectNameSourceSchema),
  }, { additionalProperties: false })),
  version: Type.Object({
    scheme: Type.Optional(Type.Literal('semver')),
    source: MirrorAdapterSchema,
    output: Type.Array(MirrorAdapterSchema, { minItems: 1, uniqueItems: true }),
    prerelease_id: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
  package: Type.Optional(Type.Object({
    path: Type.Optional(Type.String({ minLength: 1 })),
    auxiliary_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
  }, { additionalProperties: false })),
  jsr: Type.Optional(Type.Object({
    path: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false })),
  git: Type.Optional(Type.Object({
    tag_template: Type.Optional(Type.Union([
      Type.Literal('v{version}'),
      Type.Literal('{name}@{version}'),
      Type.Literal('{name}/v{version}'),
    ])),
    commit: Type.Optional(Type.Boolean()),
    push: Type.Optional(Type.Boolean()),
    allow_dirty: Type.Optional(Type.Boolean()),
  }, { additionalProperties: false })),
  agents: Type.Optional(Type.Object({
    write_changelog: Type.Optional(Type.Boolean()),
    changelog_path: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false })),
  hooks: Type.Optional(Type.Record(Type.String(), HookCommandSchema)),
}, {
  additionalProperties: false,
  title: 'GUIHO Mirror YAML Configuration',
  description: 'Authoritative mirror.yaml contract.',
})

export const MirrorUpdateCacheSchema = Type.Object({
  newVersionAvailable: Type.Boolean(),
  latestVersion: SemverSchema,
  upgradeCommand: Type.Optional(Type.String({ minLength: 1 })),
  lastCheck: Type.String({ minLength: 1 }),
}, { additionalProperties: false })

export const GitHubAssetSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  browser_download_url: Type.String({ minLength: 1 }),
}, { additionalProperties: true })

export const GitHubReleaseSchema = Type.Object({
  tag_name: Type.String({ minLength: 1 }),
  html_url: Type.String(),
  prerelease: Type.Boolean(),
  draft: Type.Boolean(),
  published_at: Type.Union([Type.String(), Type.Null()]),
  assets: Type.Array(GitHubAssetSchema),
}, { additionalProperties: true })

export const GitHubReleaseCatalogSchema = Type.Array(GitHubReleaseSchema)

export const AgentResourceMetadataSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  version: Type.Optional(Type.String({ minLength: 1 })),
  path: Type.String({ minLength: 1 }),
}, { additionalProperties: false })

export const JsonSuccessEnvelopeSchema = Type.Object({
  ok: Type.Literal(true),
  command: Type.String({ minLength: 1 }),
  result: Type.Unknown(),
}, { additionalProperties: false })

export const JsonErrorEnvelopeSchema = Type.Object({
  ok: Type.Literal(false),
  command: Type.String({ minLength: 1 }),
  error: Type.Object({
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    exitCode: Type.Number(),
  }, { additionalProperties: false }),
}, { additionalProperties: false })

export type MirrorRawConfigDocument = Static<typeof MirrorRawConfigSchema>
export type MirrorVersionDocument = Static<typeof MirrorVersionDocumentSchema>
export type MirrorUpdateCacheDocument = Static<typeof MirrorUpdateCacheSchema>
export type GitHubReleaseDocument = Static<typeof GitHubReleaseSchema>
export type AgentResourceMetadata = Static<typeof AgentResourceMetadataSchema>

export const mirrorConfigJsonSchema = MirrorRawConfigSchema

export const decodeWithSchema = <TSchema, TValue>(
  schema: TSchema,
  input: unknown,
  label: string,
  exitCode = 2,
): TValue => {
  try {
    return Value.Decode(schema as never, input) as TValue
  } catch (error) {
    const details = [...Value.Errors(schema as never, input)]
      .slice(0, 5)
      .map((item) => `${item.path || '/'}: ${item.message}`)
      .join('; ')
    throw new MirrorError(`Invalid ${label}${details ? `: ${details}` : ''}`, exitCode)
  }
}

export const renderMirrorConfigJsonSchema = () => `${JSON.stringify(mirrorConfigJsonSchema, null, 2)}\n`
