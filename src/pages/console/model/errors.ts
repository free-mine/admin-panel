import { ApiError } from '../../../shared/api'
import type { PublicError } from '../../../shared/api'

const messages: Record<string, string> = {
  SHIFT_NOT_FOUND: 'Смена не найдена.',
  AAVE_NO_DEBT: 'По этому токену нет долга.',
  IDENTICAL_TOKENS: 'Выберите разные токены.',
  CONTRACT_REVERT: 'Контракт отклонил операцию.',
  INVALID_REQUEST: 'Проверьте параметры операции.',
  QUEUE_FULL: 'Очередь заполнена. Повторите позже.',
  TIMESTAMP_NOT_FUTURE: 'Дата должна быть в будущем.',
  SHIFT_ALREADY_FUNDED: 'Эта смена уже профинансирована.',
  LFJ_NO_ROUTE: 'Для этой суммы не найден маршрут обмена.',
  POSITION_NOT_OWNED: 'Эта позиция не принадлежит OreVein.',
  PLAN_EXPIRED: 'Срок плана истёк. Новые шаги не отправлены.',
  SERVICE_NOT_READY: 'Сервер пока не готов выполнять операции.',
  INSUFFICIENT_TOKEN_BALANCE: 'Недостаточно средств у OreVein.',
  TRANSACTION_REVERTED: 'Транзакция завершилась ошибкой в сети.',
  NO_CLOSED_SHIFT: 'Пока нет закрытой смены для финансирования.',
  INITIAL_PRICE_REQUIRED: 'Для нового пула укажите начальную цену.',
  GAS_BUDGET_EXCEEDED: 'Комиссия превышает установленный лимит газа.',
  TIMESTAMP_NOT_LATER: 'Новая дата должна быть позже уже назначенной.',
  PREVIEW_EXPIRED: 'Срок плана истёк. Подготовьте и проверьте новый план.',
  INVALID_RESPONSE: 'Сервер вернул неожиданный ответ. Проверьте адрес API.',
  OWNER_MISMATCH: 'Ключ сервера не принадлежит текущему владельцу OreVein.',
  PREVIEW_NOT_FOUND: 'План отсутствует на сервере. Подготовьте его заново.',
  INSUFFICIENT_GAS_BALANCE: 'У владельца недостаточно AVAX для оплаты газа.',
  POSITION_NOT_EMPTY:
    'Сначала выведите ликвидность и соберите средства из NFT.',
  CONNECTION_LOST:
    'Нет ответа от сервера. Проверьте подключение и повторите запрос.',
  JOURNAL_UNAVAILABLE:
    'Журнал операций недоступен. Исполнение остановлено сервером.',
  WRONG_NETWORK:
    'Сервер подключён к другой сети. Требуется Avalanche C-Chain (43114).',
  PLAN_CHANGED:
    'Состояние изменилось. Подготовьте новый план и проверьте его ещё раз.',
  ORIGIN_NOT_ALLOWED:
    'Адрес этой страницы не разрешён сервером. Добавьте его в ALLOWED_ORIGINS.',
}

export function publicError(error: PublicError) {
  const message = messages[error.code] ?? 'Сервер отклонил запрос.'
  return `${message} (${error.code}${error.reason ? `: ${error.reason}` : ''})${error.fields?.length ? ` Поля: ${error.fields.join(', ')}` : ''}`
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? publicError(error.detail)
    : error instanceof Error
      ? error.message
      : 'Не удалось выполнить запрос.'
}
