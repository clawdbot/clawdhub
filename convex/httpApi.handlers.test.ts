/* @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/apiTokenAuth', () => ({
  requireApiTokenUser: vi.fn(),
}))

vi.mock('./skills', () => ({
  publishVersionForUser: vi.fn(),
}))

const { requireApiTokenUser } = await import('./lib/apiTokenAuth')
const { publishVersionForUser } = await import('./skills')
const { __handlers } = await import('./httpApi')
const { hashSkillFiles } = await import('./lib/skills')

function makeCtx(partial: Record<string, unknown>) {
  return partial as unknown as import('./_generated/server').ActionCtx
}

describe('httpApi handlers', () => {
  afterEach(() => {
    vi.mocked(requireApiTokenUser).mockReset()
    vi.mocked(publishVersionForUser).mockReset()
  })

  it('searchSkillsHttp returns empty results for empty query', async () => {
    const response = await __handlers.searchSkillsHandler(
      makeCtx({ runAction: vi.fn() }),
      new Request('https://example.com/api/search?q=%20%20'),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ results: [] })
  })

  it('searchSkillsHttp forwards args', async () => {
    const runAction = vi.fn().mockResolvedValue([
      {
        score: 1,
        skill: { slug: 'a', displayName: 'A', summary: null, updatedAt: 1 },
        version: null,
      },
    ])
    const response = await __handlers.searchSkillsHandler(
      makeCtx({ runAction }),
      new Request('https://example.com/api/search?q=test&approvedOnly=true&limit=5'),
    )
    expect(runAction).toHaveBeenCalledWith(expect.anything(), {
      query: 'test',
      limit: 5,
      approvedOnly: true,
    })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.results[0].slug).toBe('a')
  })

  it('getSkillHttp validates slug', async () => {
    const response = await __handlers.getSkillHandler(
      makeCtx({ runQuery: vi.fn() }),
      new Request('https://example.com/api/skill'),
    )
    expect(response.status).toBe(400)
  })

  it('getSkillHttp returns 404 when missing', async () => {
    const runQuery = vi.fn().mockResolvedValue(null)
    const response = await __handlers.getSkillHandler(
      makeCtx({ runQuery }),
      new Request('https://example.com/api/skill?slug=missing'),
    )
    expect(response.status).toBe(404)
  })

  it('getSkillHttp returns payload with owner and latestVersion', async () => {
    const runQuery = vi.fn().mockResolvedValue({
      skill: {
        slug: 'demo',
        displayName: 'Demo',
        summary: 'x',
        tags: {},
        stats: {
          downloads: 0,
          installsCurrent: 0,
          installsAllTime: 0,
          stars: 0,
          versions: 1,
          comments: 0,
        },
        createdAt: 1,
        updatedAt: 2,
      },
      latestVersion: { version: '1.0.0', createdAt: 3, changelog: 'c' },
      owner: { handle: 'p', displayName: 'Peter', image: null },
    })
    const response = await __handlers.getSkillHandler(
      makeCtx({ runQuery }),
      new Request('https://example.com/api/skill?slug=demo'),
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.skill.slug).toBe('demo')
    expect(json.latestVersion.version).toBe('1.0.0')
    expect(json.owner.handle).toBe('p')
  })

  it('resolveSkillVersionHttp validates hash', async () => {
    const response = await __handlers.resolveSkillVersionHandler(
      makeCtx({ runQuery: vi.fn() }),
      new Request('https://example.com/api/skill/resolve?slug=demo&hash=bad'),
    )
    expect(response.status).toBe(400)
  })

  it('resolveSkillVersionHttp returns 404 when missing', async () => {
    const runQuery = vi.fn().mockResolvedValue(null)
    const response = await __handlers.resolveSkillVersionHandler(
      makeCtx({ runQuery }),
      new Request(
        'https://example.com/api/skill/resolve?slug=missing&hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    )
    expect(response.status).toBe(404)
  })

  it('resolveSkillVersionHttp returns match and latestVersion', async () => {
    const matchHash = await hashSkillFiles([{ path: 'SKILL.md', sha256: 'abc' }])
    const runQuery = vi.fn().mockResolvedValueOnce({
      match: { version: '1.0.0' },
      latestVersion: { version: '2.0.0' },
    })

    const response = await __handlers.resolveSkillVersionHandler(
      makeCtx({ runQuery }),
      new Request(`https://example.com/api/skill/resolve?slug=demo&hash=${matchHash}`),
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.match.version).toBe('1.0.0')
    expect(json.latestVersion.version).toBe('2.0.0')
  })

  it('cliWhoamiHttp returns 401 on auth failure', async () => {
    vi.mocked(requireApiTokenUser).mockRejectedValueOnce(new Error('Unauthorized'))
    const response = await __handlers.cliWhoamiHandler(
      makeCtx({}),
      new Request('https://x/api/cli/whoami'),
    )
    expect(response.status).toBe(401)
  })

  it('cliWhoamiHttp returns user payload on success', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({
      user: { handle: 'p', displayName: 'Peter', image: 'x' },
    } as never)
    const response = await __handlers.cliWhoamiHandler(
      makeCtx({}),
      new Request('https://x/api/cli/whoami'),
    )
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.user.handle).toBe('p')
  })

  it('cliTelemetrySyncHttp forwards roots and returns ok', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'users:1' } as never)
    const runMutation = vi.fn().mockResolvedValue(null)
    const response = await __handlers.cliTelemetrySyncHandler(
      makeCtx({ runMutation }),
      new Request('https://x/api/cli/telemetry/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roots: [
            {
              rootId: 'abc',
              label: '~/skills',
              skills: [{ slug: 'weather', version: null }],
            },
          ],
        }),
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })

  it('cliUploadUrlHttp returns uploadUrl', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    const runMutation = vi.fn().mockResolvedValue('https://upload.local')
    const response = await __handlers.cliUploadUrlHandler(
      makeCtx({ runMutation }),
      new Request('https://x/api/cli/upload-url', { method: 'POST' }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ uploadUrl: 'https://upload.local' })
  })

  it('cliUploadUrlHttp returns 401 when unauthorized', async () => {
    vi.mocked(requireApiTokenUser).mockRejectedValueOnce(new Error('Unauthorized'))
    const response = await __handlers.cliUploadUrlHandler(
      makeCtx({}),
      new Request('https://x/api/cli/upload-url', { method: 'POST' }),
    )
    expect(response.status).toBe(401)
  })

  it('cliPublishHttp returns 400 on invalid json', async () => {
    const request = new Request('https://x/api/cli/publish', { method: 'POST', body: '{' })
    const response = await __handlers.cliPublishHandler(makeCtx({}), request)
    expect(response.status).toBe(400)
  })

  it('cliPublishHttp returns 401 when unauthorized', async () => {
    vi.mocked(requireApiTokenUser).mockRejectedValueOnce(new Error('Unauthorized'))
    const request = new Request('https://x/api/cli/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await __handlers.cliPublishHandler(makeCtx({}), request)
    expect(response.status).toBe(401)
  })

  it('cliPublishHttp returns 400 on publish error', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    vi.mocked(publishVersionForUser).mockRejectedValueOnce(new Error('Nope'))
    const request = new Request('https://x/api/cli/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'cool-skill',
        displayName: 'Cool Skill',
        version: '1.2.3',
        changelog: 'c',
        files: [{ path: 'SKILL.md', size: 1, storageId: 'id', sha256: 'a' }],
      }),
    })
    const response = await __handlers.cliPublishHandler(makeCtx({}), request)
    expect(response.status).toBe(400)
  })

  it('cliPublishHttp returns 200 on success', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    vi.mocked(publishVersionForUser).mockResolvedValueOnce({
      skillId: 's',
      versionId: 'v',
      embeddingId: 'e',
    } as never)
    const request = new Request('https://x/api/cli/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'cool-skill',
        displayName: 'Cool Skill',
        version: '1.2.3',
        changelog: 'c',
        files: [{ path: 'SKILL.md', size: 1, storageId: 'id', sha256: 'a' }],
      }),
    })
    const response = await __handlers.cliPublishHandler(makeCtx({}), request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.skillId).toBe('s')
  })

  it('cliSkillDeleteHandler returns 401 when unauthorized', async () => {
    vi.mocked(requireApiTokenUser).mockRejectedValueOnce(new Error('Unauthorized'))
    const request = new Request('https://x/api/cli/skill/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'demo' }),
    })
    const response = await __handlers.cliSkillDeleteHandler(makeCtx({}), request, true)
    expect(response.status).toBe(401)
  })

  it('cliSkillDeleteHandler calls mutation and returns ok', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    const runMutation = vi.fn().mockResolvedValue({ ok: true })
    const request = new Request('https://x/api/cli/skill/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'demo' }),
    })
    const response = await __handlers.cliSkillDeleteHandler(makeCtx({ runMutation }), request, true)
    expect(response.status).toBe(200)
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user1',
      slug: 'demo',
      deleted: true,
    })
    expect(await response.json()).toEqual({ ok: true })
  })

  it('cliSkillDeleteHandler supports undelete', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    const runMutation = vi.fn().mockResolvedValue({ ok: true })
    const request = new Request('https://x/api/cli/skill/undelete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'demo' }),
    })
    const response = await __handlers.cliSkillDeleteHandler(
      makeCtx({ runMutation }),
      request,
      false,
    )
    expect(response.status).toBe(200)
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user1',
      slug: 'demo',
      deleted: false,
    })
  })

  it('cliSkillDeleteHandler returns 400 on invalid json', async () => {
    const request = new Request('https://x/api/cli/skill/delete', { method: 'POST', body: '{' })
    const response = await __handlers.cliSkillDeleteHandler(makeCtx({}), request, true)
    expect(response.status).toBe(400)
  })

  it('cliSkillDeleteHandler returns 400 on invalid payload', async () => {
    vi.mocked(requireApiTokenUser).mockResolvedValueOnce({ userId: 'user1' } as never)
    const request = new Request('https://x/api/cli/skill/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await __handlers.cliSkillDeleteHandler(makeCtx({}), request, true)
    expect(response.status).toBe(400)
  })
})
