import { useAuthActions } from '@convex-dev/auth/react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth, useQuery } from 'convex/react'
import { Menu, Monitor, Moon, Sun } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { api } from '../../convex/_generated/api'
import { gravatarUrl } from '../lib/gravatar'
import { getClawdHubSiteUrl, getOnlyCrabsSiteUrl, getSiteMode, getSiteName } from '../lib/site'
import { applyTheme, useThemeMode } from '../lib/theme'
import { startThemeTransition } from '../lib/theme-transition'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

export default function Header() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const me = useQuery(api.users.me)
  const { mode, setMode } = useThemeMode()
  const toggleRef = useRef<HTMLDivElement | null>(null)
  const siteMode = getSiteMode()
  const siteName = useMemo(() => getSiteName(siteMode), [siteMode])
  const isSoulMode = siteMode === 'souls'
  const onlyCrabsUrl = getOnlyCrabsSiteUrl()
  const clawdHubUrl = getClawdHubSiteUrl()

  const avatar = me?.image ?? (me?.email ? gravatarUrl(me.email) : undefined)
  const handle = me?.handle ?? me?.displayName ?? 'user'
  const initial = (me?.displayName ?? me?.name ?? handle).charAt(0).toUpperCase()
  const isModerator = me?.role === 'admin' || me?.role === 'moderator'

  const setTheme = (next: 'system' | 'light' | 'dark') => {
    startThemeTransition({
      nextTheme: next,
      currentTheme: mode,
      setTheme: (value) => {
        const nextMode = value as 'system' | 'light' | 'dark'
        applyTheme(nextMode)
        setMode(nextMode)
      },
      context: { element: toggleRef.current },
    })
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" search={{ q: undefined, highlighted: undefined }} className="brand">
          <span className="brand-mark">
            <img src="/clawd-logo.png" alt="" aria-hidden="true" />
          </span>
          <span className="brand-name">{siteName}</span>
        </Link>
        <nav className="nav-links">
          {isSoulMode ? (
            <a href={clawdHubUrl}>ClawdHub</a>
          ) : (
            <a href={onlyCrabsUrl}>onlycrabs.ai</a>
          )}
          <Link
            to={isSoulMode ? '/souls' : '/skills'}
            search={
              isSoulMode
                ? undefined
                : {
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    highlighted: undefined,
                    view: undefined,
                  }
            }
          >
            {isSoulMode ? 'Souls' : 'Skills'}
          </Link>
          <Link to="/upload" search={{ updateSlug: undefined }}>
            Upload
          </Link>
          {isSoulMode ? null : <Link to="/import">Import</Link>}
          <Link to="/search" search={{ q: undefined, highlighted: undefined }}>
            Search
          </Link>
          {me ? <Link to="/stars">Stars</Link> : null}
          {isModerator ? <Link to="/admin">Admin</Link> : null}
        </nav>
        <div className="nav-actions">
          <div className="nav-mobile">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-mobile-trigger" type="button" aria-label="Open menu">
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  {isSoulMode ? (
                    <a href={clawdHubUrl}>ClawdHub</a>
                  ) : (
                    <a href={onlyCrabsUrl}>onlycrabs.ai</a>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to={isSoulMode ? '/souls' : '/skills'}
                    search={
                      isSoulMode
                        ? undefined
                        : {
                            q: undefined,
                            sort: undefined,
                            dir: undefined,
                            highlighted: undefined,
                            view: undefined,
                          }
                    }
                  >
                    {isSoulMode ? 'Souls' : 'Skills'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/upload" search={{ updateSlug: undefined }}>
                    Upload
                  </Link>
                </DropdownMenuItem>
                {isSoulMode ? null : (
                  <DropdownMenuItem asChild>
                    <Link to="/import">Import</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/search" search={{ q: undefined, highlighted: undefined }}>
                    Search
                  </Link>
                </DropdownMenuItem>
                {me ? (
                  <DropdownMenuItem asChild>
                    <Link to="/stars">Stars</Link>
                  </DropdownMenuItem>
                ) : null}
                {isModerator ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Admin</Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                  System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  Dark
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="theme-toggle">
            <ToggleGroup
              ref={toggleRef}
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (!value) return
                setTheme(value as 'system' | 'light' | 'dark')
              }}
              aria-label="Theme mode"
            >
              <ToggleGroupItem value="system" aria-label="System theme">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">System</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="Light theme">
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Light</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Dark</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {isAuthenticated && me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="user-trigger" type="button">
                  {avatar ? (
                    <img src={avatar} alt={me.displayName ?? me.name ?? 'User avatar'} />
                  ) : (
                    <span className="user-menu-fallback">{initial}</span>
                  )}
                  <span className="mono">@{handle}</span>
                  <span className="user-menu-chevron">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={isLoading}
              onClick={() => void signIn('github')}
            >
              <span className="sign-in-label">Sign in</span>
              <span className="sign-in-provider">with GitHub</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
