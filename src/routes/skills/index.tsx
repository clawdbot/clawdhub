import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SkillCard } from '../../components/SkillCard'

const sortKeys = ['newest', 'downloads', 'installs', 'stars', 'name', 'updated'] as const
const pageSize = 50
type SortKey = (typeof sortKeys)[number]
type SortDir = 'asc' | 'desc'

function parseSort(value: unknown): SortKey {
  if (typeof value !== 'string') return 'newest'
  if ((sortKeys as readonly string[]).includes(value)) return value as SortKey
  return 'newest'
}

function parseDir(value: unknown, sort: SortKey): SortDir {
  if (value === 'asc' || value === 'desc') return value
  return sort === 'name' ? 'asc' : 'desc'
}

export const Route = createFileRoute('/skills/')({
  validateSearch: (search) => {
    return {
      q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
      sort: typeof search.sort === 'string' ? parseSort(search.sort) : undefined,
      dir: search.dir === 'asc' || search.dir === 'desc' ? search.dir : undefined,
      highlighted: search.highlighted === '1' || search.highlighted === 'true' ? true : undefined,
      view: search.view === 'cards' || search.view === 'list' ? search.view : undefined,
    }
  },
  component: SkillsIndex,
})

export function SkillsIndex() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const sort = search.sort ?? 'newest'
  const dir = parseDir(search.dir, sort)
  const view = search.view ?? 'list'
  const highlightedOnly = search.highlighted ?? false
  const [query, setQuery] = useState(search.q ?? '')
  const searchSkills = useAction(api.search.searchSkills)
  const [pages, setPages] = useState<
    Array<{ skill: Doc<'skills'>; latestVersion: Doc<'skillVersions'> | null }>
  >([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<
    Array<{ skill: Doc<'skills'>; version: Doc<'skillVersions'> | null; score: number }>
  >([])
  const [searchLimit, setSearchLimit] = useState(pageSize)
  const [isSearching, setIsSearching] = useState(false)
  const searchRequest = useRef(0)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const trimmedQuery = useMemo(() => query.trim(), [query])
  const hasQuery = trimmedQuery.length > 0
  const searchKey = trimmedQuery ? `${trimmedQuery}::${highlightedOnly ? '1' : '0'}` : ''

  const listPage = useQuery(
    api.skills.listPublicPage,
    hasQuery ? 'skip' : { cursor: cursor ?? undefined, limit: pageSize },
  ) as
    | {
        items: Array<{ skill: Doc<'skills'>; latestVersion: Doc<'skillVersions'> | null }>
        nextCursor: string | null
      }
    | undefined
  const isLoadingList = !hasQuery && pages.length === 0 && listPage === undefined

  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  useEffect(() => {
    if (hasQuery) return
    setPages([])
    setCursor(null)
    setNextCursor(null)
  }, [hasQuery])

  useEffect(() => {
    if (hasQuery || !listPage) return
    setNextCursor(listPage.nextCursor)
    setPages((prev) => (cursor ? [...prev, ...listPage.items] : listPage.items))
  }, [cursor, hasQuery, listPage])

  useEffect(() => {
    if (!searchKey) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setSearchResults([])
    setSearchLimit(pageSize)
  }, [searchKey])

  useEffect(() => {
    if (!hasQuery) return
    searchRequest.current += 1
    const requestId = searchRequest.current
    setIsSearching(true)
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const data = (await searchSkills({
            query: trimmedQuery,
            highlightedOnly,
            limit: searchLimit,
          })) as Array<{
            skill: Doc<'skills'>
            version: Doc<'skillVersions'> | null
            score: number
          }>
          if (requestId === searchRequest.current) {
            setSearchResults(data)
          }
        } finally {
          if (requestId === searchRequest.current) {
            setIsSearching(false)
          }
        }
      })()
    }, 220)
    return () => window.clearTimeout(handle)
  }, [hasQuery, highlightedOnly, searchLimit, searchSkills, trimmedQuery])

  const baseItems = useMemo(() => {
    if (hasQuery) {
      return searchResults.map((entry) => ({
        skill: entry.skill,
        latestVersion: entry.version,
      }))
    }
    return pages
  }, [hasQuery, pages, searchResults])

  const filtered = useMemo(
    () =>
      baseItems.filter((entry) => (highlightedOnly ? entry.skill.batch === 'highlighted' : true)),
    [baseItems, highlightedOnly],
  )

  const sorted = useMemo(() => {
    if (hasQuery) return filtered
    const multiplier = dir === 'asc' ? 1 : -1
    const results = [...filtered]
    results.sort((a, b) => {
      switch (sort) {
        case 'downloads':
          return (a.skill.stats.downloads - b.skill.stats.downloads) * multiplier
        case 'installs':
          return (
            ((a.skill.stats.installsAllTime ?? 0) - (b.skill.stats.installsAllTime ?? 0)) *
            multiplier
          )
        case 'stars':
          return (a.skill.stats.stars - b.skill.stats.stars) * multiplier
        case 'updated':
          return (a.skill.updatedAt - b.skill.updatedAt) * multiplier
        case 'name':
          return (
            (a.skill.displayName.localeCompare(b.skill.displayName) ||
              a.skill.slug.localeCompare(b.skill.slug)) * multiplier
          )
        default:
          return (a.skill.createdAt - b.skill.createdAt) * multiplier
      }
    })
    return results
  }, [dir, filtered, hasQuery, sort])

  const isLoadingSkills = hasQuery ? isSearching && searchResults.length === 0 : isLoadingList
  const canLoadMore = hasQuery
    ? !isSearching && searchResults.length === searchLimit && searchResults.length > 0
    : nextCursor !== null
  const isLoadingMore = hasQuery
    ? isSearching && searchResults.length > 0
    : listPage === undefined && pages.length > 0
  const canAutoLoad = typeof IntersectionObserver !== 'undefined'

  const loadMore = useCallback(() => {
    if (isLoadingMore || !canLoadMore) return
    if (hasQuery) {
      setSearchLimit((value) => value + pageSize)
    } else if (nextCursor) {
      setCursor(nextCursor)
    }
  }, [canLoadMore, hasQuery, isLoadingMore, nextCursor])

  useEffect(() => {
    if (!canLoadMore || typeof IntersectionObserver === 'undefined') return
    const target = loadMoreRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [canLoadMore, loadMore])

  return (
    <main className="section">
      <header className="skills-header">
        <div>
          <h1 className="section-title" style={{ marginBottom: 8 }}>
            Skills
          </h1>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            {isLoadingSkills
              ? 'Loading skills…'
              : `Browse the skill library${highlightedOnly ? ' (highlighted)' : ''}.`}
          </p>
        </div>
        <div className="skills-toolbar">
          <div className="skills-search">
            <input
              className="skills-search-input"
              value={query}
              onChange={(event) => {
                const next = event.target.value
                const trimmed = next.trim()
                setQuery(next)
                void navigate({
                  search: (prev) => ({ ...prev, q: trimmed ? next : undefined }),
                  replace: true,
                })
              }}
              placeholder="Filter by name, slug, or summary…"
            />
          </div>
          <div className="skills-toolbar-row">
            <button
              className={`search-filter-button${highlightedOnly ? ' is-active' : ''}`}
              type="button"
              aria-pressed={highlightedOnly}
              onClick={() => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    highlighted: highlightedOnly ? undefined : true,
                  }),
                  replace: true,
                })
              }}
            >
              Highlighted
            </button>
            <select
              className="skills-sort"
              value={hasQuery ? 'relevance' : sort}
              onChange={(event) => {
                if (hasQuery) return
                const sort = parseSort(event.target.value)
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    sort,
                    dir: parseDir(prev.dir, sort),
                  }),
                  replace: true,
                })
              }}
              aria-label={hasQuery ? 'Sorted by relevance' : 'Sort skills'}
              disabled={hasQuery}
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="updated">Recently updated</option>
              <option value="downloads">Downloads</option>
              <option value="installs">Installs</option>
              <option value="stars">Stars</option>
              <option value="name">Name</option>
            </select>
            <button
              className="skills-dir"
              type="button"
              aria-label={`Sort direction ${dir}`}
              onClick={() => {
                if (hasQuery) return
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    dir: parseDir(prev.dir, sort) === 'asc' ? 'desc' : 'asc',
                  }),
                  replace: true,
                })
              }}
              disabled={hasQuery}
            >
              {dir === 'asc' ? '↑' : '↓'}
            </button>
            <button
              className={`skills-view${view === 'cards' ? ' is-active' : ''}`}
              type="button"
              onClick={() => {
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    view: prev.view === 'cards' ? undefined : 'cards',
                  }),
                  replace: true,
                })
              }}
            >
              {view === 'cards' ? 'List' : 'Cards'}
            </button>
          </div>
        </div>
      </header>

      {isLoadingSkills ? (
        <div className="card">
          <div className="loading-indicator">Loading skills…</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card">No skills match that filter.</div>
      ) : view === 'cards' ? (
        <div className="grid">
          {sorted.map((entry) => {
            const skill = entry.skill
            const isPlugin = Boolean(entry.latestVersion?.parsed?.clawdis?.nix?.plugin)
            return (
              <SkillCard
                key={skill._id}
                skill={skill}
                badge={skill.batch === 'highlighted' ? 'Highlighted' : undefined}
                chip={isPlugin ? 'Plugin bundle (nix)' : undefined}
                summaryFallback="Agent-ready skill pack."
                meta={
                  <div className="stat">
                    ⭐ {skill.stats.stars} · ⤓ {skill.stats.downloads} · ⤒{' '}
                    {skill.stats.installsAllTime ?? 0}
                  </div>
                }
              />
            )
          })}
        </div>
      ) : (
        <div className="skills-list">
          {sorted.map((entry) => {
            const skill = entry.skill
            const isPlugin = Boolean(entry.latestVersion?.parsed?.clawdis?.nix?.plugin)
            return (
              <Link
                key={skill._id}
                className="skills-row"
                to="/skills/$slug"
                params={{ slug: skill.slug }}
              >
                <div className="skills-row-main">
                  <div className="skills-row-title">
                    <span>{skill.displayName}</span>
                    <span className="skills-row-slug">/{skill.slug}</span>
                    {skill.batch === 'highlighted' ? (
                      <span className="tag">Highlighted</span>
                    ) : null}
                    {isPlugin ? (
                      <span className="tag tag-accent tag-compact">Plugin bundle (nix)</span>
                    ) : null}
                  </div>
                  <div className="skills-row-summary">
                    {skill.summary ?? 'No summary provided.'}
                  </div>
                  {isPlugin ? (
                    <div className="skills-row-meta">
                      Bundle includes SKILL.md, CLI, and config.
                    </div>
                  ) : null}
                </div>
                <div className="skills-row-metrics">
                  <span>⤓ {skill.stats.downloads}</span>
                  <span>⤒ {skill.stats.installsAllTime ?? 0}</span>
                  <span>★ {skill.stats.stars}</span>
                  <span>{skill.stats.versions} v</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {canLoadMore ? (
        <div
          ref={canAutoLoad ? loadMoreRef : null}
          className="card"
          style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}
        >
          {canAutoLoad ? (
            isLoadingMore ? (
              'Loading more…'
            ) : (
              'Scroll to load more'
            )
          ) : (
            <button className="btn" type="button" onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      ) : null}
    </main>
  )
}
