import type { PendingSubmission } from './types'

const key = 'free-mine.pending-operation'

export function readPending(): PendingSubmission | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
    if (
      typeof value?.endpoint === 'string' &&
      uuid.test(value?.previewId) &&
      uuid.test(value?.requestId)
    ) {
      return value as PendingSubmission
    }
  } catch {
    /* Storage may be disabled. */
  }
}

export function savePending(value: PendingSubmission | undefined) {
  if (value) {
    const existing = readPending()
    if (existing && existing.requestId !== value.requestId) {
      throw new Error(
        'В другой вкладке уже отправляется операция. Сначала проверьте её результат.',
      )
    }
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (cause) {
      throw new Error(
        'Не удалось сохранить идентификатор отправки. Разрешите локальное хранилище браузера и повторите попытку.',
        { cause },
      )
    }
  } else {
    try {
      localStorage.removeItem(key)
    } catch {
      /* A retained pair can safely be checked again after reload. */
    }
  }
}
