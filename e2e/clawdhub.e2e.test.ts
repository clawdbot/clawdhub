/* @vitest-environment node */

import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ApiCliWhoamiResponseSchema,
  ApiRoutes,
  ApiSearchResponseSchema,
  parseArk,
} from 'clawdhub-schema'
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readGlobalConfig } from '../packages/clawdhub/src/config'

function mustGetToken() {
  const fromEnv = process.env.CLAWDHUB_E2E_TOKEN?.trim()
  if (fromEnv) return fromEnv
  return null
}

async function makeTempConfig(registry: string, token: string | null) {
  const dir = await mkdtemp(join(tmpdir(), 'clawdhub-e2e-'))
  const path = join(dir, 'config.json')
  await writeFile(
    path,
    `${JSON.stringify({ registry, token: token || undefined }, null, 2)}\n`,
    'utf8',
  )
  return { dir, path }
}

describe('clawdhub e2e', () => {
  it('prints CLI version via --cli-version', async () => {
    const result = spawnSync('bun', ['clawdhub', '--cli-version'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('search endpoint returns a results array (schema parse)', async () => {
    const registry = process.env.CLAWDHUB_REGISTRY?.trim() || 'https://clawdhub.com'
    const url = new URL(ApiRoutes.search, registry)
    url.searchParams.set('q', 'gif')
    url.searchParams.set('limit', '5')

    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    expect(response.ok).toBe(true)
    const json = (await response.json()) as unknown
    const parsed = parseArk(ApiSearchResponseSchema, json, 'API response')
    expect(Array.isArray(parsed.results)).toBe(true)
  })

  it('cli search does not error on multi-result responses', async () => {
    const registry = process.env.CLAWDHUB_REGISTRY?.trim() || 'https://clawdhub.com'
    const site = process.env.CLAWDHUB_SITE?.trim() || 'https://clawdhub.com'
    const token = mustGetToken() ?? (await readGlobalConfig())?.token ?? null

    const cfg = await makeTempConfig(registry, token)
    try {
      const workdir = await mkdtemp(join(tmpdir(), 'clawdhub-e2e-workdir-'))
      const result = spawnSync(
        'bun',
        [
          'clawdhub',
          'search',
          'gif',
          '--limit',
          '5',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      await rm(workdir, { recursive: true, force: true })

      expect(result.status).toBe(0)
      expect(result.stderr).not.toMatch(/API response:/)
    } finally {
      await rm(cfg.dir, { recursive: true, force: true })
    }
  })

  it('assumes a logged-in user (whoami succeeds)', async () => {
    const registry = process.env.CLAWDHUB_REGISTRY?.trim() || 'https://clawdhub.com'
    const site = process.env.CLAWDHUB_SITE?.trim() || 'https://clawdhub.com'
    const token = mustGetToken() ?? (await readGlobalConfig())?.token ?? null
    if (!token) {
      throw new Error('Missing token. Set CLAWDHUB_E2E_TOKEN or run: bun clawdhub auth login')
    }

    const cfg = await makeTempConfig(registry, token)
    try {
      const whoamiUrl = new URL(ApiRoutes.cliWhoami, registry)
      const whoamiRes = await fetch(whoamiUrl.toString(), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      })
      expect(whoamiRes.ok).toBe(true)
      const whoami = parseArk(
        ApiCliWhoamiResponseSchema,
        (await whoamiRes.json()) as unknown,
        'Whoami',
      )
      expect(whoami.user).toBeTruthy()

      const result = spawnSync(
        'bun',
        ['clawdhub', 'whoami', '--site', site, '--registry', registry],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(0)
      expect(result.stderr).not.toMatch(/not logged in|unauthorized|error:/i)
    } finally {
      await rm(cfg.dir, { recursive: true, force: true })
    }
  })

  it('sync dry-run finds skills from an explicit root', async () => {
    const registry = process.env.CLAWDHUB_REGISTRY?.trim() || 'https://clawdhub.com'
    const site = process.env.CLAWDHUB_SITE?.trim() || 'https://clawdhub.com'
    const token = mustGetToken() ?? (await readGlobalConfig())?.token ?? null
    if (!token) {
      throw new Error('Missing token. Set CLAWDHUB_E2E_TOKEN or run: bun clawdhub auth login')
    }

    const cfg = await makeTempConfig(registry, token)
    const root = await mkdtemp(join(tmpdir(), 'clawdhub-e2e-sync-'))
    try {
      const skillDir = join(root, 'cool-skill')
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), '# Skill\n', 'utf8')

      const result = spawnSync(
        'bun',
        [
          'clawdhub',
          'sync',
          '--dry-run',
          '--all',
          '--root',
          root,
          '--site',
          site,
          '--registry',
          registry,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(0)
      expect(result.stderr).not.toMatch(/error:/i)
      expect(result.stdout).toMatch(/Dry run/i)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cfg.dir, { recursive: true, force: true })
    }
  })

  it('publishes, deletes, and undeletes a skill (logged-in)', async () => {
    const registry = process.env.CLAWDHUB_REGISTRY?.trim() || 'https://clawdhub.com'
    const site = process.env.CLAWDHUB_SITE?.trim() || 'https://clawdhub.com'
    const token = mustGetToken() ?? (await readGlobalConfig())?.token ?? null
    if (!token) {
      throw new Error('Missing token. Set CLAWDHUB_E2E_TOKEN or run: bun clawdhub auth login')
    }

    const cfg = await makeTempConfig(registry, token)
    const workdir = await mkdtemp(join(tmpdir(), 'clawdhub-e2e-publish-'))
    const installWorkdir = await mkdtemp(join(tmpdir(), 'clawdhub-e2e-install-'))
    const slug = `e2e-${Date.now()}`
    const skillDir = join(workdir, slug)

    try {
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), `# ${slug}\n\nHello.\n`, 'utf8')

      const publish1 = spawnSync(
        'bun',
        [
          'clawdhub',
          'publish',
          skillDir,
          '--slug',
          slug,
          '--name',
          `E2E ${slug}`,
          '--version',
          '1.0.0',
          '--tags',
          'latest',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(publish1.status).toBe(0)
      expect(publish1.stderr).not.toMatch(/changelog required/i)

      const publish2 = spawnSync(
        'bun',
        [
          'clawdhub',
          'publish',
          skillDir,
          '--slug',
          slug,
          '--name',
          `E2E ${slug}`,
          '--version',
          '1.0.1',
          '--tags',
          'latest',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(publish2.status).toBe(0)
      expect(publish2.stderr).not.toMatch(/changelog required/i)

      const downloadUrl = new URL(ApiRoutes.download, registry)
      downloadUrl.searchParams.set('slug', slug)
      downloadUrl.searchParams.set('version', '1.0.1')
      const zipRes = await fetch(downloadUrl.toString())
      expect(zipRes.ok).toBe(true)
      const zipBytes = new Uint8Array(await zipRes.arrayBuffer())
      const unzipped = unzipSync(zipBytes)
      expect(Object.keys(unzipped)).toContain('SKILL.md')

      const install = spawnSync(
        'bun',
        [
          'clawdhub',
          'install',
          slug,
          '--version',
          '1.0.0',
          '--force',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          installWorkdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(install.status).toBe(0)

      const list = spawnSync(
        'bun',
        ['clawdhub', 'list', '--site', site, '--registry', registry, '--workdir', installWorkdir],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(list.status).toBe(0)
      expect(list.stdout).toMatch(new RegExp(`${slug}\\s+1\\.0\\.0`))

      const update = spawnSync(
        'bun',
        [
          'clawdhub',
          'update',
          slug,
          '--force',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          installWorkdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(update.status).toBe(0)

      const metaUrl = new URL(ApiRoutes.skill, registry)
      metaUrl.searchParams.set('slug', slug)
      const metaRes = await fetch(metaUrl.toString(), { headers: { Accept: 'application/json' } })
      expect(metaRes.status).toBe(200)

      const del = spawnSync(
        'bun',
        [
          'clawdhub',
          'delete',
          slug,
          '--yes',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(del.status).toBe(0)

      const metaAfterDelete = await fetch(metaUrl.toString(), {
        headers: { Accept: 'application/json' },
      })
      expect(metaAfterDelete.status).toBe(404)

      const downloadAfterDelete = await fetch(downloadUrl.toString())
      expect(downloadAfterDelete.status).toBe(404)

      const undelete = spawnSync(
        'bun',
        [
          'clawdhub',
          'undelete',
          slug,
          '--yes',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      expect(undelete.status).toBe(0)

      const metaAfterUndelete = await fetch(metaUrl.toString(), {
        headers: { Accept: 'application/json' },
      })
      expect(metaAfterUndelete.status).toBe(200)
    } finally {
      const cleanup = spawnSync(
        'bun',
        [
          'clawdhub',
          'delete',
          slug,
          '--yes',
          '--site',
          site,
          '--registry',
          registry,
          '--workdir',
          workdir,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, CLAWDHUB_CONFIG_PATH: cfg.path, CLAWDHUB_DISABLE_TELEMETRY: '1' },
          encoding: 'utf8',
        },
      )
      if (cleanup.status !== 0) {
        // best-effort cleanup
      }
      await rm(workdir, { recursive: true, force: true })
      await rm(installWorkdir, { recursive: true, force: true })
      await rm(cfg.dir, { recursive: true, force: true })
    }
  }, 180_000)
})
