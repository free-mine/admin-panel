import { test, expect } from '@playwright/test'

import { mockApi } from './fixture'
import type { Synchronization } from '../src/pages/console/api/types'

function synchronized(): Synchronization {
  return {
    journal: {
      pending: 0,
      blocked: false,
      connected: true,
      historyLoaded: true,
    },
    state: {
      available: true,
      lastError: null,
      requiredBlock: null,
      snapshotBlock: 98765,
      refreshPending: false,
      lastCheckedAt: Date.now(),
    },
  }
}

test('incomplete remote history is distinct from an empty synchronized journal', async ({
  page,
}) => {
  await mockApi(page)
  const synchronization = synchronized()
  synchronization.journal.connected = false
  synchronization.journal.historyLoaded = false
  await page.route('**/v1/sync', route =>
    route.fulfill({ json: synchronization }),
  )
  await page.goto('/#operations')
  await expect(
    page.getByText('Полная история ещё не загружена', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Нет связи с журналом на публичном сервере.'),
  ).toBeVisible()
  await expect(
    page.getByText('В доступной истории операций нет.'),
  ).toBeVisible()
  await expect(
    page.getByText('Операций пока нет.', { exact: true }),
  ).toHaveCount(0)

  synchronization.journal.connected = true
  synchronization.journal.historyLoaded = true
  await page.getByRole('button', { exact: true, name: 'Обновить' }).click()
  await expect(page.getByText('Синхронизация журнала')).toHaveCount(0)
  await expect(
    page.getByText('Операций пока нет.', { exact: false }),
  ).toBeVisible()
})

test('pending and blocked journal states preserve available operations when sync status fails', async ({
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
  const synchronization = synchronized()
  synchronization.journal.pending = 2
  synchronization.journal.blocked = true
  synchronization.journal.lastError = { code: 'JOURNAL_CONFLICT' }
  let failed = false
  await page.route('**/v1/sync', route =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: { code: 'PUBLIC_SERVER_UNAVAILABLE' } },
        })
      : route.fulfill({ json: synchronization }),
  )
  await page.goto('/#operations')
  await expect(
    page.getByText('Ожидают сохранения на публичном сервере: 2.'),
  ).toBeVisible()
  await expect(
    page.getByText('Исполнение остановлено из-за ошибки журнала.'),
  ).toBeVisible()
  const operation = page.getByRole('button', {
    exact: true,
    name: 'Закрыть текущую смену',
  })
  await expect(operation).toBeVisible()

  failed = true
  await page.getByRole('button', { exact: true, name: 'Обновить' }).click()
  await expect(
    page.getByText('PUBLIC_SERVER_UNAVAILABLE', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Последний успешный снимок', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Ожидают сохранения на публичном сервере: 2.'),
  ).toBeVisible()
  await expect(operation).toBeVisible()
})
