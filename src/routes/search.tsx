import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/search')({
  validateSearch: (search) => ({
    q: typeof search.q === 'string' && search.q.trim() ? search.q : undefined,
    highlighted: search.highlighted === '1' || search.highlighted === 'true' ? true : undefined,
  }),
  component: SearchRedirect,
})

function SearchRedirect() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  useEffect(() => {
    void navigate({
      to: '/',
      search: (prev) => ({
        ...prev,
        q: search.q || undefined,
        highlighted: search.highlighted ? true : undefined,
      }),
      replace: true,
    })
  }, [navigate, search.highlighted, search.q])

  return null
}
