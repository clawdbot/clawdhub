import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { defineEventHandler, getQuery, getRequestHost, setHeader } from 'h3'

import type { SoulOgMeta } from '../../og/fetchSoulOgMeta'
import { fetchSoulOgMeta } from '../../og/fetchSoulOgMeta'
import {
  FONT_MONO,
  FONT_SANS,
  getFontBuffers,
  getMarkDataUrl,
  getResvgWasm,
} from '../../og/ogAssets'
import { buildSoulOgSvg } from '../../og/soulOgSvg'

type OgQuery = {
  slug?: string
  owner?: string
  version?: string
  title?: string
  description?: string
  v?: string
}

let wasmInitPromise: Promise<void> | null = null

function cleanString(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function getApiBase(eventHost: string | null) {
  const direct = process.env.VITE_CONVEX_SITE_URL?.trim()
  if (direct) return direct

  const site = process.env.SITE_URL?.trim() || process.env.VITE_SITE_URL?.trim()
  if (site) return site

  if (eventHost) return `https://${eventHost}`
  return 'https://onlycrabs.ai'
}

async function ensureWasm() {
  if (!wasmInitPromise) {
    wasmInitPromise = getResvgWasm().then((wasm) => initWasm(wasm))
  }
  await wasmInitPromise
}

function buildFooter(host: string | null, slug: string, owner: string | null) {
  const base = host ? host : 'onlycrabs.ai'
  if (owner) return `${base}/@${owner}/${slug}`
  return `${base}/souls/${slug}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as OgQuery
  const slug = cleanString(query.slug)
  if (!slug) {
    setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return 'Missing `slug` query param.'
  }

  const ownerFromQuery = cleanString(query.owner)
  const versionFromQuery = cleanString(query.version)
  const titleFromQuery = cleanString(query.title)
  const descriptionFromQuery = cleanString(query.description)

  const needFetch = !titleFromQuery || !descriptionFromQuery || !ownerFromQuery || !versionFromQuery
  const meta: SoulOgMeta | null = needFetch
    ? await fetchSoulOgMeta(slug, getApiBase(getRequestHost(event)))
    : null

  const owner = ownerFromQuery || meta?.owner || ''
  const version = versionFromQuery || meta?.version || ''
  const title = titleFromQuery || meta?.displayName || slug
  const description = descriptionFromQuery || meta?.summary || ''

  const ownerLabel = owner ? `@${owner}` : 'onlycrabs.ai'
  const versionLabel = version ? `v${version}` : 'latest'
  const footer = buildFooter(getRequestHost(event), slug, owner || null)

  const cacheKey = version ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
  setHeader(event, 'Cache-Control', cacheKey)
  setHeader(event, 'Content-Type', 'image/png')

  const [markDataUrl, fontBuffers] = await Promise.all([
    getMarkDataUrl(),
    ensureWasm().then(() => getFontBuffers()),
  ])

  const svg = buildSoulOgSvg({
    markDataUrl,
    title,
    description,
    ownerLabel,
    versionLabel,
    footer,
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontBuffers,
      defaultFontFamily: FONT_SANS,
      sansSerifFamily: FONT_SANS,
      monospaceFamily: FONT_MONO,
    },
  })
  const png = resvg.render().asPng()
  resvg.free()
  return png
})
