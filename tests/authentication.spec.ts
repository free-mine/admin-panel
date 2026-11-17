import { test, expect } from '@playwright/test'

import { mockApi } from './fixture'

test('PIN gates data, preserves leading zeros, survives reload and logs out', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.authenticated = false
  const paths: string[] = []
  page.on('request', request => paths.push(new URL(request.url()).pathname))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
  expect(paths).not.toContain('/v1/config')
  expect(paths).not.toContain('/v1/fund')
  expect(state.connections).toBe(0)

  await page.getByLabel('PIN-код').fill('1111')
  await page.getByRole('button', { exact: true, name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toContainText('Неверный PIN-код.')
  await expect(page.getByLabel('PIN-код')).toHaveValue('')
  await page.route('**/v1/session', route =>
    route.fulfill({
      status: 429,
      json: { error: { code: 'AUTH_RATE_LIMITED' } },
    }),
  )
  await page.getByLabel('PIN-код').fill('012345')
  await page.getByRole('button', { exact: true, name: 'Войти' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Слишком много попыток входа.',
  )
  await page.unroute('**/v1/session')
  await page.getByLabel('PIN-код').fill('012345')
  await page.getByRole('button', { exact: true, name: 'Войти' }).click()
  await expect(
    page.getByRole('heading', { exact: true, name: 'Фонд' }),
  ).toBeVisible()
  expect(state.loginPins).toEqual(['1111', '012345'])
  expect(
    await page.evaluate(() =>
      Object.values(localStorage)
        .concat(Object.values(sessionStorage))
        .join(' '),
    ),
  ).not.toContain('012345')

  await page.reload()
  await expect(
    page.getByRole('heading', { exact: true, name: 'Фонд' }),
  ).toBeVisible()
  await page.getByRole('button', { exact: true, name: 'Выйти' }).click()
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { exact: true, name: 'Фонд' }),
  ).toHaveCount(0)
  expect(state.authenticated).toBe(false)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
})

test('WebSocket session expiry returns to login before the polling interval', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { exact: true, name: 'Фонд' }),
  ).toBeVisible()
  state.authenticated = false
  state.disconnect(1008, 'AUTH_REQUIRED')
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('a failed session check preserves the open draft until the server confirms logout', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Финансировать смену' }).click()
  await page.getByLabel('Цена выхода за 1 ORE').fill('1.20')

  await page.route('**/v1/session', route => route.abort('failed'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  const error = page
    .getByRole('alert')
    .filter({ hasText: 'Нет ответа от сервера.' })
  await expect(error).toBeAttached()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Цена выхода за 1 ORE')).toHaveValue('1.20')

  await page.unroute('**/v1/session')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(error).toHaveCount(0)
  await expect(page.getByLabel('Цена выхода за 1 ORE')).toHaveValue('1.20')

  state.authenticated = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a session check denied by the domain policy clears the workspace', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByRole('navigation')).toBeVisible()
  await page.route('**/v1/session', route =>
    route.fulfill({
      status: 403,
      json: { error: { code: 'DOMAIN_NOT_ALLOWED' } },
    }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(
    page.getByRole('heading', { name: 'Вход в панель' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(
    'Доступ с этого домена запрещён.',
  )
  await expect(page.getByRole('navigation')).toHaveCount(0)
})
