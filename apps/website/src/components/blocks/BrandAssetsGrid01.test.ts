// @vitest-environment happy-dom

import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'

import BrandAssetsGrid01 from './BrandAssetsGrid01.vue'

it('renders the subheading through the safe rich text boundary', () => {
  render(BrandAssetsGrid01, {
    props: {
      heading: 'Brand assets',
      subheading:
        '<strong>Download <a href="/terms">approved assets</a></strong><script>alert(1)</script>',
      cta: { label: 'Download all', href: '/download' },
      assets: []
    }
  })

  const link = screen.getByRole('link', { name: 'approved assets' })
  expect(link.getAttribute('href')).toBe('/terms')
  expect(screen.queryByText('alert(1)', { ignore: false })).toBeNull()
})
