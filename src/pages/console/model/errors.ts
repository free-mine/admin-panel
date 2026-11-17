import { ApiError } from '../../../shared/api'
import type { PublicError } from '../../../shared/api'

const messages: Record<string, string> = {
  INVALID_PIN: 'Неверный PIN-код.',
  SHIFT_NOT_FOUND: 'Смена не найдена.',
  AUTH_REQUIRED: 'Войдите в панель заново.',
  AAVE_NO_DEBT: 'По этому токену нет долга.',
  IDENTICAL_TOKENS: 'Выберите разные токены.',
  CONTRACT_REVERT: 'Контракт отклонил операцию.',
  INVALID_REQUEST: 'Проверьте параметры операции.',
  QUEUE_FULL: 'Очередь заполнена. Повторите позже.',
  TIMESTAMP_NOT_FUTURE: 'Дата должна быть в будущем.',
  POOL_NOT_INITIALIZED: 'Пул ещё не инициализирован.',
  DOMAIN_NOT_ALLOWED: 'Доступ с этого домена запрещён.',
  SHIFT_ALREADY_FUNDED: 'Эта смена уже профинансирована.',
  LFJ_NO_ROUTE: 'Для этой суммы не найден маршрут обмена.',
  POSITION_NOT_OWNED: 'Эта позиция не принадлежит OreVein.',
  PLAN_EXPIRED: 'Срок плана истёк. Новые шаги не отправлены.',
  SERVICE_NOT_READY: 'Сервер пока не готов выполнять операции.',
  INSUFFICIENT_TOKEN_BALANCE: 'Недостаточно средств у OreVein.',
  TRANSACTION_REVERTED: 'Транзакция завершилась ошибкой в сети.',
  NO_CLOSED_SHIFT: 'Пока нет закрытой смены для финансирования.',
  INITIAL_PRICE_REQUIRED: 'Для нового пула укажите начальную цену.',
  AUTH_RATE_LIMITED: 'Слишком много попыток входа. Повторите позже.',
  GAS_BUDGET_EXCEEDED: 'Комиссия превышает установленный лимит газа.',
  TIMESTAMP_NOT_LATER: 'Новая дата должна быть позже уже назначенной.',
  PREVIEW_EXPIRED: 'Срок плана истёк. Подготовьте и проверьте новый план.',
  INVALID_RESPONSE: 'Сервер вернул неожиданный ответ. Проверьте адрес API.',
  OWNER_MISMATCH: 'Ключ сервера не принадлежит текущему владельцу OreVein.',
  PREVIEW_NOT_FOUND: 'План отсутствует на сервере. Подготовьте его заново.',
  INITIAL_PRICE_RANGE: 'Начальная цена выходит за допустимый диапазон пула.',
  INSUFFICIENT_GAS_BALANCE: 'У владельца недостаточно AVAX для оплаты газа.',
  INVALID_INITIAL_PRICE:
    'Укажите положительную начальную цену токена B за 1 A.',
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
  JOURNAL_WRITE_FAILED:
    'Не удалось сохранить журнал операций. Проверьте состояние сервера.',
  JOURNAL_CONFLICT:
    'Записи журнала операций конфликтуют. Проверьте локальный журнал сервера.',
  RANGE_REQUIRES_BOTH_ASSETS:
    'Для создания позиции укажите положительные суммы обоих активов.',
  JOURNAL_NETWORK_MISMATCH:
    'Журнал операций относится к другой сети. Проверьте настройки сервера.',
  JOURNAL_OWNER_MISMATCH:
    'Журнал операций относится к другому владельцу. Проверьте настройки сервера.',
  READ_ONLY:
    'Сервер работает только для чтения. Для выполнения операций нужен ключ владельца на сервере.',
  INVALID_BOUNDARY_PERCENT:
    'Укажите расстояние до границ больше 0 и меньше 100%, до 6 знаков после точки.',
  RANGE_NOT_AVAILABLE:
    'Для этой цены и расстояния до границ нельзя подобрать диапазон. Измените параметры.',
  RANGE_AMOUNTS_INCOMPATIBLE:
    'Не удалось подобрать диапазон с использованием не менее 99% каждого актива. Измените суммы или расстояние до границ.',
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
