import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { Analytics } from '@vercel/analytics/react'
import { AppProviders } from '../components/AppProviders'
import { ClientOnly } from '../components/ClientOnly'
import { Footer } from '../components/Footer'
import Header from '../components/Header'
import { getSiteUrl } from '../lib/og'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => {
    const siteUrl = getSiteUrl()
    const ogImage = `${siteUrl}/og.png`

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: 'ClawdHub',
        },
        {
          name: 'description',
          content: 'ClawdHub — a fast skill registry for agents, with vector search.',
        },
        {
          property: 'og:site_name',
          content: 'ClawdHub',
        },
        {
          property: 'og:type',
          content: 'website',
        },
        {
          property: 'og:title',
          content: 'ClawdHub',
        },
        {
          property: 'og:description',
          content: 'ClawdHub — a fast skill registry for agents, with vector search.',
        },
        {
          property: 'og:image',
          content: ogImage,
        },
        {
          property: 'og:image:width',
          content: '1200',
        },
        {
          property: 'og:image:height',
          content: '630',
        },
        {
          property: 'og:image:alt',
          content: 'ClawdHub — a fast skill registry for agents, with vector search.',
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          name: 'twitter:title',
          content: 'ClawdHub',
        },
        {
          name: 'twitter:description',
          content: 'ClawdHub — a fast skill registry for agents, with vector search.',
        },
        {
          name: 'twitter:image',
          content: ogImage,
        },
        {
          name: 'twitter:image:alt',
          content: 'ClawdHub — a fast skill registry for agents, with vector search.',
        },
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
      ],
    }
  },

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClientOnly>
          <AppProviders>
            <div className="app-shell">
              <Header />
              {children}
              <Footer />
            </div>
            <Analytics />
            {import.meta.env.DEV ? (
              <TanStackDevtools
                config={{
                  position: 'bottom-right',
                }}
                plugins={[
                  {
                    name: 'Tanstack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
            ) : null}
          </AppProviders>
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  )
}
