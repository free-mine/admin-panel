import { For, Show, createSignal } from 'solid-js'

import { request } from '../../../shared/api'
import { createRemote } from '../model/remote'
import { actions, stepLabels } from '../model/actions'
import { publicError, errorMessage } from '../model/errors'
import type { Operation, OperationPage } from '../api/types'
import { units, dateTime } from '../../../shared/lib/format'
import { Pager, Status, Address, DataState } from './primitives'
import type { Session, OperationDetailProps } from '../model/types'
import { PlanDetails, RequestDetails, ApprovalDetails } from './plan-details'

function OperationDetail(props: OperationDetailProps) {
  const [hash, setHash] = createSignal('')
  const [checked, setChecked] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  async function resolve(event: SubmitEvent) {
    event.preventDefault()
    if (busy() || !checked() || !props.session.ready()) {
      return
    }
    if (!/^0x[\da-fA-F]{64}$/.test(hash().trim())) {
      setError('Укажите полный хэш транзакции: 0x и 64 символа.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await request(
        props.session.endpoint,
        `/v1/operations/${props.operation.id}/resolve`,
        { transactionHash: hash().trim() },
      )
      props.onRefresh()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <article class="console__panel">
      <div class="console__section-heading">
        <h2>
          {actions[props.operation.request.action.kind]?.title ??
            props.operation.request.action.kind}
        </h2>
        <Status value={props.operation.status} />
      </div>
      <p class="console__mono">{props.operation.id}</p>
      <p class="console__subtle">
        Создана {dateTime(props.operation.createdAt)} · Обновлена{' '}
        {dateTime(props.operation.updatedAt)}
      </p>
      <Show when={props.operation.error}>
        {detail => (
          <div role="alert" class="console__notice console__notice--danger">
            {publicError(detail())}
          </div>
        )}
      </Show>
      <Show
        when={['failed', 'needs_attention'].includes(props.operation.status)}
      >
        <div class="console__notice">
          Подтверждённые шаги сохраняют результат. Проверьте receipts и
          разрешения перед новой операцией.
        </div>
      </Show>
      <RequestDetails request={props.operation.request} />
      <PlanDetails
        config={props.session.config}
        summary={props.operation.summary}
      />
      <h3>Исполнение по шагам</h3>
      <ol class="console__steps">
        <For each={props.operation.steps}>
          {step => (
            <li>
              <div class="console__section-heading">
                <b>{stepLabels[step.code] ?? step.code}</b>
                <Status value={step.status} />
              </div>
              <Show when={step.approval}>
                {approval => (
                  <ApprovalDetails
                    approval={approval()}
                    config={props.session.config}
                  />
                )}
              </Show>
              <Show when={step.transactionHash}>
                {transactionHash => (
                  <Address full transaction value={transactionHash()} />
                )}
              </Show>
              <Show when={step.receipt}>
                {receipt => (
                  <p class="console__subtle">
                    Блок {receipt().blockNumber} · Фактическая комиссия{' '}
                    {units(receipt().fee)} AVAX · Receipt:{' '}
                    {receipt().status === 1 ? 'Успех' : 'Ошибка'}
                  </p>
                )}
              </Show>
              <Show when={step.error}>
                {detail => (
                  <p role="alert" class="console__field-error">
                    {publicError(detail())}
                  </p>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <div class="console__funding-total">
        <span>Фактически потрачено на газ</span>
        <strong>{units(props.operation.gasSpentWei)} AVAX</strong>
        <small>Общий лимит: {units(props.operation.maxGasWei)} AVAX</small>
      </div>
      <Show when={props.operation.result}>
        {result => (
          <>
            <h3>Результат позиции</h3>
            <PlanDetails summary={result()} config={props.session.config} />
          </>
        )}
      </Show>
      <Show when={props.operation.status === 'needs_attention'}>
        <form class="console__resolve" onSubmit={event => void resolve(event)}>
          <h3>Подтверждённая внешняя замена</h3>
          <p>
            Если транзакция была заменена вне панели и уже включена в блок,
            укажите её хэш. Сервер проверит nonce, отправителя и содержание
            замены.
          </p>
          <div class="console__field">
            <label for="replacement-hash">Хэш подтверждённой замены</label>
            <input
              value={hash()}
              placeholder="0x…"
              autocomplete="off"
              id="replacement-hash"
              onInput={event => setHash(event.currentTarget.value)}
            />
          </div>
          <label class="console__check">
            <input
              type="checkbox"
              checked={checked()}
              onChange={event => setChecked(event.currentTarget.checked)}
            />
            Я проверил транзакцию замены в обозревателе.
          </label>
          <Show when={error()}>
            <p role="alert" class="console__field-error">
              {error()}
            </p>
          </Show>
          <button
            type="submit"
            class="console__button"
            disabled={busy() || !checked() || !props.session.ready()}
          >
            {busy() ? 'Проверка…' : 'Принять подтверждённую замену'}
          </button>
        </form>
      </Show>
      <p class="console__subtle">
        Отключение браузера не отменяет операцию. Сервер последовательно
        выполняет очередь.
      </p>
    </article>
  )
}

export function OperationsView(props: {
  session: Session
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [offset, setOffset] = createSignal(0)
  const list = createRemote<OperationPage>(
    () => props.session,
    () => `/v1/operations?offset=${offset()}&limit=20`,
  )
  const detail = createRemote<Operation>(
    () => props.session,
    () => (props.selectedId ? `/v1/operations/${props.selectedId}` : undefined),
  )
  return (
    <>
      <header class="console__page-heading">
        <div>
          <h1>Операции</h1>
          <p>Очередь, транзакции и результаты исполнения.</p>
        </div>
        <button class="console__button" onClick={() => props.session.refresh()}>
          Обновить
        </button>
      </header>
      <Show when={props.selectedId}>
        <button class="console__text-button" onClick={() => props.onSelect('')}>
          ← К списку операций
        </button>
        <DataState remote={detail}>
          <Show when={detail.data()}>
            {operation => (
              <OperationDetail
                operation={operation()}
                session={props.session}
                onRefresh={() => props.session.refresh()}
              />
            )}
          </Show>
        </DataState>
      </Show>
      <Show when={!props.selectedId}>
        <DataState remote={list}>
          <Show when={list.data()}>
            {page => (
              <>
                <div class="console__table-wrap">
                  <table class="console__table">
                    <thead>
                      <tr>
                        <th>Операция</th>
                        <th>Создана</th>
                        <th>Статус</th>
                        <th>Газ, AVAX</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={page().operations}>
                        {operation => (
                          <tr>
                            <td data-label="Операция">
                              <button
                                class="console__text-button"
                                onClick={() => props.onSelect(operation.id)}
                              >
                                {actions[operation.request.action.kind]
                                  ?.title ?? operation.request.action.kind}
                              </button>
                              <small class="console__mono">
                                {operation.id}
                              </small>
                            </td>
                            <td data-label="Создана">
                              {dateTime(operation.createdAt)}
                            </td>
                            <td data-label="Статус">
                              <Status value={operation.status} />
                            </td>
                            <td data-label="Газ, AVAX">
                              {units(operation.gasSpentWei)}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                  <Show when={!page().operations.length}>
                    <div class="console__empty">
                      Операций пока нет.
                      <small>
                        После подтверждения плана здесь появятся все шаги
                        исполнения.
                      </small>
                    </div>
                  </Show>
                  <Pager
                    offset={offset()}
                    total={page().total}
                    onChange={setOffset}
                    loading={list.loading()}
                  />
                </div>
              </>
            )}
          </Show>
        </DataState>
      </Show>
    </>
  )
}
