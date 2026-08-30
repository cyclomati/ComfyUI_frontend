import { expect } from '@playwright/test'

import { comfyPageFixture as baseTest } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    if (testInfo.tags.includes('@cloud')) {
      await mockCloudBoot(page, {
        features: {},
        settings: {
          'Comfy.Queue.QPOV2': false,
          'Comfy.RightSidePanel.ShowErrorsTab': false,
          'Comfy.TutorialCompleted': true,
          'Comfy.UseNewMenu': 'Top',
          'Comfy.VersionCompatibility.DisableWarnings': true
        }
      })
      await mockBilling(page)
    }
    await use(page)
  }
})

test.describe('Assets sidebar flag-off isolation', { tag: '@oss' }, () => {
  test.use({ initialFeatureFlags: { assets: false } })

  test('uses history without requesting the Asset API', async ({
    comfyPage,
    page
  }) => {
    const assetListRequests: string[] = []
    await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
      assetListRequests.push(route.request().url())
      await route.fulfill({
        json: { assets: [], total: 0, has_more: false }
      })
    })
    await comfyPage.assets.mockOutputHistory([
      createMockJob({ id: 'legacy-output' })
    ])
    await comfyPage.assets.mockInputFiles([])

    const tab = comfyPage.menu.assetsTab
    await tab.open({ waitForAssets: false })
    await expect(
      tab.getAssetCardByName('output_legacy-output').or(tab.emptyStateMessage)
    ).toBeVisible()

    expect(assetListRequests).toEqual([])
    await expect(tab.getAssetCardByName('output_legacy-output')).toBeVisible()
    await expect(tab.filterButton).toHaveCount(0)
  })
})

test.describe(
  'Assets sidebar flag-off isolation on Cloud',
  { tag: '@cloud' },
  () => {
    test.use({ initialFeatureFlags: { assets: false } })

    test('falls back to history without Asset API controls', async ({
      comfyPage,
      page
    }) => {
      test.fail(
        true,
        'Cloud currently enables Assets unconditionally instead of honoring the off flag'
      )

      const assetListRequests: string[] = []
      await page.route(/\/api\/assets(?:\?.*)?$/, async (route) => {
        assetListRequests.push(route.request().url())
        await route.fulfill({
          json: { assets: [], total: 0, has_more: false }
        })
      })
      await comfyPage.assets.mockOutputHistory([
        createMockJob({ id: 'legacy-output' })
      ])
      await comfyPage.assets.mockInputFiles([])

      const tab = comfyPage.menu.assetsTab
      await tab.open({ waitForAssets: false })
      await expect(
        tab.getAssetCardByName('output_legacy-output').or(tab.emptyStateMessage)
      ).toBeVisible()

      expect(assetListRequests).toEqual([])
      await expect(tab.getAssetCardByName('output_legacy-output')).toBeVisible()
      await expect(tab.filterButton).toHaveCount(0)
    })
  }
)
