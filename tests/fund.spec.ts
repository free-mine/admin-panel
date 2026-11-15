import { test, expect } from '@playwright/test'

import { fund, config, mockApi } from './fixture'

test('fund metrics and capital use the same balance snapshot', async ({
  page,
}) => {
  await mockApi(page)
  let snapshot = 0
  await page.route('**/v1/balances', route => {
    snapshot++
    return route.fulfill({
      json: {
        oreVeinAvax: '0',
        owner: config.owner,
        ownerAvax: String(snapshot),
        oreVein: config.addresses.oreVein,
        tokens: config.tokens.map(token => ({
          ...token,
          balance: String(BigInt(snapshot) * 10n ** BigInt(token.decimals)),
        })),
      },
    })
  })
  await page.goto('/')
  const capital = page.locator('.console__asset .console__amount-value').first()
  const gas = page
    .locator('.console__metrics > div')
    .filter({ hasText: 'Газ владельца' })
    .locator('.console__amount-value')
  await expect(capital).toBeVisible()
  await expect(gas).toHaveText(await capital.innerText())
})

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

test('changing a shift clears the previous error before the next response', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/v1/fund/shifts/41', route =>
    route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND' } },
    }),
  )
  const response = Promise.withResolvers<void>()
  await page.route('**/v1/fund/shifts/40', async route => {
    await response.promise
    await route.fallback()
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'ID смены' }).fill('41')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  const error = page.getByRole('alert').filter({ hasText: 'NOT_FOUND' })
  await expect(error).toBeVisible()

  await page.getByRole('textbox', { name: 'ID смены' }).fill('40')
  await page.getByRole('button', { exact: true, name: 'Показать' }).click()
  await expect(error).toHaveCount(0)
  await expect(
    page.getByRole('status').filter({ hasText: 'Загрузка данных…' }),
  ).toBeVisible()

  response.resolve()
  await expect(
    page.getByText('Смена #40 · Ожидает финансирования', { exact: true }),
  ).toBeVisible()
})
