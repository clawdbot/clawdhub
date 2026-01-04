import { type inferred } from 'arktype';
export declare const GlobalConfigSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    registry: string;
    token: string;
}, {}>;
export type GlobalConfig = (typeof GlobalConfigSchema)[inferred];
export declare const LockfileSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    version: 1;
    skills: {
        [x: string]: {
            version: string | null;
            installedAt: number;
        };
    };
}, {}>;
export type Lockfile = (typeof LockfileSchema)[inferred];
export declare const ApiCliWhoamiResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    user: {
        handle: string | null;
    };
}, {}>;
export declare const ApiSearchResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    results: [{
        score: number;
        slug?: string | undefined;
        displayName?: string | undefined;
        version?: string | null | undefined;
    }];
}, {}>;
export declare const ApiSkillMetaResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    latestVersion?: {
        version: string;
    } | undefined;
    skill?: unknown;
}, {}>;
export declare const ApiCliUploadUrlResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    uploadUrl: string;
}, {}>;
export declare const ApiUploadFileResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    storageId: string;
}, {}>;
export declare const CliPublishFileSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    path: string;
    size: number;
    storageId: string;
    sha256: string;
    contentType?: string | undefined;
}, {}>;
export type CliPublishFile = (typeof CliPublishFileSchema)[inferred];
export declare const CliPublishRequestSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    slug: string;
    displayName: string;
    version: string;
    changelog: string;
    files: {
        path: string;
        size: number;
        storageId: string;
        sha256: string;
        contentType?: string | undefined;
    }[];
    tags?: string[] | undefined;
}, {}>;
export type CliPublishRequest = (typeof CliPublishRequestSchema)[inferred];
export declare const ApiCliPublishResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    ok: true;
    skillId: string;
    versionId: string;
}, {}>;
export declare const ApiSkillResolveResponseSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    match: {
        version: string;
    } | null;
    latestVersion: {
        version: string;
    } | null;
}, {}>;
export declare const SkillInstallSpecSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    kind: "brew" | "node" | "go" | "uv";
    id?: string | undefined;
    label?: string | undefined;
    bins?: string[] | undefined;
    formula?: string | undefined;
    tap?: string | undefined;
    package?: string | undefined;
    module?: string | undefined;
}, {}>;
export type SkillInstallSpec = (typeof SkillInstallSpecSchema)[inferred];
export declare const ClawdisRequiresSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    bins?: string[] | undefined;
    anyBins?: string[] | undefined;
    env?: string[] | undefined;
    config?: string[] | undefined;
}, {}>;
export type ClawdisRequires = (typeof ClawdisRequiresSchema)[inferred];
export declare const ClawdisSkillMetadataSchema: import("arktype/internal/variants/object.ts").ObjectType<{
    always?: boolean | undefined;
    skillKey?: string | undefined;
    primaryEnv?: string | undefined;
    emoji?: string | undefined;
    homepage?: string | undefined;
    os?: string[] | undefined;
    requires?: {
        bins?: string[] | undefined;
        anyBins?: string[] | undefined;
        env?: string[] | undefined;
        config?: string[] | undefined;
    } | undefined;
    install?: {
        kind: "brew" | "node" | "go" | "uv";
        id?: string | undefined;
        label?: string | undefined;
        bins?: string[] | undefined;
        formula?: string | undefined;
        tap?: string | undefined;
        package?: string | undefined;
        module?: string | undefined;
    }[] | undefined;
}, {}>;
export type ClawdisSkillMetadata = (typeof ClawdisSkillMetadataSchema)[inferred];
