import type { Page } from '@playwright/test'
import type { Route } from '@playwright/test'
import { test, expect } from '@playwright/test'

import { fund, mockApi } from './fixture'

test('slow reads finish even when a polling tick occurs', async ({ page }) => {
  await mockApi(page)
  await page.clock.install()
  const pendingReads: Route[] = []
  await page.route('**/v1/fund', route => {
    pendingReads.push(route)
  })
  await page.goto('/')
  await expect.poll(() => pendingReads.length).toBe(1)
  const readiness = page.waitForResponse(response =>
    response.url().endsWith('/ready'),
  )
  await page.clock.fastForward(16000)
  await readiness
  await page.clock.runFor(50)
  expect(pendingReads).toHaveLength(1)
  await pendingReads[0].fulfill({ json: fund })
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeVisible()
})

test('WebSocket reconnection restores current operations and keeps confirmed receipts', async ({
  page,
}) => {
  const state = await mockApi(page)
  await funding(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Подтвердить и выполнить' }).click()
  await expect(
    page.getByRole('heading', { name: 'Исполнение по шагам' }),
  ).toBeVisible()
  await page.clock.install()
  state.disconnect()
  await expect(
    page.getByText('События недоступны', { exact: false }),
  ).toBeVisible()
  state.operations[0].status = 'needs_attention'
  state.operations[0].version++
  state.operations[0].steps.push({
    id: 1,
    code: 'EXECUTE',
    status: 'confirming',
    error: { code: 'NONCE_CONFLICT' },
  })
  await page.clock.fastForward(5500)
  await expect(
    page.getByText('Требует внимания', { exact: true }),
  ).toBeVisible()
  expect(state.connections).toBe(2)
  await expect(page.getByText('Подтверждено', { exact: true })).toBeVisible()
  await expect(page.getByText('Блок 98766', { exact: false })).toBeVisible()
  await page.getByLabel('Хэш подтверждённой замены').fill(`0x${'2'.repeat(64)}`)
  await expect(
    page.getByRole('button', { name: 'Принять подтверждённую замену' }),
  ).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Принять подтверждённую замену' })
    .click()
  await expect(page.getByText('Выполнено', { exact: true })).toBeVisible()
})

test('readiness loss blocks writes and recovers while preserving the snapshot', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.clock.install()
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeEnabled()
  state.ready = false
  await page.clock.fastForward(16000)
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeDisabled()
  await expect(page.getByText('50 000', { exact: true })).toBeVisible()
  state.ready = true
  await page.getByRole('button', { name: 'Проверить связь' }).click()
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeEnabled()
})

async function funding(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Финансировать смену' }).click()
  await page.getByLabel('Цена выхода за 1 ORE').fill('1.20')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByRole('heading', { name: 'Расчёт сервера' }),
  ).toBeVisible()
}

test('funding: exact amounts, explicit consent, receipt and gas', async ({
  page,
}) => {
  const state = await mockApi(page)
  await funding(page)
  expect(state.previews[0]).toEqual({
    maxGasAvax: '0.005',
    action: { kind: 'fund.fundShift', params: { price: '1.20' } },
  })
  expect(state.submissions).toHaveLength(0)
  await expect(page.getByRole('dialog')).toContainText('12 000 USDT')
  await expect(
    page.getByRole('button', { name: 'Подтвердить и выполнить' }),
  ).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Подтвердить и выполнить' }).dblclick()
  await expect(
    page.getByRole('heading', { name: 'Исполнение по шагам' }),
  ).toBeVisible()
  expect(state.submissions).toHaveLength(1)
  await expect(page.getByText('Фактически потрачено на газ')).toBeVisible()
  await expect(page.getByText('0,0017 AVAX', { exact: true })).toBeVisible()
})

test('a lost submission survives reload and reuses both IDs', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.loseSubmit = true
  await funding(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Подтвердить и выполнить' }).click()
  await expect(
    page.getByText('Ответ на отправку не получен.', { exact: false }),
  ).toBeVisible()
  const pair = state.submissions[0]
  await page.reload()
  await page
    .getByRole('button', { exact: true, name: 'Проверить отправку' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Исполнение по шагам' }),
  ).toBeVisible()
  expect(state.operations).toHaveLength(1)
  expect(state.submissions).toEqual([pair, pair])
})

test('expired and changed plans require another review', async ({ page }) => {
  const state = await mockApi(page)
  state.ttl = 1000
  await funding(page)
  await expect(
    page.getByText('Срок плана истёк', { exact: true }),
  ).toBeVisible()
  expect(state.submissions).toHaveLength(0)
  state.ttl = 120000
  await page.getByRole('button', { name: 'Пересоздать план' }).click()
  await expect(
    page.getByRole('button', { name: 'Подтвердить и выполнить' }),
  ).toBeDisabled()
  state.changedPlan = true
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Подтвердить и выполнить' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'PLAN_CHANGED' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Проверить операцию' }),
  ).toBeVisible()
  expect(state.operations).toHaveLength(0)
})

test('range-based claims pagination continues across empty ranges', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByText('#3', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Следующая страница' }).click()
  await expect(
    page.getByText('В этом диапазоне нет открытых заявок.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Следующая страница' }).click()
  await expect(page.getByText('#41', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Следующая страница' }),
  ).toBeDisabled()
})

test('unready server never enables actions; last balances survive read failure', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.ready = false
  await page.goto('/')
  await expect(
    page.getByRole('heading', { exact: true, name: 'Подключение' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toHaveCount(0)
  state.ready = true
  await page.getByRole('button', { exact: true, name: 'Подключиться' }).click()
  await expect(page.getByText('50 000', { exact: true })).toBeVisible()
  state.balanceError = true
  state.snapshot()
  await expect(
    page.getByText('RPC_UNAVAILABLE', { exact: false }),
  ).toBeVisible()
  await expect(page.getByText('50 000', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Последний успешный снимок', { exact: false }),
  ).toBeVisible()
})

for (const width of [390, 900, 1440]) {
  test(`responsive views and operation dialog at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 1040 })
    const state = await mockApi(page)
    await page.goto('/')
    await expect(
      page.getByRole('heading', { exact: true, name: 'Фонд' }),
    ).toBeVisible()
    await page.screenshot({
      fullPage: true,
      path: `.tmp/screenshots/fund-${width}.png`,
    })
    for (const section of [
      'capital',
      'operations',
      'successors',
      'connection',
      'fund',
    ]) {
      await page.evaluate(value => {
        window.location.hash = value
      }, section)
      await expect(page.locator('h1')).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true)
    }
    state.incompleteGas = true
    await page.getByRole('button', { name: 'Финансировать смену' }).click()
    await page.getByLabel('Цена выхода за 1 ORE').fill('1.20')
    await page.getByRole('button', { name: 'Проверить операцию' }).click()
    await expect(
      page.getByText('Известная часть комиссии', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Оценка после предыдущих шагов')).toBeVisible()
    await page.screenshot({
      fullPage: true,
      path: `.tmp/screenshots/review-${width}.png`,
    })
    expect(
      await page
        .getByRole('dialog')
        .evaluate(element => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('protocol views expose token precision, null debt and isolated position errors', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/#capital')
  await page.getByRole('button', { exact: true, name: 'Aave' }).click()
  await expect(page.getByText('Health factor: Нет долга')).toBeVisible()
  await page
    .getByRole('button', { exact: true, name: 'Вывести' })
    .first()
    .click()
  await page.getByLabel('Сумма', { exact: true }).fill('all')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByRole('heading', { name: 'Расчёт сервера' }),
  ).toBeVisible()
  expect(state.previews.at(-1)?.action).toEqual({
    kind: 'aave.withdraw',
    params: { token: 'USDT', amount: 'all' },
  })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { exact: true, name: 'Uniswap' }).click()
  await expect(
    page.getByRole('heading', { name: 'USDT / WAVAX' }),
  ).toBeVisible()
  await expect(
    page.getByText('UNSUPPORTED_TOKEN', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { exact: true, name: 'Удалить NFT' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'LFJ', exact: true }).click()
  await page.getByRole('button', { name: 'Подготовить обмен' }).click()
  await page.getByLabel('Сумма', { exact: true }).fill('0.0000001')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByText('Допустимо не более 6 знаков после точки.'),
  ).toBeVisible()
  await page.getByLabel('Сумма', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByText('Минимальный выход', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('0,0995 WAVAX')
})
