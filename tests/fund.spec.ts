import { test, expect } from '@playwright/test'

import { fund, mockApi } from './fixture'

test('selecting a shift keeps the last closed shift separate from its claims', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  const last = page.locator('.console__callout')
  const selected = page
    .locator('p.console__subtle')
    .filter({ hasText: /^Смена #/ })
  await expect(last).toContainText('Смена #42')
  await expect(selected).toContainText('Смена #42 · Ожидает финансирования')

  await page.getByRole('textbox', { name: 'ID смены' }).fill('41')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  await expect(selected).toContainText('Смена #41 · Профинансирована')
  await expect(last).toContainText('Смена #42')
  await expect(
    last.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeEnabled()

  await page.getByRole('textbox', { name: 'ID смены' }).fill('42')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  await expect(selected).toContainText('Смена #42 · Ожидает финансирования')
})

test('the first shift shows its claims without a closed shift', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/v1/fund', route =>
    route.fulfill({ json: { ...fund, currentShiftId: '1' } }),
  )
  await page.route('**/v1/fund/shifts/1', route =>
    route.fulfill({
      json: {
        id: '1',
        price: '0',
        fundedAt: 0,
        block: 98765,
        closed: false,
        funded: false,
        oreAmount: '0',
        dollar: fund.dollar,
        currentClaimId: '3',
        expireAvailableAt: null,
        dollarScale: '1000000000000',
      },
    }),
  )
  await page.goto('/')
  await expect(page.getByText('Закрытых смен пока нет.')).toBeVisible()
  await expect(
    page.getByText('Смена #1 · Открыта', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('#3', { exact: true })).toBeVisible()
})

test('a delayed failure from the previous shift cannot replace the selected shift', async ({
  page,
}) => {
  await mockApi(page)
  const response = Promise.withResolvers<void>()
  await page.route('**/v1/fund/shifts/41', async route => {
    await response.promise
    await route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND' } },
    })
  })
  await page.goto('/')
  const previousRequest = page.waitForRequest('**/v1/fund/shifts/41')
  await page.getByRole('textbox', { name: 'ID смены' }).fill('41')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  await previousRequest
  await page.getByRole('textbox', { name: 'ID смены' }).fill('40')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  const selected = page.getByText('Смена #40 · Ожидает финансирования', {
    exact: true,
  })
  await expect(selected).toBeVisible()

  const previousResponse = page.waitForResponse('**/v1/fund/shifts/41')
  response.resolve()
  await previousResponse
  await expect(selected).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
