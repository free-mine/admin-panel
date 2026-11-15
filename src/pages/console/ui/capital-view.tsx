import { For, Show, createSignal } from 'solid-js'

import { Amount } from './amount'
import { BalanceStrip } from './balances'
import { publicError } from '../model/errors'
import { createRemote } from '../model/remote'
import type { ViewProps } from '../model/types'
import { Tabs, Pager, DataState } from './primitives'
import type { Aave, Balances, PositionPage } from '../api/types'
import { units, decimal, fromUnits } from '../../../shared/lib/format'

export function CapitalView(props: ViewProps) {
  const [tab, setTab] = createSignal('tokens')
  const [offset, setOffset] = createSignal(0)
  const balances = createRemote<Balances>(
    () => props.session,
    () => (['tokens', 'lfj'].includes(tab()) ? '/v1/balances' : undefined),
  )
  const aave = createRemote<Aave>(
    () => props.session,
    () => (tab() === 'aave' ? '/v1/aave' : undefined),
  )
  const positions = createRemote<PositionPage>(
    () => props.session,
    () =>
      tab() === 'uniswap'
        ? `/v1/uniswap/positions?offset=${offset()}&limit=20`
        : undefined,
  )
  return (
    <>
      <header class="console__page-heading">
        <div>
          <h1>Капитал</h1>
          <p>Активы OreVein и позиции в протоколах.</p>
        </div>
      </header>
      <Tabs
        value={tab()}
        onChange={setTab}
        label="Разделы капитала"
        items={[
          { id: 'tokens', label: 'Токены' },
          { id: 'aave', label: 'Aave' },
          { id: 'lfj', label: 'LFJ' },
          { id: 'uniswap', label: 'Uniswap' },
        ]}
      />
      <Show when={tab() === 'tokens'}>
        <BalanceStrip
          expanded
          remote={balances}
          oreVein={props.session.config.addresses.oreVein}
        />
      </Show>
      <Show when={tab() === 'aave'}>
        <DataState remote={aave}>
          <Show when={aave.data()}>
            {data => (
              <>
                <div class="console__metrics">
                  <div>
                    <p>Залог, USD</p>
                    <strong>
                      <Amount
                        value={fromUnits(
                          data().totalCollateralBase,
                          data().baseDecimals,
                        )}
                      />
                    </strong>
                  </div>
                  <div>
                    <p>Долг, USD</p>
                    <strong>
                      <Amount
                        value={fromUnits(
                          data().totalDebtBase,
                          data().baseDecimals,
                        )}
                      />
                    </strong>
                  </div>
                  <div>
                    <p>Доступный заём, USD</p>
                    <strong>
                      <Amount
                        value={fromUnits(
                          data().availableBorrowsBase,
                          data().baseDecimals,
                        )}
                      />
                    </strong>
                  </div>
                </div>
                <div class="console__notice">
                  <b>
                    Health factor:{' '}
                    {data().healthFactor === null
                      ? 'Нет долга'
                      : units(
                          data().healthFactor ?? '0',
                          data().healthFactorDecimals,
                        )}
                  </b>
                  <span>
                    {' '}
                    LTV: {units(data().ltv, 2)}% · Порог ликвидации:{' '}
                    {units(data().currentLiquidationThreshold, 2)}%
                  </span>
                </div>
                <div class="console__stack">
                  <For each={data().reserves}>
                    {reserve => (
                      <section class="console__panel">
                        <div class="console__section-heading">
                          <h2>{reserve.symbol}</h2>
                          <span class="console__subtle">
                            Aave · переменная ставка
                          </span>
                        </div>
                        <dl class="console__details">
                          <dt>Внесено</dt>
                          <dd>
                            <Amount
                              value={fromUnits(
                                reserve.supplied,
                                reserve.decimals,
                              )}
                            />{' '}
                            {reserve.symbol}
                          </dd>
                          <dt>Долг</dt>
                          <dd>
                            <Amount
                              value={fromUnits(
                                reserve.variableDebt,
                                reserve.decimals,
                              )}
                            />{' '}
                            {reserve.symbol}
                          </dd>
                          <dt>Ставка предложения, APR</dt>
                          <dd>{units(reserve.supplyRateRay, 25)}%</dd>
                          <dt>Ставка займа, APR</dt>
                          <dd>{units(reserve.variableBorrowRateRay, 25)}%</dd>
                        </dl>
                        <div class="console__actions">
                          <For
                            each={
                              ['supply', 'withdraw', 'borrow', 'repay'] as const
                            }
                          >
                            {kind => (
                              <button
                                class="console__button"
                                disabled={
                                  !props.session.ready() || !!aave.error()
                                }
                                onClick={() =>
                                  props.onAction({
                                    kind: `aave.${kind}`,
                                    values: { token: reserve.symbol },
                                  })
                                }
                              >
                                {
                                  {
                                    supply: 'Внести',
                                    borrow: 'Занять',
                                    repay: 'Погасить',
                                    withdraw: 'Вывести',
                                  }[kind]
                                }
                              </button>
                            )}
                          </For>
                        </div>
                      </section>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </DataState>
      </Show>
      <Show when={tab() === 'lfj'}>
        <section class="console__panel console__intro">
          <p class="console__eyebrow">LFJ · Avalanche</p>
          <h2>Обмен токенов</h2>
          <p>
            Обменивайте WAVAX, USDT, USDC и BTC.b из капитала OreVein. Перед
            исполнением проверьте маршрут, минимальный выход и комиссию в плане
            операции.
          </p>
          <button
            disabled={!props.session.ready()}
            class="console__button console__button--primary"
            onClick={() => props.onAction({ kind: 'lfj.swap' })}
          >
            Подготовить обмен
          </button>
        </section>
        <BalanceStrip
          remote={balances}
          oreVein={props.session.config.addresses.oreVein}
        />
      </Show>
      <Show when={tab() === 'uniswap'}>
        <div class="console__section-heading">
          <h2>Позиции Uniswap</h2>
          <button
            disabled={!props.session.ready()}
            class="console__button console__button--primary"
            onClick={() => props.onAction({ kind: 'uniswap.mint' })}
          >
            Создать позицию
          </button>
        </div>
        <DataState remote={positions}>
          <Show when={positions.data()}>
            {data => (
              <>
                <div class="console__stack">
                  <For each={data().positions}>
                    {position => (
                      <section class="console__panel">
                        <Show
                          when={'error' in position ? undefined : position}
                          fallback={
                            <>
                              <h2>NFT #{position.tokenId}</h2>
                              <p role="alert">
                                {'error' in position
                                  ? publicError(position.error)
                                  : ''}
                              </p>
                            </>
                          }
                        >
                          {item => (
                            <>
                              <div class="console__section-heading">
                                <h2>
                                  {item().tokenA.symbol} /{' '}
                                  {item().tokenB.symbol}
                                </h2>
                                <span class="console__mono">
                                  NFT #{item().tokenId}
                                </span>
                              </div>
                              <dl class="console__details">
                                <dt>Комиссия пула</dt>
                                <dd>{units(String(item().fee), 4)}%</dd>
                                <dt>Текущая цена</dt>
                                <dd>
                                  {decimal(item().currentPrice)}{' '}
                                  {item().tokenB.symbol} за 1{' '}
                                  {item().tokenA.symbol}
                                </dd>
                                <dt>Нижняя граница цены</dt>
                                <dd>
                                  {decimal(item().range.lowerPrice)}{' '}
                                  {item().tokenB.symbol} за 1{' '}
                                  {item().tokenA.symbol}
                                </dd>
                                <dt>Верхняя граница цены</dt>
                                <dd>
                                  {decimal(item().range.upperPrice)}{' '}
                                  {item().tokenB.symbol} за 1{' '}
                                  {item().tokenA.symbol}
                                </dd>
                                <dt>Расстояние до нижней границы</dt>
                                <dd>
                                  {item().range.lowerDistancePercent === null
                                    ? '—'
                                    : `${decimal(item().range.lowerDistancePercent ?? '0')}%`}
                                </dd>
                                <dt>Расстояние до верхней границы</dt>
                                <dd>
                                  {item().range.upperDistancePercent === null
                                    ? '—'
                                    : `${decimal(item().range.upperDistancePercent ?? '0')}%`}
                                </dd>
                                <dt>Положение цены</dt>
                                <dd>
                                  {item().inRange
                                    ? 'В диапазоне'
                                    : 'Вне диапазона или на границе'}
                                </dd>
                                <dt>Ликвидность (единицы протокола)</dt>
                                <dd class="console__mono">
                                  {item().liquidity}
                                </dd>
                                <dt>Начислено {item().tokenA.symbol}</dt>
                                <dd>
                                  <Amount
                                    value={fromUnits(
                                      item().tokensOwedA,
                                      item().tokenA.decimals,
                                    )}
                                  />
                                </dd>
                                <dt>Начислено {item().tokenB.symbol}</dt>
                                <dd>
                                  <Amount
                                    value={fromUnits(
                                      item().tokensOwedB,
                                      item().tokenB.decimals,
                                    )}
                                  />
                                </dd>
                              </dl>
                              <div class="console__actions">
                                <For
                                  each={
                                    [
                                      'increase',
                                      'collect',
                                      'close',
                                      'burn',
                                    ] as const
                                  }
                                >
                                  {kind => (
                                    <button
                                      class="console__button"
                                      onClick={() =>
                                        props.onAction({
                                          kind: `uniswap.${kind}`,
                                          token0: item().tokenA.symbol,
                                          token1: item().tokenB.symbol,
                                          values: { tokenId: item().tokenId },
                                        })
                                      }
                                      disabled={
                                        !props.session.ready() ||
                                        !!positions.error() ||
                                        (kind === 'burn' &&
                                          [
                                            item().liquidity,
                                            item().tokensOwedA,
                                            item().tokensOwedB,
                                          ].some(value => BigInt(value) > 0n))
                                      }
                                    >
                                      {
                                        {
                                          collect: 'Собрать',
                                          burn: 'Удалить NFT',
                                          increase: 'Добавить',
                                          close: 'Вывести ликвидность',
                                        }[kind]
                                      }
                                    </button>
                                  )}
                                </For>
                              </div>
                            </>
                          )}
                        </Show>
                      </section>
                    )}
                  </For>
                </div>
                <Show when={!data().positions.length}>
                  <div class="console__empty">
                    Позиции не найдены.
                    <small>
                      Создайте позицию, чтобы предоставить ликвидность.
                    </small>
                  </div>
                </Show>
                <Pager
                  offset={offset()}
                  total={data().total}
                  onChange={setOffset}
                  loading={positions.loading()}
                />
              </>
            )}
          </Show>
        </DataState>
      </Show>
    </>
  )
}
