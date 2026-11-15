import { For, Show } from 'solid-js'

import { Address } from './primitives'
import { actions } from '../model/actions'
import type { Config, Approval, PreviewRequest } from '../api/types'
import { units, decimal, dateTime } from '../../../shared/lib/format'

const labels: Record<string, string> = {
  token: 'Токен',
  amount: 'Сумма',
  shiftId: 'Смена',
  address: 'Адрес',
  route: 'Маршрут',
  claimId: 'Заявка',
  tokenIn: 'Отдать',
  token0: 'Токен 0',
  token1: 'Токен 1',
  tokenA: 'Токен A',
  tokenB: 'Токен B',
  blockNumber: 'Блок',
  tokenOut: 'Получить',
  fee: 'Комиссия пула',
  uri: 'URI метаданных',
  tokenId: 'NFT позиции',
  price: 'Цена за 1 ORE',
  recipient: 'Получатель',
  tickLower: 'Нижний тик',
  amountIn: 'Сумма обмена',
  deadline: 'Крайний срок',
  tickUpper: 'Верхний тик',
  nftExists: 'NFT сохранён',
  budgetA: 'Бюджет токена A',
  budgetB: 'Бюджет токена B',
  quotedOut: 'Ожидаемый выход',
  minimum0: 'Минимум токена 0',
  minimum1: 'Минимум токена 1',
  currentPrice: 'Текущая цена',
  maximum0: 'Максимум токена 0',
  maximum1: 'Максимум токена 1',
  minimumOut: 'Минимальный выход',
  decimals: 'Знаков после запятой',
  interestRateMode: 'Режим ставки',
  initialize: 'Инициализация пула',
  inRange: 'Цена внутри диапазона',
  timestamp: 'Дата получения права',
  error: 'Ошибка чтения результата',
  lowerPrice: 'Нижняя граница цены',
  upperPrice: 'Верхняя граница цены',
  capitalHolder: 'Держатель капитала',
  withdrawAll: 'Вывести весь остаток',
  slippageBps: 'Проскальзывание, bps',
  previousTimestamp: 'Предыдущая дата',
  sqrtPriceX96: 'Цена пула, sqrtPriceX96',
  minimumA: 'Минимум к внесению токена A',
  minimumB: 'Минимум к внесению токена B',
  leftoverA: 'Ожидаемый остаток токена A',
  leftoverB: 'Ожидаемый остаток токена B',
  desiredA: 'Максимум к внесению токена A',
  desiredB: 'Максимум к внесению токена B',
  expectedA: 'Ожидаемое внесение токена A',
  expectedB: 'Ожидаемое внесение токена B',
  decimalsA: 'Знаков после запятой у токена A',
  decimalsB: 'Знаков после запятой у токена B',
  liquidity: 'Ликвидность (единицы протокола)',
  utilizationPercentA: 'Использование токена A',
  utilizationPercentB: 'Использование токена B',
  tokensOwed0: 'Начисления токена 0 (мин. единицы)',
  tokensOwed1: 'Начисления токена 1 (мин. единицы)',
  maximumFunding: 'Максимальная сумма финансирования',
  lowerDistancePercent: 'Расстояние до нижней границы',
  upperDistancePercent: 'Расстояние до верхней границы',
  minBoundaryPercent: 'Минимальное расстояние до границ',
  minimumUtilizationPercent: 'Минимальное использование каждого актива',
}

const amountTokens: Record<string, string> = {
  amount: 'token',
  budgetA: 'tokenA',
  budgetB: 'tokenB',
  desiredA: 'tokenA',
  desiredB: 'tokenB',
  minimumA: 'tokenA',
  minimumB: 'tokenB',
  maximum0: 'token0',
  minimum0: 'token0',
  maximum1: 'token1',
  minimum1: 'token1',
  expectedA: 'tokenA',
  expectedB: 'tokenB',
  leftoverA: 'tokenA',
  leftoverB: 'tokenB',
  amountIn: 'tokenIn',
  quotedOut: 'tokenOut',
  minimumOut: 'tokenOut',
  maximumFunding: 'token',
}

export function PlanDetails(props: {
  config: Config
  summary: Record<string, unknown>
}) {
  const entries = () =>
    Object.entries(props.summary).flatMap<[string, unknown]>(([key, value]) =>
      ['range', 'amounts'].includes(key) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
        ? Object.entries(value)
        : [[key, value]],
    )
  function renderValue(key: string, value: unknown): string {
    if (value === null || value === undefined) {
      return '—'
    }
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет'
    }
    if (['timestamp', 'previousTimestamp', 'deadline'].includes(key)) {
      return String(value) === '0'
        ? 'Не назначена'
        : dateTime(Number(value) * 1000)
    }
    if (key === 'price') {
      return `${units(String(value))} за ORE`
    }
    if (['currentPrice', 'lowerPrice', 'upperPrice'].includes(key)) {
      return `${decimal(String(value))} ${String(props.summary.tokenB)} за 1 ${String(props.summary.tokenA)}`
    }
    if (
      [
        'minBoundaryPercent',
        'minimumUtilizationPercent',
        'lowerDistancePercent',
        'upperDistancePercent',
        'utilizationPercentA',
        'utilizationPercentB',
      ].includes(key)
    ) {
      return `${decimal(String(value))}%`
    }
    if (key === 'fee') {
      return `${units(String(value), 4)}%`
    }
    if (key === 'interestRateMode' && value === 2) {
      return 'Переменная'
    }
    const symbol = props.summary[amountTokens[key]]
    const token = props.config.tokens.find(item => item.symbol === symbol)
    if (key === 'amount' && props.summary.withdrawAll) {
      return 'Весь доступный остаток'
    }
    if (token && typeof value === 'string' && /^\d+$/.test(value)) {
      return `${units(value, token.decimals)} ${token.symbol}`
    }
    if (['minimum0', 'minimum1'].includes(key) && !token) {
      return `${String(value)} (минимальные единицы токена ${key.slice(-1)})`
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }
  return (
    <dl class="console__details">
      <For each={entries()}>
        {([key, value]) => (
          <>
            <dt>{labels[key] ?? key}</dt>
            <dd>
              <Show
                when={key === 'route' && Array.isArray(value)}
                fallback={
                  <Show
                    fallback={renderValue(key, value)}
                    when={
                      typeof value === 'string' &&
                      /^0x[\da-fA-F]{40}$/.test(value)
                    }
                  >
                    <Address full value={String(value)} />
                  </Show>
                }
              >
                <div class="console__stack console__stack--compact">
                  <For each={Array.isArray(value) ? value : []}>
                    {address => (
                      <div>
                        <span>
                          {props.config.tokens.find(
                            token =>
                              token.address.toLowerCase() ===
                              String(address).toLowerCase(),
                          )?.symbol ?? 'Токен'}{' '}
                        </span>
                        <Address full value={String(address)} />
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </dd>
          </>
        )}
      </For>
    </dl>
  )
}

export function RequestDetails(props: { request: PreviewRequest }) {
  return (
    <dl class="console__details">
      <dt>Действие</dt>
      <dd>
        {actions[props.request.action.kind]?.title ?? props.request.action.kind}
      </dd>
      <For each={Object.entries(props.request.action.params)}>
        {([key, value]) => (
          <>
            <dt>
              {actions[props.request.action.kind]?.fields.find(
                field => field.key === key,
              )?.label ?? key}
            </dt>
            <dd>
              {key === 'timestamp'
                ? dateTime(Number(value) * 1000)
                : String(value)}
            </dd>
          </>
        )}
      </For>
      <dt>Лимит газа всей операции</dt>
      <dd>{decimal(props.request.maxGasAvax)} AVAX</dd>
    </dl>
  )
}

export function ApprovalDetails(props: { config: Config; approval: Approval }) {
  const token = () =>
    props.config.tokens.find(
      item => item.address.toLowerCase() === props.approval.token.toLowerCase(),
    )
  return (
    <div class="console__approval">
      <p>
        Токен: {token()?.symbol ?? props.approval.token} · Разрешение:{' '}
        {token()
          ? units(props.approval.amount, token()?.decimals)
          : props.approval.amount}
      </p>
      <p>Контракт-получатель разрешения:</p>
      <Address full value={props.approval.spender} />
      <Show when={props.approval.resetBelow}>
        <small>
          Сброс выполняется только при недостаточном текущем разрешении.
        </small>
      </Show>
    </div>
  )
}
