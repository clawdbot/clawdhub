import { type } from 'arktype';
export const GlobalConfigSchema = type({
    registry: 'string',
    token: 'string',
});
export const LockfileSchema = type({
    version: '1',
    skills: {
        '[string]': {
            version: 'string|null',
            installedAt: 'number',
        },
    },
});
export const ApiCliWhoamiResponseSchema = type({
    user: {
        handle: 'string|null',
    },
});
export const ApiSearchResponseSchema = type({
    results: [
        {
            slug: 'string?',
            displayName: 'string?',
            version: 'string|null?',
            score: 'number',
        },
    ],
});
export const ApiSkillMetaResponseSchema = type({
    latestVersion: type({
        version: 'string',
    }).optional(),
    skill: 'unknown|null?',
});
export const ApiCliUploadUrlResponseSchema = type({
    uploadUrl: 'string',
});
export const ApiUploadFileResponseSchema = type({
    storageId: 'string',
});
export const CliPublishFileSchema = type({
    path: 'string',
    size: 'number',
    storageId: 'string',
    sha256: 'string',
    contentType: 'string?',
});
export const CliPublishRequestSchema = type({
    slug: 'string',
    displayName: 'string',
    version: 'string',
    changelog: 'string',
    tags: 'string[]?',
    files: CliPublishFileSchema.array(),
});
export const ApiCliPublishResponseSchema = type({
    ok: 'true',
    skillId: 'string',
    versionId: 'string',
});
export const ApiSkillResolveResponseSchema = type({
    match: type({ version: 'string' }).or('null'),
    latestVersion: type({ version: 'string' }).or('null'),
});
export const SkillInstallSpecSchema = type({
    id: 'string?',
    kind: '"brew"|"node"|"go"|"uv"',
    label: 'string?',
    bins: 'string[]?',
    formula: 'string?',
    tap: 'string?',
    package: 'string?',
    module: 'string?',
});
export const ClawdisRequiresSchema = type({
    bins: 'string[]?',
    anyBins: 'string[]?',
    env: 'string[]?',
    config: 'string[]?',
});
export const ClawdisSkillMetadataSchema = type({
    always: 'boolean?',
    skillKey: 'string?',
    primaryEnv: 'string?',
    emoji: 'string?',
    homepage: 'string?',
    os: 'string[]?',
    requires: ClawdisRequiresSchema.optional(),
    install: SkillInstallSpecSchema.array().optional(),
});
//# sourceMappingURL=schemas.js.map