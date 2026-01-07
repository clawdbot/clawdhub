import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSkillMeta, fetchSkillMeta } from './og'

describe('og helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds metadata with owner and summary', () => {
    const meta = buildSkillMeta({
      slug: 'weather',
      owner: 'steipete',
      displayName: 'Weather',
      summary: 'Forecasts for your area.',
    })
    expect(meta.title).toBe('Weather — ClawdHub')
    expect(meta.description).toBe('Forecasts for your area.')
    expect(meta.url).toContain('/steipete/weather')
    expect(meta.owner).toBe('steipete')
  })

  it('uses defaults when owner and summary are missing', () => {
    const meta = buildSkillMeta({ slug: 'parser' })
    expect(meta.title).toBe('parser — ClawdHub')
    expect(meta.description).toMatch(/ClawdHub — a fast skill registry/i)
    expect(meta.url).toContain('/skills/parser')
    expect(meta.owner).toBeNull()
  })

  it('truncates long descriptions', () => {
    const longSummary = 'a'.repeat(240)
    const meta = buildSkillMeta({ slug: 'long', summary: longSummary })
    expect(meta.description.length).toBe(200)
    expect(meta.description.endsWith('…')).toBe(true)
  })

  it('fetches skill metadata when response is ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        skill: { displayName: 'Weather', summary: 'Forecasts' },
        owner: { handle: 'steipete' },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await fetchSkillMeta('weather')
    expect(meta).toEqual({
      displayName: 'Weather',
      summary: 'Forecasts',
      owner: 'steipete',
    })
  })

  it('returns null when response is not ok', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false }))
    vi.stubGlobal('fetch', fetchMock)

    const meta = await fetchSkillMeta('weather')
    expect(meta).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network')
    })
    vi.stubGlobal('fetch', fetchMock)

    const meta = await fetchSkillMeta('weather')
    expect(meta).toBeNull()
  })
})
