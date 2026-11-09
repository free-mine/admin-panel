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
  quotedOut: 'Ожидаемый выход',
  minimum0: 'Минимум токена 0',
  minimum1: 'Минимум токена 1',
  maximum0: 'Максимум токена 0',
  maximum1: 'Максимум токена 1',
  minimumOut: 'Минимальный выход',
  decimals: 'Знаков после запятой',
  interestRateMode: 'Режим ставки',
  initialize: 'Инициализация пула',
  timestamp: 'Дата получения права',
  error: 'Ошибка чтения результата',
  capitalHolder: 'Держатель капитала',
  withdrawAll: 'Вывести весь остаток',
  slippageBps: 'Проскальзывание, bps',
  previousTimestamp: 'Предыдущая дата',
  sqrtPriceX96: 'Цена пула, sqrtPriceX96',
  liquidity: 'Ликвидность (единицы протокола)',
  tokensOwed0: 'Начисления токена 0 (мин. единицы)',
  tokensOwed1: 'Начисления токена 1 (мин. единицы)',
  maximumFunding: 'Максимальная сумма финансирования',
}

export function PlanDetails(props: {
  config: Config
  summary: Record<string, unknown>
}) {
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
    if (key === 'fee') {
      return `${units(String(value), 4)}%`
    }
    if (key === 'interestRateMode' && value === 2) {
      return 'Переменная'
    }
    const symbol =
      key === 'amountIn'
        ? props.summary.tokenIn
        : ['quotedOut', 'minimumOut'].includes(key)
          ? props.summary.tokenOut
          : ['maximum0', 'minimum0'].includes(key)
            ? props.summary.token0
            : ['maximum1', 'minimum1'].includes(key)
              ? props.summary.token1
              : ['amount', 'maximumFunding'].includes(key)
                ? props.summary.token
                : undefined
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
      <For each={Object.entries(props.summary)}>
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
