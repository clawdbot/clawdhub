export type SiteMode = 'skills' | 'souls'

const DEFAULT_CLAWDHUB_SITE_URL = 'https://clawdhub.com'
const DEFAULT_ONLYCRABS_SITE_URL = 'https://onlycrabs.ai'
const DEFAULT_ONLYCRABS_HOST = 'onlycrabs.ai'

export function getClawdHubSiteUrl() {
  return import.meta.env.VITE_SITE_URL ?? DEFAULT_CLAWDHUB_SITE_URL
}

export function getOnlyCrabsSiteUrl() {
  const explicit = import.meta.env.VITE_SOULHUB_SITE_URL
  if (explicit) return explicit

  const siteUrl = import.meta.env.VITE_SITE_URL
  if (siteUrl) {
    try {
      const url = new URL(siteUrl)
      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '0.0.0.0'
      ) {
        return url.origin
      }
    } catch {
      // ignore invalid URLs, fall through to default
    }
  }

  return DEFAULT_ONLYCRABS_SITE_URL
}

export function getOnlyCrabsHost() {
  return import.meta.env.VITE_SOULHUB_HOST ?? DEFAULT_ONLYCRABS_HOST
}

export function detectSiteMode(host?: string | null): SiteMode {
  if (!host) return 'skills'
  const onlyCrabsHost = getOnlyCrabsHost().toLowerCase()
  const lower = host.toLowerCase()
  if (lower === onlyCrabsHost || lower.endsWith(`.${onlyCrabsHost}`)) return 'souls'
  return 'skills'
}

export function detectSiteModeFromUrl(value?: string | null): SiteMode {
  if (!value) return 'skills'
  try {
    const host = new URL(value).hostname
    return detectSiteMode(host)
  } catch {
    return detectSiteMode(value)
  }
}

export function getSiteMode(): SiteMode {
  if (typeof window !== 'undefined') {
    return detectSiteMode(window.location.hostname)
  }
  const forced = import.meta.env.VITE_SITE_MODE
  if (forced === 'souls' || forced === 'skills') return forced

  const onlyCrabsSite = import.meta.env.VITE_SOULHUB_SITE_URL
  if (onlyCrabsSite) return detectSiteModeFromUrl(onlyCrabsSite)

  const siteUrl = import.meta.env.VITE_SITE_URL ?? process.env.SITE_URL
  if (siteUrl) return detectSiteModeFromUrl(siteUrl)

  return 'skills'
}

export function getSiteName(mode: SiteMode = getSiteMode()) {
  return mode === 'souls' ? 'onlycrabs.ai' : 'ClawdHub'
}

export function getSiteDescription(mode: SiteMode = getSiteMode()) {
  return mode === 'souls'
    ? 'onlycrabs.ai — the home for SOUL.md bundles and personal system lore.'
    : 'ClawdHub — a fast skill registry for agents, with vector search.'
}

export function getSiteUrlForMode(mode: SiteMode = getSiteMode()) {
  return mode === 'souls' ? getOnlyCrabsSiteUrl() : getClawdHubSiteUrl()
}
