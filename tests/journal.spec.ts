import { test, expect } from '@playwright/test'

import { mockApi } from './fixture'

test('a local journal failure is visible while available history remains readable', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.operations.push({
    steps: [],
    version: 1,
    summary: {},
    status: 'succeeded',
    createdAt: 1800000000000,
    updatedAt: 1800000000000,
    expiresAt: 1800000120000,
    maxGasWei: '5000000000000000',
    gasSpentWei: '1700000000000000',
    id: '00000000-0000-4000-9000-000000000001',
    previewId: '00000000-0000-4000-8000-000000000001',
    requestId: '00000000-0000-4000-8000-000000000002',
    request: {
      maxGasAvax: '0.005',
      action: { params: {}, kind: 'fund.closeShift' },
    },
  })
  await page.route('**/v1/journal', route =>
    route.fulfill({
      json: { blocked: true, lastError: { code: 'JOURNAL_WRITE_FAILED' } },
    }),
  )
  await page.goto('/#operations')
  await expect(
    page.getByText('Исполнение остановлено из-за ошибки журнала.'),
  ).toBeVisible()
  await expect(
    page.getByText('JOURNAL_WRITE_FAILED', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { exact: true, name: 'Закрыть текущую смену' }),
  ).toBeVisible()
})
