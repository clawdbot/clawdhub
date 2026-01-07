import { type inferred, type } from 'arktype'

export const GlobalConfigSchema = type({
  registry: 'string',
  token: 'string?',
})
export type GlobalConfig = (typeof GlobalConfigSchema)[inferred]

export const WellKnownConfigSchema = type({
  apiBase: 'string',
  authBase: 'string?',
  minCliVersion: 'string?',
}).or({
  registry: 'string',
  authBase: 'string?',
  minCliVersion: 'string?',
})
export type WellKnownConfig = (typeof WellKnownConfigSchema)[inferred]

export const LockfileSchema = type({
  version: '1',
  skills: {
    '[string]': {
      version: 'string|null',
      installedAt: 'number',
    },
  },
})
export type Lockfile = (typeof LockfileSchema)[inferred]

export const ApiCliWhoamiResponseSchema = type({
  user: {
    handle: 'string|null',
  },
})

export const ApiSearchResponseSchema = type({
  results: type({
    slug: 'string?',
    displayName: 'string?',
    version: 'string|null?',
    score: 'number',
  }).array(),
})

export const ApiSkillMetaResponseSchema = type({
  latestVersion: type({
    version: 'string',
  }).optional(),
  skill: 'unknown|null?',
})

export const ApiCliUploadUrlResponseSchema = type({
  uploadUrl: 'string',
})

export const ApiUploadFileResponseSchema = type({
  storageId: 'string',
})

export const CliPublishFileSchema = type({
  path: 'string',
  size: 'number',
  storageId: 'string',
  sha256: 'string',
  contentType: 'string?',
})
export type CliPublishFile = (typeof CliPublishFileSchema)[inferred]

export const CliPublishRequestSchema = type({
  slug: 'string',
  displayName: 'string',
  version: 'string',
  changelog: 'string',
  tags: 'string[]?',
  forkOf: type({
    slug: 'string',
    version: 'string?',
  }).optional(),
  files: CliPublishFileSchema.array(),
})
export type CliPublishRequest = (typeof CliPublishRequestSchema)[inferred]

export const ApiCliPublishResponseSchema = type({
  ok: 'true',
  skillId: 'string',
  versionId: 'string',
})

export const CliSkillDeleteRequestSchema = type({
  slug: 'string',
})
export type CliSkillDeleteRequest = (typeof CliSkillDeleteRequestSchema)[inferred]

export const ApiCliSkillDeleteResponseSchema = type({
  ok: 'true',
})

export const ApiSkillResolveResponseSchema = type({
  match: type({ version: 'string' }).or('null'),
  latestVersion: type({ version: 'string' }).or('null'),
})

export const CliTelemetrySyncRequestSchema = type({
  roots: type({
    rootId: 'string',
    label: 'string',
    skills: type({
      slug: 'string',
      version: 'string|null?',
    }).array(),
  }).array(),
})
export type CliTelemetrySyncRequest = (typeof CliTelemetrySyncRequestSchema)[inferred]

export const ApiCliTelemetrySyncResponseSchema = type({
  ok: 'true',
})

export const SkillInstallSpecSchema = type({
  id: 'string?',
  kind: '"brew"|"node"|"go"|"uv"',
  label: 'string?',
  bins: 'string[]?',
  formula: 'string?',
  tap: 'string?',
  package: 'string?',
  module: 'string?',
})
export type SkillInstallSpec = (typeof SkillInstallSpecSchema)[inferred]

export const ClawdisRequiresSchema = type({
  bins: 'string[]?',
  anyBins: 'string[]?',
  env: 'string[]?',
  config: 'string[]?',
})
export type ClawdisRequires = (typeof ClawdisRequiresSchema)[inferred]

export const ClawdisSkillMetadataSchema = type({
  always: 'boolean?',
  skillKey: 'string?',
  primaryEnv: 'string?',
  emoji: 'string?',
  homepage: 'string?',
  os: 'string[]?',
  requires: ClawdisRequiresSchema.optional(),
  install: SkillInstallSpecSchema.array().optional(),
})
export type ClawdisSkillMetadata = (typeof ClawdisSkillMetadataSchema)[inferred]
