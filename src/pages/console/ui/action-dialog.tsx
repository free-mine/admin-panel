import { For, Show, onMount, untrack, onCleanup, createSignal } from 'solid-js'

import { DataState } from './primitives'
import { Icon } from '../../../shared/ui/icon'
import { errorMessage } from '../model/errors'
import { createRemote } from '../model/remote'
import { request, ApiError } from '../../../shared/api'
import type { Fund, Shift, Preview, Operation } from '../api/types'
import type { Session, ActionDraft, PendingSubmission } from '../model/types'
import { PlanDetails, RequestDetails, ApprovalDetails } from './plan-details'
import {
  units,
  decimal,
  toUnits,
  dateTime,
  fromUnits,
} from '../../../shared/lib/format'
import {
  actions,
  stepLabels,
  initialValues,
  visibleFields,
  validateAction,
} from '../model/actions'

export function ActionDialog(props: {
  session: Session
  draft: ActionDraft
  onClose: () => void
  onSubmitted: (operation: Operation) => void
  onPending: (pending: PendingSubmission | undefined) => void
}) {
  // The keyed dialog owns one draft for its entire lifetime.
  const [values, setValues] = createSignal(
    untrack(() => initialValues(props.draft)),
  )
  const [gas, setGas] = createSignal('0.005')
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [preview, setPreview] = createSignal<Preview>()
  const [accepted, setAccepted] = createSignal(false)
  const [now, setNow] = createSignal(Date.now())
  const [uncertain, setUncertain] = createSignal<PendingSubmission>()
  let dialog: HTMLDialogElement | undefined
  let alive = true
  const fund = createRemote<Fund>(
    () => props.session,
    () =>
      ['fund.fundShift', 'fund.updateEntryPrice'].includes(props.draft.kind)
        ? '/v1/fund'
        : undefined,
  )
  const last = createRemote<Shift>(
    () => props.session,
    () =>
      props.draft.kind === 'fund.fundShift' &&
      BigInt(fund.data()?.currentShiftId ?? '1') > 1n
        ? `/v1/fund/shifts/${BigInt(fund.data()?.currentShiftId ?? '1') - 1n}`
        : undefined,
  )
  const remaining = () =>
    Math.max(0, Math.ceil(((preview()?.expiresAt ?? 0) - now()) / 1000))
  const dollar = () =>
    props.session.config.tokens.find(
      item => item.address.toLowerCase() === fund.data()?.dollar.toLowerCase(),
    )
  const funding = () => {
    try {
      return last.data() && values().price && dollar()
        ? units(
            String(
              (BigInt(last.data()?.oreAmount ?? '0') *
                toUnits(values().price, 18)) /
                (10n ** 18n * 10n ** BigInt(18 - (dollar()?.decimals ?? 18))),
            ),
            dollar()?.decimals,
          )
        : '—'
    } catch {
      return '—'
    }
  }
  onMount(() => {
    const previousFocus = document.activeElement
    dialog?.showModal()
    const timer = setInterval(() => setNow(Date.now()), 1000)
    onCleanup(() => {
      clearInterval(timer)
      dialog?.close()
      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus()
      }
    })
  })
  onCleanup(() => {
    alive = false
  })
  async function prepare(event?: SubmitEvent) {
    event?.preventDefault()
    if (busy() || !props.session.ready() || uncertain()) {
      return
    }
    const validated = validateAction(
      props.draft,
      values(),
      props.session.config,
      fund.data(),
    )
    try {
      if (toUnits(gas(), 18) <= 0n) {
        throw new Error('Лимит должен быть больше нуля.')
      }
    } catch (cause) {
      validated.errors.maxGasAvax = errorMessage(cause)
    }
    setErrors(validated.errors)
    if (Object.keys(validated.errors).length) {
      return
    }
    setBusy(true)
    setError('')
    setAccepted(false)
    setPreview(undefined)
    try {
      const result = await request<Preview>(
        props.session.endpoint,
        '/v1/previews',
        { maxGasAvax: gas(), action: validated.action },
      )
      if (alive) {
        setPreview(result)
        setNow(Date.now())
        dialog?.scrollTo(0, 0)
      }
    } catch (cause) {
      if (alive) {
        setError(errorMessage(cause))
      }
    } finally {
      if (alive) {
        setBusy(false)
      }
    }
  }
  async function submit() {
    const plan = preview()
    if (
      busy() ||
      !props.session.ready() ||
      props.session.readOnly() ||
      !plan ||
      (!uncertain() && (!accepted() || !remaining()))
    ) {
      return
    }
    const pending = uncertain() ?? {
      previewId: plan.id,
      requestId: crypto.randomUUID(),
      endpoint: props.session.endpoint,
    }
    setBusy(true)
    setError('')
    try {
      // Persist before the request; retries, including after reload, use this exact pair.
      props.onPending(pending)
      setUncertain(pending)
      const operation = await request<Operation>(
        props.session.endpoint,
        '/v1/operations',
        { previewId: pending.previewId, requestId: pending.requestId },
      )
      props.onPending(undefined)
      props.onSubmitted(operation)
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.detail.code !== 'READ_ONLY' &&
        cause.status >= 400 &&
        cause.status < 500
      ) {
        props.onPending(undefined)
        setUncertain(undefined)
        setPreview(undefined)
        setAccepted(false)
      }
      if (alive) {
        setError(errorMessage(cause))
      }
    } finally {
      if (alive) {
        setBusy(false)
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      class="console__dialog"
      aria-labelledby="action-title"
      onCancel={event => {
        event.preventDefault()
        if (!busy()) {
          props.onClose()
        }
      }}
    >
      <div class="console__section-heading">
        <p class="console__eyebrow">
          Операция · {preview() ? '02 / Проверка плана' : '01 / Параметры'}
        </p>
        <button
          disabled={busy()}
          class="console__icon-button"
          onClick={() => props.onClose()}
          aria-label="Закрыть окно операции"
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 id="action-title">{actions[props.draft.kind].title}</h2>
      <p class="console__subtle">{actions[props.draft.kind].description}</p>
      <Show when={props.session.readOnly()}>
        <div role="status" class="console__notice">
          Режим только чтения: план можно проверить, но выполнить операцию
          нельзя.
        </div>
      </Show>
      <Show when={error()}>
        <div role="alert" class="console__notice console__notice--danger">
          {error()}
        </div>
      </Show>
      <Show when={!props.session.ready()}>
        <div role="alert" class="console__notice">
          Связь с сервером не подтверждена. Отправка заблокирована.
        </div>
      </Show>
      <Show when={uncertain()}>
        <div role="alert" class="console__notice">
          Ответ на отправку не получен. Операция могла попасть в очередь.
          Повторная проверка использует тот же идентификатор и не создаст
          дубликат.
        </div>
      </Show>
      <Show
        when={preview()}
        fallback={
          <form onSubmit={event => void prepare(event)}>
            <Show
              when={
                props.draft.kind === 'fund.fundShift' ||
                props.draft.kind === 'fund.updateEntryPrice'
              }
            >
              <DataState remote={fund}>
                <Show when={fund.data()}>
                  {data => (
                    <div class="console__notice">
                      <b>
                        Допустимая цена:{' '}
                        {units(
                          props.draft.kind === 'fund.fundShift'
                            ? data().minimumExitPrice
                            : data().minimumEntryPrice,
                        )}
                        –
                        {units(
                          props.draft.kind === 'fund.fundShift'
                            ? data().maximumExitPrice
                            : data().maximumEntryPrice,
                        )}{' '}
                        {dollar()?.symbol}
                      </b>
                      <Show when={props.draft.kind === 'fund.updateEntryPrice'}>
                        <p>
                          Обновление с{' '}
                          {dateTime(data().nextPriceUpdateAt * 1000)}
                        </p>
                      </Show>
                      <Show when={props.draft.kind === 'fund.fundShift'}>
                        <p>
                          Последняя закрытая смена: #
                          {String(BigInt(data().currentShiftId) - 1n)}
                        </p>
                      </Show>
                    </div>
                  )}
                </Show>
              </DataState>
            </Show>
            <Show when={props.draft.token0}>
              <p>
                token0: <b>{props.draft.token0}</b> · token1:{' '}
                <b>{props.draft.token1}</b>
              </p>
            </Show>
            <div class="console__form-grid">
              <For each={visibleFields(props.draft.kind, values())}>
                {field => (
                  <div class="console__field">
                    <label for={`field-${field.key}`}>
                      {field.label}
                      {field.optional ? ' (необязательно)' : ''}
                    </label>
                    <Show
                      when={field.kind === 'token' || field.kind === 'select'}
                      fallback={
                        <input
                          autocomplete="off"
                          id={`field-${field.key}`}
                          value={values()[field.key]}
                          aria-invalid={!!errors()[field.key]}
                          aria-describedby={`hint-${field.key}`}
                          maxLength={field.key === 'uri' ? 2048 : 160}
                          type={
                            field.kind === 'datetime-local'
                              ? 'datetime-local'
                              : 'text'
                          }
                          onInput={event =>
                            setValues({
                              ...values(),
                              [field.key]: event.currentTarget.value,
                            })
                          }
                          inputmode={
                            field.kind === 'decimal'
                              ? 'decimal'
                              : field.kind === 'integer'
                                ? 'numeric'
                                : 'text'
                          }
                        />
                      }
                    >
                      <select
                        id={`field-${field.key}`}
                        value={values()[field.key]}
                        aria-describedby={`hint-${field.key}`}
                        onChange={event =>
                          setValues({
                            ...values(),
                            [field.key]: event.currentTarget.value,
                          })
                        }
                      >
                        <For
                          each={
                            field.kind === 'token'
                              ? props.session.config.tokens.map(item => ({
                                  value: item.symbol,
                                  label: item.symbol,
                                }))
                              : field.options
                          }
                        >
                          {option => (
                            <option value={option.value}>{option.label}</option>
                          )}
                        </For>
                      </select>
                    </Show>
                    <small
                      id={`hint-${field.key}`}
                      classList={{
                        'console__field-error': !!errors()[field.key],
                      }}
                    >
                      {errors()[field.key] || field.hint}
                    </small>
                  </div>
                )}
              </For>
            </div>
            <Show when={props.draft.kind === 'fund.fundShift'}>
              <DataState remote={last}>
                <Show when={last.data()}>
                  {closed => (
                    <div class="console__funding-total">
                      <span>
                        {units(closed().oreAmount)} ORE ×{' '}
                        {values().price || '…'}
                      </span>
                      <strong>
                        {funding()} {dollar()?.symbol}
                      </strong>
                      <small>
                        Предварительный расчёт. Итоговую сумму подтвердит
                        сервер.
                      </small>
                    </div>
                  )}
                </Show>
              </DataState>
            </Show>
            <div class="console__field">
              <label for="max-gas">Лимит газа всей операции, AVAX</label>
              <input
                id="max-gas"
                value={gas()}
                inputmode="decimal"
                aria-describedby="gas-hint"
                aria-invalid={!!errors().maxGasAvax}
                onInput={event => setGas(event.currentTarget.value)}
              />
              <small
                id="gas-hint"
                classList={{ 'console__field-error': !!errors().maxGasAvax }}
              >
                {errors().maxGasAvax ||
                  'Максимальный расход владельца на все шаги. Это лимит, а не оценка комиссии.'}
              </small>
            </div>
            <div class="console__dialog-footer">
              <span>Следующий шаг — проверка плана.</span>
              <button
                type="submit"
                disabled={busy() || !props.session.ready()}
                class="console__button console__button--primary"
              >
                {busy() ? 'Подготовка плана…' : 'Проверить операцию'}
                <Icon tone="light" name="arrow-right" />
              </button>
            </div>
          </form>
        }
      >
        {plan => (
          <>
            <div
              class="console__notice"
              classList={{ 'console__notice--danger': !remaining() }}
            >
              <b>
                {remaining()
                  ? `План действует ещё ${Math.floor(remaining() / 60)}:${String(remaining() % 60).padStart(2, '0')}`
                  : 'Срок плана истёк'}
              </b>
              <span> · до {dateTime(plan().expiresAt)}</span>
            </div>
            <h3>Параметры запроса</h3>
            <RequestDetails request={plan().request} />
            <h3>Расчёт сервера</h3>
            <PlanDetails
              summary={plan().summary}
              config={props.session.config}
            />
            <h3>Шаги операции</h3>
            <ol class="console__steps">
              <For each={plan().steps}>
                {step => (
                  <li>
                    <div class="console__section-heading">
                      <b>{stepLabels[step.code] ?? step.code}</b>
                      <span>
                        {step.gasEstimate.status === 'requires_prior_steps'
                          ? 'Оценка после предыдущих шагов'
                          : step.gasEstimate.status === 'skipped'
                            ? 'Не требуется'
                            : `${units(step.gasEstimate.maxGasWei ?? '0')} AVAX`}
                      </span>
                    </div>
                    <Show when={step.approval}>
                      {approval => (
                        <ApprovalDetails
                          approval={approval()}
                          config={props.session.config}
                        />
                      )}
                    </Show>
                  </li>
                )}
              </For>
            </ol>
            <div class="console__funding-total">
              <span>
                {plan().gasEstimateComplete
                  ? 'Оценка комиссии'
                  : 'Известная часть комиссии'}
              </span>
              <strong>{decimal(plan().knownGasEstimateAvax)} AVAX</strong>
              <small>Лимит: {decimal(plan().request.maxGasAvax)} AVAX</small>
            </div>
            <Show when={!plan().gasEstimateComplete}>
              <div class="console__notice">
                Полная оценка станет доступна после предыдущих шагов.
                Неизвестная комиссия не равна нулю; лимит действует на всю
                операцию.
              </div>
            </Show>
            <p class="console__subtle">
              Подтверждённые транзакции не откатываются при ошибке последующих
              шагов. Закрытие страницы не останавливает исполнение.
            </p>
            <Show when={!uncertain()}>
              <label class="console__check">
                <input
                  type="checkbox"
                  checked={accepted()}
                  disabled={props.session.readOnly()}
                  onChange={event => setAccepted(event.currentTarget.checked)}
                />
                Я проверил параметры, разрешения и лимит газа.
              </label>
            </Show>
            <div class="console__dialog-footer">
              <Show when={!uncertain()}>
                <button
                  disabled={busy()}
                  class="console__button"
                  onClick={() => {
                    setPreview(undefined)
                    setAccepted(false)
                  }}
                >
                  Изменить параметры
                </button>
              </Show>
              <Show
                when={!remaining() && !uncertain()}
                fallback={
                  <button
                    onClick={() => void submit()}
                    class="console__button console__button--primary"
                    disabled={
                      busy() ||
                      !props.session.ready() ||
                      props.session.readOnly() ||
                      (!uncertain() && (!accepted() || !remaining()))
                    }
                  >
                    {busy()
                      ? 'Отправка…'
                      : uncertain()
                        ? 'Проверить отправку повторно'
                        : 'Подтвердить и выполнить'}
                  </button>
                }
              >
                <button
                  onClick={() => void prepare()}
                  disabled={busy() || !props.session.ready()}
                  class="console__button console__button--primary"
                >
                  Пересоздать план
                </button>
              </Show>
            </div>
            <details>
              <summary>Идентификатор плана</summary>
              <p class="console__mono">{plan().id}</p>
              <p>
                Комиссия в wei:{' '}
                {fromUnits(toUnits(plan().knownGasEstimateAvax, 18), 0)}
              </p>
            </details>
          </>
        )}
      </Show>
    </dialog>
  )
}
