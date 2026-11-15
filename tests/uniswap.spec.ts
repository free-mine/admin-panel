import { test, expect } from '@playwright/test'

import { config, mockApi } from './fixture'
import type { PositionPage } from '../src/pages/console/api/types'
import type { ActionDraft } from '../src/pages/console/model/types'
import {
  initialValues,
  validateAction,
} from '../src/pages/console/model/actions'

const mint: ActionDraft = { kind: 'uniswap.mint' }
const mintValues = {
  ...initialValues(mint),
  tokenB: 'USDT',
  tokenA: 'WAVAX',
  amountB: '27.5',
  minBoundaryPercent: '10',
  amountA: '1.234567890123456789',
}

test('mint sends exact asset budgets and a percentage without obsolete tick parameters', () => {
  const result = validateAction(
    mint,
    {
      ...mintValues,
      range: 'custom',
      tickUpper: '60',
      tickLower: '-60',
      initialPrice: '25.123456789012345678',
    },
    config,
  )
  expect(result.errors).toEqual({})
  expect(result.action).toEqual({
    kind: 'uniswap.mint',
    params: {
      fee: 3000,
      tokenB: 'USDT',
      slippageBps: 50,
      tokenA: 'WAVAX',
      amountB: '27.5',
      minBoundaryPercent: '10',
      amountA: '1.234567890123456789',
      initialPrice: '25.123456789012345678',
    },
  })
})

test('mint percentage accepts only server-supported precision and open bounds', () => {
  for (const minBoundaryPercent of [
    '0.000001',
    '1',
    '10.123456',
    '99.999999',
  ]) {
    const result = validateAction(
      mint,
      { ...mintValues, minBoundaryPercent },
      config,
    )
    expect(result.errors, minBoundaryPercent).toEqual({})
    expect(result.action.params.minBoundaryPercent).toBe(minBoundaryPercent)
  }
  for (const minBoundaryPercent of [
    '',
    '0',
    '0.000000',
    '100',
    '-1',
    '1e1',
    '1,5',
    '01',
    '0.0000001',
    '99.9999999',
  ]) {
    expect(
      validateAction(mint, { ...mintValues, minBoundaryPercent }, config)
        .errors,
      minBoundaryPercent,
    ).toHaveProperty('minBoundaryPercent')
  }
})

test('mint requires both assets and validates amounts with each token precision', () => {
  for (const [key, value] of [
    ['amountA', '0'],
    ['amountB', '0'],
    ['amountA', '1.0000000000000000001'],
    ['amountB', '1.0000001'],
  ]) {
    expect(
      validateAction(mint, { ...mintValues, [key]: value }, config).errors,
      `${key}=${value}`,
    ).toHaveProperty(key)
  }
  expect(
    validateAction(mint, { ...mintValues, tokenB: 'WAVAX' }, config).errors,
  ).toHaveProperty('tokenB')
})

test('initial pool prices retain sub-1e-18 precision and reject invalid decimals', () => {
  const initialPrice = '0.000000000000000000001'
  const result = validateAction(mint, { ...mintValues, initialPrice }, config)
  expect(result.errors).toEqual({})
  expect(result.action.params.initialPrice).toBe(initialPrice)
  for (const value of ['0', '0.000', '-1', '01', '1e-18', '1,25']) {
    expect(
      validateAction(mint, { ...mintValues, initialPrice: value }, config)
        .errors,
      value,
    ).toHaveProperty('initialPrice')
  }
})

test('mint form previews a price range and formatted nested amounts in selected asset order', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/#capital')
  await page.getByRole('button', { exact: true, name: 'Uniswap' }).click()
  await page
    .getByRole('button', { exact: true, name: 'Создать позицию' })
    .click()
  for (const key of ['range', 'tickLower', 'tickUpper']) {
    await expect(page.locator(`#field-${key}`)).toHaveCount(0)
  }
  await page.locator('#field-tokenA').selectOption('WAVAX')
  await page.locator('#field-tokenB').selectOption('USDT')
  await page.locator('#field-amountA').fill(mintValues.amountA)
  await page.locator('#field-amountB').fill(mintValues.amountB)
  await page.locator('#field-minBoundaryPercent').fill('100')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(page.locator('#field-minBoundaryPercent')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(state.previews).toHaveLength(0)
  await page.locator('#field-minBoundaryPercent').fill('10')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByRole('heading', { name: 'Расчёт сервера' }),
  ).toBeVisible()
  expect(state.previews[0]).toEqual({
    maxGasAvax: '0.005',
    action: {
      kind: 'uniswap.mint',
      params: {
        fee: 3000,
        tokenB: 'USDT',
        slippageBps: 50,
        tokenA: 'WAVAX',
        amountB: '27.5',
        minBoundaryPercent: '10',
        amountA: '1.234567890123456789',
      },
    },
  })
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('1,234567890123456789 WAVAX')
  await expect(dialog).toContainText('27,5 USDT')
  await expect(dialog).toContainText('22,5')
  await expect(dialog).toContainText('99,5%')
  await expect(dialog).not.toContainText('"budgetA"')
  await expect(dialog).not.toContainText('"lowerPrice"')
  expect(state.submissions).toHaveLength(0)
  await expect(
    page.getByRole('button', { name: 'Подтвердить и выполнить' }),
  ).toBeDisabled()
})

test('position assets and human prices keep increase amounts in contract order', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/#capital')
  await page.getByRole('button', { exact: true, name: 'Uniswap' }).click()
  await expect(
    page.getByRole('heading', { name: 'USDT / WAVAX' }),
  ).toBeVisible()
  await expect(page.getByText('Начислено USDT', { exact: true })).toBeVisible()
  await expect(page.getByText('Начислено WAVAX', { exact: true })).toBeVisible()
  await expect(page.getByText('Диапазон тиков', { exact: true })).toHaveCount(0)
  await expect(page.locator('main')).toContainText('0,036')
  await expect(page.locator('main')).toContainText('0,0448')
  await page.getByRole('button', { exact: true, name: 'Добавить' }).click()
  await page.locator('#field-amount0').fill('1.0000001')
  await page.locator('#field-amount1').fill('0.000000000000000001')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(page.locator('#field-amount0')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(state.previews).toHaveLength(0)
  await page.locator('#field-amount0').fill('0')
  await page.getByRole('button', { name: 'Проверить операцию' }).click()
  await expect(
    page.getByRole('heading', { name: 'Расчёт сервера' }),
  ).toBeVisible()
  expect(state.previews[0].action).toEqual({
    kind: 'uniswap.increase',
    params: {
      amount0: '0',
      tokenId: '123',
      slippageBps: 50,
      amount1: '0.000000000000000001',
    },
  })
})

test('out-of-range empty positions render nullable distances and allow burning', async ({
  page,
}) => {
  await mockApi(page)
  const positions: PositionPage = {
    offset: 0,
    limit: 20,
    total: '1',
    positions: [
      {
        fee: 3000,
        inRange: false,
        liquidity: '0',
        tokenId: '125',
        tokensOwedA: '0',
        tokensOwedB: '0',
        currentPrice: '0.05',
        tokenA: config.tokens[0],
        tokenB: config.tokens[1],
        range: {
          lowerPrice: '0.036',
          upperPrice: '0.0448',
          lowerDistancePercent: null,
          upperDistancePercent: null,
        },
      },
    ],
  }
  await page.route('**/v1/uniswap/positions?*', route =>
    route.fulfill({ json: positions }),
  )
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#capital')
  await page.getByRole('button', { exact: true, name: 'Uniswap' }).click()
  await expect(page.getByText('NFT #125', { exact: true })).toBeVisible()
  await expect(page.getByText(/Вне диапазона/)).toBeVisible()
  await expect(
    page.getByRole('button', { exact: true, name: 'Удалить NFT' }),
  ).toBeEnabled()
  await expect(page.locator('main')).not.toContainText('null')
  await expect(page.locator('main')).not.toContainText('undefined')
  expect(errors).toEqual([])
})
