import { test, expect } from '@playwright/test'

import { config, mockApi } from './fixture'

test('balances truncate to eight places and copy exact decimal strings', async ({
  page,
  context,
}) => {
  const state = await mockApi(page)
  let balanceError = false
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.route('**/v1/balances', route =>
    balanceError
      ? route.fulfill({
          status: 500,
          json: { error: { code: 'RPC_UNAVAILABLE' } },
        })
      : route.fulfill({
          json: {
            owner: config.owner,
            oreVein: config.addresses.oreVein,
            ownerAvax: '1.676104945769894255',
            oreVeinAvax: '0.000000000000000001',
            tokens: config.tokens.map((token, index) => ({
              ...token,
              balance: ['9007199254740993000001', '5729406298416890', '0', '1'][
                index
              ],
            })),
          },
        }),
  )
  await page.goto('/#capital')
  const assets = page.locator('.console__asset')
  await expect(assets.nth(0).locator('.console__amount-value')).toHaveText(
    '9\u00a0007\u00a0199\u00a0254\u00a0740\u00a0993,000001',
  )
  await expect(assets.nth(1).locator('.console__amount-value')).toHaveText(
    '0,00572940',
  )
  await expect(assets.nth(2).locator('.console__amount-value')).toHaveText('0')
  await expect(assets.nth(3).locator('.console__amount-value')).toHaveText(
    '0,00000001',
  )
  for (const value of [
    '0.00572940629841689',
    '9007199254740993.000001',
    '0',
    '0.00000001',
    '1.676104945769894255',
    '0.000000000000000001',
  ]) {
    await page
      .getByRole('button', {
        exact: true,
        name: `Скопировать точную сумму ${value}`,
      })
      .click()
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(value)
  }
  const address = assets.nth(1).getByRole('button', {
    exact: true,
    name: `Скопировать ${config.tokens[1].address}`,
  })
  await address.click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(config.tokens[1].address)
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 1040 })
    const value = assets.nth(1).locator('.console__amount-value')
    expect(
      await value.evaluate(
        element =>
          element.getBoundingClientRect().height <=
          Number.parseFloat(getComputedStyle(element).lineHeight) + 1,
      ),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      fullPage: true,
      path: `.tmp/screenshots/balances-${width}.png`,
    })
  }
  await page.evaluate(() => {
    window.location.hash = 'fund'
  })
  const gas = page
    .locator('.console__metrics > div')
    .filter({ hasText: 'Газ владельца' })
  await expect(gas.locator('.console__amount-value')).toHaveText('1,67610494')
  await gas
    .getByRole('button', {
      name: 'Скопировать точную сумму 1.676104945769894255',
    })
    .click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('1.676104945769894255')
  balanceError = true
  state.snapshot()
  await expect(gas).toContainText('Не удалось обновить баланс газа')
  await expect(gas.locator('.console__amount-value')).toHaveText('1,67610494')
  await page.screenshot({
    fullPage: true,
    path: '.tmp/screenshots/fund-gas.png',
  })
})

test('clipboard failure exposes the full amount for manual copying', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/#capital')
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('denied')),
    })
  })
  await page
    .getByRole('button', { exact: true, name: 'Скопировать точную сумму 84.6' })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Скопируйте вручную: 84.6' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { exact: true, name: 'Скопировано' }),
  ).toHaveCount(0)
})
