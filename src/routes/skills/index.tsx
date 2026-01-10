import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'
import { SkillCard } from '../../components/SkillCard'

const sortKeys = ['newest', 'downloads', 'installs', 'stars', 'name', 'updated'] as const
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

function SkillsIndex() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const sort = search.sort ?? 'newest'
  const dir = parseDir(search.dir, sort)
  const view = search.view ?? 'list'
  const highlightedOnly = search.highlighted ?? false
  const [query, setQuery] = useState(search.q ?? '')

  const skills = useQuery(api.skills.list, { limit: 500 }) as Doc<'skills'>[] | undefined
  const isLoadingSkills = skills === undefined

  useEffect(() => {
    setQuery(search.q ?? '')
  }, [search.q])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    const all = (skills ?? []).filter((skill) =>
      highlightedOnly ? skill.batch === 'highlighted' : true,
    )
    if (!value) return all
    return all.filter((skill) => {
      if (skill.slug.toLowerCase().includes(value)) return true
      if (skill.displayName.toLowerCase().includes(value)) return true
      return (skill.summary ?? '').toLowerCase().includes(value)
    })
  }, [highlightedOnly, query, skills])

  const sorted = useMemo(() => {
    const multiplier = dir === 'asc' ? 1 : -1
    const results = [...filtered]
    results.sort((a, b) => {
      switch (sort) {
        case 'downloads':
          return (a.stats.downloads - b.stats.downloads) * multiplier
        case 'installs':
          return ((a.stats.installsAllTime ?? 0) - (b.stats.installsAllTime ?? 0)) * multiplier
        case 'stars':
          return (a.stats.stars - b.stats.stars) * multiplier
        case 'updated':
          return (a.updatedAt - b.updatedAt) * multiplier
        case 'name':
          return (
            (a.displayName.localeCompare(b.displayName) || a.slug.localeCompare(b.slug)) *
            multiplier
          )
        default:
          return (a.createdAt - b.createdAt) * multiplier
      }
    })
    return results
  }, [dir, filtered, sort])

  const showing = sorted.length
  const total = skills?.filter((skill) =>
    highlightedOnly ? skill.batch === 'highlighted' : true,
  ).length

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
              : `${showing}${typeof total === 'number' ? ` of ${total}` : ''} skills${
                  highlightedOnly ? ' (highlighted)' : ''
                }.`}
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
              value={sort}
              onChange={(event) => {
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
              aria-label="Sort skills"
            >
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
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    dir: parseDir(prev.dir, sort) === 'asc' ? 'desc' : 'asc',
                  }),
                  replace: true,
                })
              }}
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
      ) : showing === 0 ? (
        <div className="card">No skills match that filter.</div>
      ) : view === 'cards' ? (
        <div className="grid">
          {sorted.map((skill) => (
            <SkillCard
              key={skill._id}
              skill={skill}
              badge={skill.batch === 'highlighted' ? 'Highlighted' : undefined}
              summaryFallback="Agent-ready skill pack."
              meta={
                <div className="stat">
                  ⭐ {skill.stats.stars} · ⤓ {skill.stats.downloads} · ⤒{' '}
                  {skill.stats.installsAllTime ?? 0}
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <div className="skills-list">
          {sorted.map((skill) => (
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
                  {skill.batch === 'highlighted' ? <span className="tag">Highlighted</span> : null}
                </div>
                <div className="skills-row-summary">{skill.summary ?? 'No summary provided.'}</div>
              </div>
              <div className="skills-row-metrics">
                <span>⤓ {skill.stats.downloads}</span>
                <span>⤒ {skill.stats.installsAllTime ?? 0}</span>
                <span>★ {skill.stats.stars}</span>
                <span>{skill.stats.versions} v</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
