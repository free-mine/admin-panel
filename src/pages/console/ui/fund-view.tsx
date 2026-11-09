import { For, Show, createSignal } from 'solid-js'

import { BalanceStrip } from './balances'
import { createRemote } from '../model/remote'
import { Icon } from '../../../shared/ui/icon'
import type { ViewProps } from '../model/types'
import { Tabs, Pager, Address, DataState } from './primitives'
import type { Fund, Shift, Balances, ClaimPage } from '../api/types'
import { units, decimal, dateTime } from '../../../shared/lib/format'

export function FundView(props: ViewProps) {
  const [tab, setTab] = createSignal('shifts')
  const [selected, setSelected] = createSignal('')
  const [input, setInput] = createSignal('')
  const [inputError, setInputError] = createSignal('')
  const [offset, setOffset] = createSignal(0)
  const fund = createRemote<Fund>(
    () => props.session,
    () => '/v1/fund',
  )
  const balances = createRemote<Balances>(
    () => props.session,
    () => '/v1/balances',
  )
  const lastId = () =>
    fund.data() && BigInt(fund.data()?.currentShiftId ?? '1') > 1n
      ? String(BigInt(fund.data()?.currentShiftId ?? '1') - 1n)
      : undefined
  const last = createRemote<Shift>(
    () => props.session,
    () => (lastId() ? `/v1/fund/shifts/${lastId()}` : undefined),
  )
  const selectedId = () => selected() || lastId() || fund.data()?.currentShiftId
  const shift = createRemote<Shift>(
    () => props.session,
    () => (selectedId() ? `/v1/fund/shifts/${selectedId()}` : undefined),
  )
  const claims = createRemote<ClaimPage>(
    () => props.session,
    () =>
      selectedId()
        ? `/v1/fund/shifts/${selectedId()}/claims?offset=${offset()}&limit=20`
        : undefined,
  )
  const dollar = () =>
    props.session.config.tokens.find(
      item => item.address.toLowerCase() === fund.data()?.dollar.toLowerCase(),
    )?.symbol ?? 'расчётного токена'
  const disabled = () =>
    !props.session.ready() || !!fund.error() || fund.loading()
  function selectShift(event: SubmitEvent) {
    event.preventDefault()
    if (
      !/^[1-9]\d{0,77}$/.test(input()) ||
      BigInt(input()) > BigInt(fund.data()?.currentShiftId ?? '0')
    ) {
      setInputError('Укажите существующий ID смены.')
      return
    }
    setInputError('')
    setSelected(input())
    setOffset(0)
  }
  return (
    <>
      <header class="console__page-heading">
        <div>
          <h1>Фонд</h1>
          <p>Смены, заявки и расчётная цена ORE.</p>
        </div>
        <a
          target="_blank"
          rel="noreferrer"
          class="console__link"
          href={`https://snowtrace.io/address/${props.session.config.addresses.freeMine}`}
        >
          Контракт <Icon name="external" />
        </a>
      </header>
      <Tabs
        value={tab()}
        onChange={setTab}
        label="Разделы фонда"
        items={[
          { id: 'shifts', label: 'Смены и заявки' },
          { id: 'price', label: 'Цена ORE' },
          { id: 'settings', label: 'Параметры' },
        ]}
      />
      <DataState remote={fund}>
        <Show when={fund.data()}>
          {data => (
            <>
              <Show when={tab() === 'shifts'}>
                <div class="console__metrics">
                  <div>
                    <p>Текущая смена</p>
                    <strong>#{data().currentShiftId}</strong>{' '}
                    <span class="console__badge console__badge--success">
                      Открыта
                    </span>
                    <small>Приём заявок на вывод</small>
                  </div>
                  <div>
                    <p>Цена входа · за 1 ORE</p>
                    <strong>{units(data().entryPrice)}</strong>{' '}
                    <span>{dollar()}</span>
                    <small>
                      Обновление с {dateTime(data().nextPriceUpdateAt * 1000)}
                    </small>
                  </div>
                  <div>
                    <p>Газ владельца</p>
                    <strong>
                      {balances.data()
                        ? decimal(balances.data()?.ownerAvax ?? '')
                        : '—'}
                    </strong>{' '}
                    <span>AVAX</span>
                    <small>
                      {balances.error()
                        ? 'Не удалось обновить баланс газа'
                        : 'Отдельно от капитала OreVein'}
                    </small>
                  </div>
                </div>
                <DataState remote={last}>
                  <Show
                    when={last.data()}
                    fallback={
                      <Show when={!lastId()}>
                        <div class="console__notice">
                          Закрытых смен пока нет.
                        </div>
                      </Show>
                    }
                  >
                    {closed => (
                      <section class="console__callout">
                        <div>
                          <p class="console__eyebrow">
                            Последняя закрытая смена
                          </p>
                          <div class="console__row">
                            <h2>Смена #{closed().id}</h2>
                            <span
                              class="console__badge"
                              classList={{
                                'console__badge--success': closed().funded,
                                'console__badge--warning': !closed().funded,
                              }}
                            >
                              {closed().funded
                                ? 'Профинансирована'
                                : 'Ожидает финансирования'}
                            </span>
                          </div>
                          <p>
                            В заявках <b>{units(closed().oreAmount)} ORE</b>.{' '}
                            {closed().funded
                              ? `Цена выхода: ${units(closed().price)}.`
                              : 'Подготовьте средства для расчёта.'}
                          </p>
                        </div>
                        <Show when={!closed().funded}>
                          <button
                            disabled={disabled() || !!last.error()}
                            class="console__button console__button--primary"
                            onClick={() =>
                              props.onAction({ kind: 'fund.fundShift' })
                            }
                          >
                            Финансировать смену{' '}
                            <Icon tone="light" name="arrow-right" />
                          </button>
                        </Show>
                      </section>
                    )}
                  </Show>
                </DataState>
                <section>
                  <div class="console__section-heading">
                    <h2>Заявки на вывод</h2>
                    <form class="console__row" onSubmit={selectShift}>
                      <label class="console__inline-label">
                        Смена
                        <input
                          value={input()}
                          inputmode="numeric"
                          aria-label="ID смены"
                          placeholder={selectedId()}
                          onInput={event => setInput(event.currentTarget.value)}
                        />
                      </label>
                      <button type="submit" class="console__button">
                        Показать
                      </button>
                    </form>
                  </div>
                  <Show when={inputError()}>
                    <p role="alert" class="console__field-error">
                      {inputError()}
                    </p>
                  </Show>
                  <DataState remote={shift}>
                    <Show when={shift.data()}>
                      {value => (
                        <p class="console__subtle">
                          Смена #{value().id} ·{' '}
                          {value().funded
                            ? 'Профинансирована'
                            : value().closed
                              ? 'Ожидает финансирования'
                              : 'Открыта'}
                          {value().expireAvailableAt
                            ? ` · Закрытие просроченных заявок с ${dateTime((value().expireAvailableAt ?? 0) * 1000)}`
                            : ''}
                        </p>
                      )}
                    </Show>
                  </DataState>
                  <DataState remote={claims}>
                    <Show when={claims.data()}>
                      {page => (
                        <div class="console__table-wrap">
                          <table class="console__table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Вкладчик</th>
                                <th>ORE в заявке</th>
                                <th>Состояние</th>
                              </tr>
                            </thead>
                            <tbody>
                              <For each={page().claims}>
                                {claim => (
                                  <tr>
                                    <td data-label="ID">#{claim.id}</td>
                                    <td data-label="Вкладчик">
                                      <Address value={claim.miner} />
                                    </td>
                                    <td data-label="ORE в заявке">
                                      {units(claim.oreAmount)} ORE
                                    </td>
                                    <td data-label="Состояние">
                                      <Show
                                        when={shift.data()?.funded}
                                        fallback={
                                          <span class="console__subtle">
                                            {shift.data()
                                              ? 'Ждёт финансирования'
                                              : 'Нет данных о смене'}
                                          </span>
                                        }
                                      >
                                        <Show
                                          fallback={
                                            <span>Доступна к получению</span>
                                          }
                                          when={
                                            (shift.data()?.expireAvailableAt ??
                                              Infinity) *
                                              1000 <=
                                            Date.now()
                                          }
                                        >
                                          <button
                                            class="console__text-button"
                                            disabled={
                                              disabled() ||
                                              !!shift.error() ||
                                              !!claims.error()
                                            }
                                            onClick={() =>
                                              props.onAction({
                                                kind: 'fund.expireClaim',
                                                values: {
                                                  claimId: claim.id,
                                                  shiftId: page().shiftId,
                                                },
                                              })
                                            }
                                          >
                                            Закрыть просроченную
                                          </button>
                                        </Show>
                                      </Show>
                                    </td>
                                  </tr>
                                )}
                              </For>
                            </tbody>
                          </table>
                          <Show when={!page().claims.length}>
                            <div class="console__empty">
                              В этом диапазоне нет открытых заявок.
                              <small>
                                Закрытые заявки оставляют пропуски в ID.
                              </small>
                            </div>
                          </Show>
                          <Pager
                            offset={offset()}
                            onChange={setOffset}
                            total={page().totalIds}
                            loading={claims.loading()}
                            label={`Смена #${page().shiftId} · Диапазон ID ${offset() + 1}–${offset() + 20} · Последний выданный ID: ${page().totalIds}`}
                          />
                        </div>
                      )}
                    </Show>
                  </DataState>
                </section>
                <div class="console__section-heading">
                  <p class="console__subtle">
                    После закрытия новые заявки будут приниматься в следующей
                    смене.
                  </p>
                  <button
                    disabled={disabled()}
                    class="console__button"
                    onClick={() => props.onAction({ kind: 'fund.closeShift' })}
                  >
                    Закрыть смену #{data().currentShiftId}
                  </button>
                </div>
                <BalanceStrip session={props.session} />
              </Show>
              <Show when={tab() === 'price'}>
                <div class="console__grid">
                  <section class="console__panel">
                    <p class="console__eyebrow">Цена входа</p>
                    <h2>
                      {units(data().entryPrice)} {dollar()} / ORE
                    </h2>
                    <dl class="console__details">
                      <dt>Допустимая новая цена</dt>
                      <dd>
                        {units(data().minimumEntryPrice)}–
                        {units(data().maximumEntryPrice)}
                      </dd>
                      <dt>Последнее обновление</dt>
                      <dd>{dateTime(data().priceUpdatedAt * 1000)}</dd>
                      <dt>Следующее обновление</dt>
                      <dd>{dateTime(data().nextPriceUpdateAt * 1000)}</dd>
                    </dl>
                    <button
                      class="console__button console__button--primary"
                      onClick={() =>
                        props.onAction({ kind: 'fund.updateEntryPrice' })
                      }
                      disabled={
                        disabled() ||
                        data().nextPriceUpdateAt * 1000 > Date.now()
                      }
                    >
                      Обновить цену входа
                    </button>
                  </section>
                  <section class="console__panel">
                    <p class="console__eyebrow">Цена выхода</p>
                    <h2>
                      {units(data().minimumExitPrice)}–
                      {units(data().maximumExitPrice)}
                    </h2>
                    <p>
                      {dollar()} за 1 ORE. Выбирается при финансировании
                      последней закрытой смены.
                    </p>
                  </section>
                </div>
              </Show>
              <Show when={tab() === 'settings'}>
                <div class="console__grid">
                  <section class="console__panel">
                    <h2>Расчётный токен</h2>
                    <p>{dollar()}</p>
                    <Address full value={data().dollar} />
                    <div class="console__actions">
                      <button
                        disabled={disabled()}
                        class="console__button"
                        onClick={() =>
                          props.onAction({ kind: 'fund.changeDollar' })
                        }
                      >
                        Изменить токен
                      </button>
                    </div>
                  </section>
                  <section class="console__panel">
                    <h2>Метаданные OreVein</h2>
                    <p class="console__mono">
                      {data().contractURI || 'URI не задан'}
                    </p>
                    <button
                      disabled={disabled()}
                      class="console__button"
                      onClick={() =>
                        props.onAction({
                          kind: 'contract.setURI',
                          values: { uri: data().contractURI },
                        })
                      }
                    >
                      Изменить URI
                    </button>
                  </section>
                </div>
              </Show>
            </>
          )}
        </Show>
      </DataState>
    </>
  )
}
