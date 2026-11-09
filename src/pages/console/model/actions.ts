import { toUnits } from '../../../shared/lib/format'
import type { Field, ActionDraft, ActionDefinition } from './types'
import type { Fund, Action, Config, ActionKind } from '../api/types'

const token: Field = {
  key: 'token',
  kind: 'token',
  label: 'Токен',
  default: 'USDT',
}
const amount: Field = {
  key: 'amount',
  label: 'Сумма',
  kind: 'decimal',
  hint: 'В единицах выбранного токена. Десятичный разделитель — точка.',
}
const slippage: Field = {
  min: 0,
  max: 1000,
  default: '50',
  kind: 'integer',
  key: 'slippageBps',
  label: 'Допустимое проскальзывание, bps',
  hint: '50 bps = 0,5%. Допустимо от 0 до 1 000 bps (10%).',
}
const position: Field = {
  min: 1,
  key: 'tokenId',
  kind: 'integer',
  label: 'ID позиции NFT',
}
const address: Field = {
  key: 'address',
  kind: 'address',
  label: 'Адрес преемника',
  hint: 'Полный адрес 0x… в Avalanche C-Chain.',
}

export const actions: Record<ActionKind, ActionDefinition> = {
  'aave.supply': {
    title: 'Внести в Aave',
    fields: [token, amount],
    description: 'Перевести токены OreVein в резерв Aave.',
  },
  'uniswap.collect': {
    fields: [position],
    title: 'Собрать средства позиции',
    description: 'Перевести доступные начисления из позиции на OreVein.',
  },
  'successor.remove': {
    fields: [address],
    title: 'Удалить преемника',
    description:
      'Отменить назначенное право этого адреса на получение полномочий.',
  },
  'fund.changeDollar': {
    fields: [token],
    title: 'Изменить расчётный токен',
    description:
      'Выбранный токен будет использоваться для новых расчётов фонда.',
  },
  'aave.repay': {
    fields: [token, amount],
    title: 'Погасить долг Aave',
    description:
      'Использовать средства OreVein для погашения долга с переменной ставкой.',
  },
  'uniswap.burn': {
    fields: [position],
    title: 'Удалить пустой NFT',
    description:
      'NFT будет уничтожен. Сначала выведите ликвидность и соберите все начисления.',
  },
  'uniswap.close': {
    title: 'Вывести ликвидность',
    fields: [position, slippage],
    description:
      'Вывести всю ликвидность и собрать средства. NFT останется у OreVein.',
  },
  'fund.closeShift': {
    fields: [],
    title: 'Закрыть текущую смену',
    description:
      'Приём заявок продолжится в новой смене. Закрытую смену можно будет профинансировать.',
  },
  'aave.borrow': {
    title: 'Занять в Aave',
    fields: [token, amount],
    description:
      'Получить заём на OreVein по переменной ставке. Увеличение долга снижает health factor.',
  },
  'fund.fundShift': {
    title: 'Финансировать смену',
    fields: [{ key: 'price', kind: 'decimal', label: 'Цена выхода за 1 ORE' }],
    description:
      'Средства OreVein будут направлены на расчёт по заявкам последней закрытой смены.',
  },
  'fund.updateEntryPrice': {
    title: 'Обновить цену входа',
    fields: [{ key: 'price', kind: 'decimal', label: 'Новая цена за 1 ORE' }],
    description:
      'Новая цена применяется к входу в фонд. Допустимый диапазон и срок обновления задаёт контракт.',
  },
  'contract.setURI': {
    title: 'Изменить URI контракта',
    description: 'Обновление адреса метаданных OreVein.',
    fields: [
      {
        key: 'uri',
        kind: 'text',
        label: 'URI метаданных',
        hint: 'Например, ipfs://… или https://…',
      },
    ],
  },
  'fund.expireClaim': {
    title: 'Закрыть просроченную заявку',
    description: 'Закрытие доступно через 14 дней после финансирования смены.',
    fields: [
      { min: 1, key: 'shiftId', kind: 'integer', label: 'ID смены' },
      { min: 1, key: 'claimId', kind: 'integer', label: 'ID заявки' },
    ],
  },
  'aave.withdraw': {
    title: 'Вывести из Aave',
    description:
      'Вывести средства из резерва на OreVein. При наличии долга вывод ограничен обеспечением.',
    fields: [
      token,
      {
        ...amount,
        hint: 'Введите сумму или all для вывода всего доступного остатка.',
      },
    ],
  },
  'uniswap.increase': {
    title: 'Добавить ликвидность',
    description:
      'Суммы указаны в порядке token0 и token1 существующей позиции.',
    fields: [
      position,
      { ...amount, key: 'amount0', label: 'Максимум token0' },
      { ...amount, key: 'amount1', label: 'Максимум token1' },
      slippage,
    ],
  },
  'lfj.swap': {
    title: 'Обменять через LFJ',
    description:
      'Маршрут, ожидаемый и минимальный результат появятся в предварительном плане.',
    fields: [
      { ...token, key: 'tokenIn', label: 'Отдать' },
      { ...token, key: 'tokenOut', default: 'WAVAX', label: 'Получить' },
      amount,
      slippage,
    ],
  },
  'successor.schedule': {
    title: 'Назначить преемника',
    description:
      'В выбранное время адрес получит право запросить полномочия. Автоматической активации нет.',
    fields: [
      address,
      {
        key: 'timestamp',
        kind: 'datetime-local',
        label: 'Дата и время (МСК, UTC+3)',
        hint: 'При переносе дата должна быть позже ранее назначенной.',
      },
    ],
  },
  'uniswap.mint': {
    title: 'Создать позицию Uniswap',
    description: 'NFT и средства позиции будут принадлежать OreVein.',
    fields: [
      { ...token, key: 'tokenA', label: 'Токен A' },
      { ...token, key: 'tokenB', label: 'Токен B', default: 'WAVAX' },
      { ...amount, key: 'amountA', label: 'Максимум токена A' },
      { ...amount, key: 'amountB', label: 'Максимум токена B' },
      {
        key: 'fee',
        kind: 'select',
        default: '3000',
        label: 'Комиссия пула',
        options: [
          { value: '100', label: '0,01%' },
          { value: '500', label: '0,05%' },
          { value: '3000', label: '0,3%' },
          { label: '1%', value: '10000' },
        ],
      },
      {
        key: 'range',
        kind: 'select',
        default: 'full',
        label: 'Диапазон',
        options: [
          { value: 'full', label: 'Полный диапазон' },
          { value: 'custom', label: 'Задать тики' },
        ],
      },
      {
        max: 887272,
        min: -887272,
        kind: 'integer',
        key: 'tickLower',
        label: 'Нижний тик',
        hint: 'Тики задаются в порядке token0/token1 по адресам и должны соответствовать шагу пула.',
      },
      {
        max: 887272,
        min: -887272,
        kind: 'integer',
        key: 'tickUpper',
        label: 'Верхний тик',
      },
      {
        optional: true,
        kind: 'decimal',
        key: 'initialPrice',
        label: 'Начальная цена: токен B за 1 A',
        hint: 'Нужна только для ещё не инициализированного пула.',
      },
      slippage,
    ],
  },
}

export function visibleFields(
  kind: ActionKind,
  values: Record<string, string>,
) {
  return actions[kind].fields.filter(
    field =>
      !['tickLower', 'tickUpper'].includes(field.key) ||
      values.range === 'custom',
  )
}

export function initialValues(draft: ActionDraft) {
  return Object.fromEntries(
    actions[draft.kind].fields.map(field => [
      field.key,
      draft.values?.[field.key] ?? field.default ?? '',
    ]),
  )
}

export function validateAction(
  draft: ActionDraft,
  values: Record<string, string>,
  config: Config,
  fund?: Fund,
): { action: Action; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const params: Action['params'] = {}
  for (const field of visibleFields(draft.kind, values)) {
    const value = values[field.key]?.trim() ?? ''
    if (!value && field.optional) {
      continue
    }
    try {
      if (!value) {
        throw new Error('Заполните поле.')
      }
      if (field.kind === 'decimal') {
        if (
          draft.kind === 'aave.withdraw' &&
          field.key === 'amount' &&
          value === 'all'
        ) {
          params[field.key] = value
          continue
        }
        const symbol =
          field.key === 'amountA'
            ? values.tokenA
            : field.key === 'amountB'
              ? values.tokenB
              : field.key === 'amount0'
                ? draft.token0
                : field.key === 'amount1'
                  ? draft.token1
                  : (values.token ?? values.tokenIn)
        const decimals = ['price', 'initialPrice'].includes(field.key)
          ? 18
          : (config.tokens.find(item => item.symbol === symbol)?.decimals ?? 18)
        const parsed = toUnits(value, decimals)
        if (
          parsed === 0n &&
          !['amountA', 'amountB', 'amount0', 'amount1'].includes(field.key)
        ) {
          throw new Error('Значение должно быть больше нуля.')
        }
        if (field.key === 'price' && fund) {
          const entry = draft.kind === 'fund.updateEntryPrice'
          const min = BigInt(
            entry ? fund.minimumEntryPrice : fund.minimumExitPrice,
          )
          const max = BigInt(
            entry ? fund.maximumEntryPrice : fund.maximumExitPrice,
          )
          if (parsed < min || parsed > max) {
            throw new Error('Цена выходит за допустимый диапазон.')
          }
          if (entry && Date.now() < fund.nextPriceUpdateAt * 1000) {
            throw new Error('Время обновления цены ещё не наступило.')
          }
        }
      } else if (field.kind === 'integer') {
        if (!/^-?(?:0|[1-9]\d*)$/.test(value) || value.length > 78) {
          throw new Error('Введите целое число без ведущих нулей.')
        }
        const n = BigInt(value)
        if (
          n > 2n ** 256n - 1n ||
          (field.min !== undefined && n < BigInt(field.min)) ||
          (field.max !== undefined && n > BigInt(field.max))
        ) {
          throw new Error('Число вне допустимого диапазона.')
        }
      } else if (field.kind === 'address') {
        if (!/^0x[\da-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) {
          throw new Error(
            'Введите ненулевой адрес: 0x и 40 шестнадцатеричных символов.',
          )
        }
      } else if (field.kind === 'datetime-local') {
        const timestamp = new Date(`${value}:00+03:00`).getTime() / 1000
        if (
          !Number.isInteger(timestamp) ||
          timestamp <= Date.now() / 1000 ||
          timestamp > 253402300799
        ) {
          throw new Error('Выберите дату в будущем.')
        }
        params[field.key] = timestamp
        continue
      } else if (field.kind === 'token') {
        if (!config.tokens.some(item => item.symbol === value)) {
          throw new Error('Выберите поддерживаемый токен.')
        }
      } else if (
        field.kind === 'select' &&
        !field.options?.some(item => item.value === value)
      ) {
        throw new Error('Выберите значение из списка.')
      }
      if (field.key === 'uri' && value.length > 2048) {
        throw new Error('Не более 2 048 символов.')
      }
      params[field.key] = [
        'slippageBps',
        'fee',
        'tickLower',
        'tickUpper',
      ].includes(field.key)
        ? Number(value)
        : value
    } catch (cause) {
      errors[field.key] =
        cause instanceof Error ? cause.message : 'Некорректное значение.'
    }
  }
  if (values.tokenIn && values.tokenIn === values.tokenOut) {
    errors.tokenOut = 'Токены должны различаться.'
  }
  if (values.tokenA && values.tokenA === values.tokenB) {
    errors.tokenB = 'Токены должны различаться.'
  }
  if (
    values.range === 'custom' &&
    Number(values.tickLower) >= Number(values.tickUpper)
  ) {
    errors.tickUpper = 'Верхний тик должен быть больше нижнего.'
  }
  return { errors, action: { params, kind: draft.kind } }
}

export const statusLabels: Record<string, string> = {
  failed: 'Ошибка',
  pending: 'Ожидает',
  signing: 'Подпись',
  queued: 'В очереди',
  skipped: 'Пропущен',
  checking: 'Проверка',
  running: 'Выполняется',
  succeeded: 'Выполнено',
  waiting: 'Ожидание сети',
  broadcasting: 'Отправка',
  confirmed: 'Подтверждено',
  confirming: 'Подтверждение',
  needs_attention: 'Требует внимания',
}
export const stepLabels: Record<string, string> = {
  EXECUTE: 'Выполнение действия',
  ALLOWANCE_RESET: 'Сброс разрешения',
  ALLOWANCE_APPROVE: 'Разрешение на использование токена',
}
