import { createFileRoute, Link } from '@tanstack/react-router'
import { useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { InstallSwitcher } from '../components/InstallSwitcher'
import { SkillCard } from '../components/SkillCard'

export const Route = createFileRoute('/')({
  validateSearch: (search) => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
    highlighted: search.highlighted === '1' || search.highlighted === 'true' ? true : undefined,
  }),
  component: Home,
})

function Home() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const searchSkills = useAction(api.search.searchSkills)
  const highlighted =
    (useQuery(api.skills.list, { batch: 'highlighted', limit: 6 }) as Doc<'skills'>[]) ?? []
  const latest = (useQuery(api.skills.list, { limit: 12 }) as Doc<'skills'>[]) ?? []
  const [query, setQuery] = useState(search.q ?? '')
  const [highlightedOnly, setHighlightedOnly] = useState(search.highlighted ?? false)
  const [results, setResults] = useState<
    Array<{ skill: Doc<'skills'>; version: Doc<'skillVersions'> | null; score: number }>
  >([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchMode, setSearchMode] = useState(Boolean(search.q || search.highlighted))
  const searchRequest = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const trimmedQuery = useMemo(() => query.trim(), [query])
  const hasQuery = trimmedQuery.length > 0

  useEffect(() => {
    setQuery(search.q ?? '')
    setHighlightedOnly(search.highlighted ?? false)
    if (search.q || search.highlighted) {
      setSearchMode(true)
    }
  }, [search.highlighted, search.q])

  useEffect(() => {
    void navigate({
      search: () => ({
        q: trimmedQuery || undefined,
        highlighted: highlightedOnly ? true : undefined,
      }),
      replace: true,
    })
  }, [highlightedOnly, navigate, trimmedQuery])

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([])
      setIsSearching(false)
      return
    }
    searchRequest.current += 1
    const requestId = searchRequest.current
    setIsSearching(true)
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const data = (await searchSkills({ query: trimmedQuery, highlightedOnly })) as Array<{
            skill: Doc<'skills'>
            version: Doc<'skillVersions'> | null
            score: number
          }>
          if (requestId === searchRequest.current) {
            setResults(data)
          }
        } finally {
          if (requestId === searchRequest.current) {
            setIsSearching(false)
          }
        }
      })()
    }, 220)
    return () => window.clearTimeout(handle)
  }, [highlightedOnly, searchSkills, trimmedQuery])

  return (
    <main>
      <section className={`hero${searchMode ? ' search-mode' : ''}`}>
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">Lobster-light. Agent-right.</span>
            <h1 className="hero-title">ClawdHub, the skill dock for sharp agents.</h1>
            <p className="hero-subtitle">
              Upload AgentSkills bundles, version them like npm, and make them searchable with
              vectors. No gatekeeping, just signal.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <Link to="/upload" className="btn btn-primary">
                Publish a skill
              </Link>
              <Link to="/search" search={{ q: undefined, highlighted: undefined }} className="btn">
                Explore search
              </Link>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <form
              className="search-bar"
              onSubmit={(event) => {
                event.preventDefault()
                if (!searchMode) setSearchMode(true)
                inputRef.current?.focus()
              }}
            >
              <span className="mono">/</span>
              <input
                ref={inputRef}
                className="search-input"
                placeholder="Search skills, tags, or capabilities"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setSearchMode(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !trimmedQuery) {
                    setSearchMode(false)
                    inputRef.current?.blur()
                  }
                }}
              />
              <button
                className="search-filter-button"
                type="button"
                aria-pressed={highlightedOnly}
                onClick={() => {
                  setHighlightedOnly((value) => !value)
                  setSearchMode(true)
                }}
              >
                Highlighted
              </button>
            </form>
            {!searchMode ? (
              <div className="hero-install" style={{ marginTop: 18 }}>
                <div className="stat">Search skills. Versioned, rollback-ready.</div>
                <InstallSwitcher exampleSlug="sonoscli" />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {searchMode ? (
        <section className="section">
          <h2 className="section-title">Search results</h2>
          <p className="section-subtitle">
            {isSearching ? 'Searching now.' : 'Instant results as you type.'}
          </p>
          <div className="grid">
            {!hasQuery ? (
              <div className="card">Start typing to search.</div>
            ) : results.length === 0 ? (
              <div className="card">No results yet. Try a different prompt.</div>
            ) : (
              results.map((result) => (
                <Link
                  key={result.skill._id}
                  to="/skills/$slug"
                  params={{ slug: result.skill.slug }}
                  className="card"
                >
                  <div className="tag">Score {(result.score ?? 0).toFixed(2)}</div>
                  <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                    {result.skill.displayName}
                  </h3>
                  <p className="section-subtitle" style={{ margin: 0 }}>
                    {result.skill.summary ?? 'Skill pack'}
                  </p>
                  {result.skill.batch === 'highlighted' ? (
                    <div className="tag">Highlighted</div>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <h2 className="section-title">Highlighted batch</h2>
            <p className="section-subtitle">Curated signal — highlighted for quick trust.</p>
            <div className="grid">
              {highlighted.length === 0 ? (
                <div className="card">No highlighted skills yet.</div>
              ) : (
                highlighted.map((skill) => (
                  <SkillCard
                    key={skill._id}
                    skill={skill}
                    badge="Highlighted"
                    summaryFallback="A fresh skill bundle."
                    meta={
                      <div className="stat">
                        ⭐ {skill.stats.stars} · ⤓ {skill.stats.downloads} · ⤒{' '}
                        {skill.stats.installsAllTime ?? 0}
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Latest drops</h2>
            <p className="section-subtitle">Newest uploads across the registry.</p>
            <div className="grid">
              {latest.length === 0 ? (
                <div className="card">No skills yet. Be the first.</div>
              ) : (
                latest.map((skill) => (
                  <SkillCard
                    key={skill._id}
                    skill={skill}
                    summaryFallback="Agent-ready skill pack."
                    meta={
                      <div className="stat">
                        {skill.stats.versions} versions · ⤓ {skill.stats.downloads} · ⤒{' '}
                        {skill.stats.installsAllTime ?? 0}
                      </div>
                    }
                  />
                ))
              )}
            </div>
            <div className="section-cta">
              <Link
                to="/skills"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: undefined,
                  view: undefined,
                }}
                className="btn"
              >
                See all skills
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
