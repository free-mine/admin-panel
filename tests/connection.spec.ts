import type { Route } from '@playwright/test'
import { test, expect } from '@playwright/test'

import { mockApi } from './fixture'

test('a slow readiness check is shared by startup and polling', async ({
  page,
}) => {
  await mockApi(page)
  await page.clock.install()
  const pending: Route[] = []
  const requests: string[] = []
  page.on('request', request => {
    requests.push(new URL(request.url()).pathname)
  })
  await page.route('**/ready', route => {
    pending.push(route)
  })

  await page.goto('/')
  await expect.poll(() => pending.length).toBe(1)
  await expect(
    page.getByRole('heading', { name: 'Подключаемся к серверу…' }),
  ).toBeVisible()
  await page.clock.fastForward(16000)
  expect(pending).toHaveLength(1)

  await pending[0].fulfill({
    json: { status: 'ready', readOnly: false },
  })
  await expect(
    page.getByRole('button', { name: 'Финансировать смену' }),
  ).toBeEnabled()
  expect(requests.filter(path => path === '/v1/config')).toHaveLength(1)
  expect(requests).not.toContain('/health')
})
