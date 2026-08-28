import { existsSync, readFileSync } from 'node:fs'

import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

const LOCALES = ['en', 'zh-CN'] as const
const DEFAULT_LOCALE = 'en'
const PAYMENT_STATUSES = ['success', 'failed'] as const
const LOCALE_PREFIXES = LOCALES.map((locale) =>
  locale === DEFAULT_LOCALE ? '' : `/${locale}`
)
const SITEMAP_EXCLUDED_PATHNAMES = new Set([
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`)
])

// /models-v2 is an unlinked, noindex A/B-test preview — keep every slug out
// of the sitemap until it graduates or is deleted.
const SITEMAP_EXCLUDED_PREFIXES = LOCALE_PREFIXES.map(
  (prefix) => `${prefix}/models-v2`
)
const PIXAL3D_TEST_CONFIG_URL = new URL(
  './pixal3d_api.cfg.local',
  import.meta.url
)

function getPixal3dTestProxy() {
  if (!existsSync(PIXAL3D_TEST_CONFIG_URL)) return undefined

  const config = Object.fromEntries(
    readFileSync(PIXAL3D_TEST_CONFIG_URL, 'utf8')
      .split(/\r?\n/)
      .flatMap((line) => {
        const separator = line.indexOf('=')
        if (separator < 1) return []
        const name = line.slice(0, separator).trim()
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, '$2')
        return [[name, value]]
      })
  )
  const host = config.host
  const apiKey = config.api_key
  if (!host || !apiKey) {
    throw new Error('Pixal3D test config requires host and api_key')
  }

  return {
    '/pixal3d-api': {
      target: host,
      changeOrigin: true,
      followRedirects: true,
      headers: { Authorization: `Bearer ${apiKey}` },
      rewrite: (path: string) => path.replace(/^\/pixal3d-api/, '')
    }
  }
}

function isExcludedFromSitemap(page: string): boolean {
  const pathname = new URL(page).pathname.replace(/\/$/, '')
  return (
    SITEMAP_EXCLUDED_PATHNAMES.has(pathname) ||
    SITEMAP_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  prefetch: { prefetchAll: true },
  // Astro 7 changed the compressHTML default to JSX-style whitespace stripping.
  // Keep the v6 HTML-aware behavior so inline spacing across the site is unchanged.
  compressHTML: true,
  // Keep MDX punctuation verbatim; SmartyPants would turn the source's straight
  // quotes into curly ones and drift from the rest of the site's copy.
  markdown: { smartypants: false },
  redirects: {
    '/cloud/enterprise-case-studies/comfyui-at-architectural-scale-how-moment-factory-reimagined-3d-projection-mapping':
      '/customers/moment-factory/',
    '/cloud/enterprise-case-studies/how-series-entertainment-rebuilt-game-and-video-production-with-comfyui':
      '/customers/series-entertainment/',
    '/zh-CN/terms-of-service': '/terms-of-service',
    '/minimax': { status: 307, destination: '/minimax-h3/' },
    '/zh-CN/minimax': { status: 307, destination: '/zh-CN/minimax-h3/' }
  },
  build: {
    assets: '_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [
    vue(),
    mdx(),
    sitemap({
      filter: (page) => !isExcludedFromSitemap(page)
    })
  ],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: getPixal3dTestProxy(),
      watch: {
        ignored: ['**/playwright-report/**']
      }
    }
  },
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: {
      prefixDefaultLocale: false
    }
  }
})
