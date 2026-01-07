type SkillMetaSource = {
  slug: string
  owner?: string | null
  displayName?: string | null
  summary?: string | null
}

type SkillMeta = {
  title: string
  description: string
  image: string
  url: string
  owner: string | null
}

const DEFAULT_SITE = 'https://clawdhub.com'
const DEFAULT_DESCRIPTION = 'ClawdHub — a fast skill registry for agents, with vector search.'

export function getSiteUrl() {
  return import.meta.env.VITE_SITE_URL ?? DEFAULT_SITE
}

export function getApiBase() {
  return import.meta.env.VITE_CONVEX_SITE_URL ?? getSiteUrl()
}

export async function fetchSkillMeta(slug: string) {
  try {
    const apiBase = getApiBase()
    const url = new URL('/api/skill', apiBase)
    url.searchParams.set('slug', slug)
    const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (!response.ok) return null
    const payload = (await response.json()) as {
      skill?: { displayName?: string; summary?: string | null }
      owner?: { handle?: string | null }
    }
    return {
      displayName: payload.skill?.displayName ?? null,
      summary: payload.skill?.summary ?? null,
      owner: payload.owner?.handle ?? null,
    }
  } catch {
    return null
  }
}

export function buildSkillMeta(source: SkillMetaSource): SkillMeta {
  const siteUrl = getSiteUrl()
  const owner = clean(source.owner)
  const displayName = clean(source.displayName) || clean(source.slug)
  const summary = clean(source.summary)
  const title = `${displayName} — ClawdHub`
  const description =
    summary || (owner ? `Agent skill by @${owner} on ClawdHub.` : DEFAULT_DESCRIPTION)
  const url = owner ? `${siteUrl}/${owner}/${source.slug}` : `${siteUrl}/skills/${source.slug}`
  return {
    title,
    description: truncate(description, 200),
    image: `${siteUrl}/og.png`,
    url,
    owner: owner || null,
  }
}

function clean(value?: string | null) {
  return value?.trim() ?? ''
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}…`
}
