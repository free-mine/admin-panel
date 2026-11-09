import { For, Show, onMount, onCleanup, createSignal } from 'solid-js'

import { Address } from './primitives'
import { FundView } from './fund-view'
import { CapitalView } from './capital-view'
import { Icon } from '../../../shared/ui/icon'
import { errorMessage } from '../model/errors'
import { ActionDialog } from './action-dialog'
import { wordmark } from '../../../shared/assets'
import { SuccessorsView } from './successors-view'
import { OperationsView } from './operations-view'
import type { Config, Operation } from '../api/types'
import { dateTime } from '../../../shared/lib/format'
import { request, ApiError, normalizeEndpoint } from '../../../shared/api'
import type { Session, ActionDraft, PendingSubmission } from '../model/types'
import {
  readPending,
  savePending,
  saveEndpoint,
  savedEndpoint,
} from '../model/submission'

const navigation = [
  { id: 'fund', icon: 'fund', title: 'Фонд' },
  { id: 'capital', icon: 'wallet', title: 'Капитал' },
  { id: 'operations', title: 'Операции', icon: 'operations' },
  { id: 'successors', title: 'Преемники', icon: 'successors' },
  { id: 'connection', icon: 'settings', title: 'Подключение' },
]

export function ConsolePage() {
  const [route, setRoute] = createSignal(
    window.location.hash.slice(1) || 'fund',
  )
  const [menu, setMenu] = createSignal(false)
  const [endpoint, setEndpoint] = createSignal(savedEndpoint())
  const [session, setSession] = createSignal<Session>()
  const [ready, setReady] = createSignal(false)
  const [revision, setRevision] = createSignal(0)
  const [checking, setChecking] = createSignal(false)
  const [checkedAt, setCheckedAt] = createSignal<number>()
  const [connectionError, setConnectionError] = createSignal('')
  const [socketStatus, setSocketStatus] = createSignal('Ожидание подключения')
  const [draft, setDraft] = createSignal<ActionDraft>()
  const [pending, setPending] = createSignal(readPending())
  const [recovering, setRecovering] = createSignal(false)
  const [recoveryError, setRecoveryError] = createSignal('')
  let generation = 0
  let readinessGeneration = 0
  let readinessInFlight: number | undefined
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let healthTimer: ReturnType<typeof setInterval> | undefined
  let disposed = false
  const section = () =>
    navigation.some(item => item.id === route().split('/')[0])
      ? route().split('/')[0]
      : 'fund'
  const selectedOperation = () =>
    /^[\da-f-]{36}$/i.test(route().split('/')[1] ?? '')
      ? route().split('/')[1]
      : ''
  const connectionVisible = () => !session() || section() === 'connection'
  function navigate(value: string) {
    window.location.hash = value
    setRoute(value)
    setMenu(false)
  }
  function refresh() {
    setRevision(value => value + 1)
  }
  function updatePending(value: PendingSubmission | undefined) {
    savePending(value)
    setPending(value)
  }
  function submitted(operation: Operation) {
    setDraft(undefined)
    navigate(`operations/${operation.id}`)
    refresh()
  }
  function openAction(value: ActionDraft) {
    if (ready() && !pending()) {
      setDraft(value)
    }
  }
  function stopSocket() {
    clearTimeout(retry)
    if (socket) {
      socket.onclose = null
      socket.close()
      socket = undefined
    }
  }
  function startSocket(current: Session, version: number) {
    if (disposed || version !== generation) {
      return
    }
    const url = new URL(current.config.websocket, current.endpoint)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const activeSocket = new WebSocket(url)
    socket = activeSocket
    socket.onopen = () => {
      if (version === generation) {
        setSocketStatus('Обновления в реальном времени')
      }
    }
    socket.onmessage = event => {
      if (version !== generation) {
        return
      }
      try {
        const message = JSON.parse(String(event.data))
        if (
          message.type === 'operations.snapshot' ||
          message.type === 'operation.updated'
        ) {
          refresh()
        }
      } catch {
        setSocketStatus(
          'Не удалось прочитать событие; периодическое обновление активно',
        )
      }
    }
    socket.onerror = () => activeSocket.close()
    socket.onclose = () => {
      if (disposed || version !== generation) {
        return
      }
      setSocketStatus('События недоступны · обновление каждые 15 с')
      retry = setTimeout(() => startSocket(current, version), 5000)
    }
  }
  async function checkReadiness(current: Session, version: number) {
    if (readinessInFlight === version) {
      return
    }
    readinessInFlight = version
    const check = ++readinessGeneration
    try {
      const result = await request<{ status: string }>(
        current.endpoint,
        '/ready',
      )
      if (version !== generation || check !== readinessGeneration || disposed) {
        return
      }
      if (result.status !== 'ready') {
        throw new Error('Сервер не подтвердил готовность.')
      }
      setReady(true)
      setConnectionError('')
      setCheckedAt(Date.now())
    } catch (cause) {
      if (
        version === generation &&
        check === readinessGeneration &&
        !disposed
      ) {
        setReady(false)
        setConnectionError(errorMessage(cause))
      }
    }
    if (readinessInFlight === version) {
      readinessInFlight = undefined
    }
    if (version === generation && !disposed) {
      refresh()
    }
  }
  async function connect(event?: SubmitEvent) {
    event?.preventDefault()
    if (checking()) {
      return
    }
    let base: string
    try {
      base = normalizeEndpoint(endpoint())
    } catch (cause) {
      setConnectionError(errorMessage(cause))
      return
    }
    if (pending() && pending()?.endpoint !== base) {
      setConnectionError(
        'Сначала проверьте отправку операции на предыдущем сервере.',
      )
      return
    }
    const version = ++generation
    setChecking(true)
    setReady(false)
    setConnectionError('')
    setDraft(undefined)
    stopSocket()
    clearInterval(healthTimer)
    try {
      const results = await Promise.allSettled([
        request<{ status: string }>(base, '/health'),
        request<{ status: string }>(base, '/ready'),
        request<Config>(base, '/v1/config'),
      ])
      if (version !== generation || disposed) {
        return
      }
      const failure = results.find(result => result.status === 'rejected')
      if (failure?.status === 'rejected') {
        throw failure.reason
      }
      const [health, readiness, config] = results
      if (
        health.status !== 'fulfilled' ||
        readiness.status !== 'fulfilled' ||
        config.status !== 'fulfilled'
      ) {
        return
      }
      if (health.value.status !== 'ok' || readiness.value.status !== 'ready') {
        throw new Error('Сервер не подтвердил готовность.')
      }
      if (
        config.value.chainId !== 43114 ||
        !Array.isArray(config.value.tokens) ||
        !config.value.addresses?.oreVein ||
        config.value.websocket !== '/v1/ws'
      ) {
        throw new Error(
          'Неподдерживаемая конфигурация API. Требуется Avalanche C-Chain (43114).',
        )
      }
      const current: Session = {
        ready,
        refresh,
        revision,
        endpoint: base,
        config: config.value,
      }
      setSession(current)
      setReady(true)
      setCheckedAt(Date.now())
      setEndpoint(base)
      saveEndpoint(base)
      startSocket(current, version)
      healthTimer = setInterval(
        () => void checkReadiness(current, version),
        15000,
      )
      if (event) {
        navigate('fund')
      }
    } catch (cause) {
      if (!disposed && version === generation) {
        setConnectionError(errorMessage(cause))
      }
    } finally {
      if (!disposed && version === generation) {
        setChecking(false)
      }
    }
  }
  async function recover() {
    const submission = pending()
    if (
      !submission ||
      recovering() ||
      !ready() ||
      submission.endpoint !== session()?.endpoint
    ) {
      return
    }
    setRecovering(true)
    setRecoveryError('')
    try {
      const operation = await request<Operation>(
        submission.endpoint,
        '/v1/operations',
        { previewId: submission.previewId, requestId: submission.requestId },
      )
      updatePending(undefined)
      submitted(operation)
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500
      ) {
        updatePending(undefined)
      }
      setRecoveryError(errorMessage(cause))
    } finally {
      setRecovering(false)
    }
  }
  onMount(() => {
    const listener = () => {
      setRoute(window.location.hash.slice(1) || 'fund')
      setMenu(false)
    }
    window.addEventListener('hashchange', listener)
    const syncSubmission = () => setPending(readPending())
    window.addEventListener('storage', syncSubmission)
    void connect()
    onCleanup(() => {
      window.removeEventListener('hashchange', listener)
      window.removeEventListener('storage', syncSubmission)
    })
  })
  onCleanup(() => {
    disposed = true
    generation++
    stopSocket()
    clearInterval(healthTimer)
  })
  return (
    <div class="console">
      <a
        href="#main-content"
        class="console__skip"
        onClick={event => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        К содержимому
      </a>
      <aside
        class="console__sidebar"
        classList={{ 'console__sidebar--open': menu() }}
      >
        <a href="#fund" class="console__brand" aria-label="Free Mine — фонд">
          <img width="166" height="36" src={wordmark} alt="free mine" />
        </a>
        <p class="console__eyebrow">Панель владельца</p>
        <nav aria-label="Основная навигация">
          <For each={navigation}>
            {item => (
              <a
                href={`#${item.id}`}
                class="console__nav-item"
                onClick={() => setMenu(false)}
                aria-current={section() === item.id ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                {item.title}
              </a>
            )}
          </For>
        </nav>
        <Show when={session()}>
          {current => (
            <div class="console__contract">
              <p class="console__eyebrow">Контракт OreVein</p>
              <Address value={current().config.addresses.oreVein} />
            </div>
          )}
        </Show>
        <div class="console__server">
          <span classList={{ console__online: ready() }}>
            ● {ready() ? 'Сервер готов' : 'Нет подключения'}
          </span>
          <small class="console__mono">
            {session()?.endpoint ?? endpoint()}
          </small>
        </div>
      </aside>
      <div class="console__workspace">
        <header class="console__topbar">
          <button
            aria-expanded={menu()}
            aria-label="Открыть навигацию"
            onClick={() => setMenu(!menu())}
            class="console__menu-button console__icon-button"
          >
            <Icon name={menu() ? 'close' : 'menu'} />
          </button>
          <div class="console__breadcrumb">
            Рабочее пространство <span>/</span> <b>OreVein</b>
          </div>
          <div class="console__row">
            <span class="console__network">Avalanche C-Chain</span>
            <Show when={session()}>
              {current => <Address value={current().config.owner} />}
            </Show>
            <span
              class="console__connection-dot"
              title={ready() ? 'Сервер готов' : 'Нет связи'}
              classList={{ 'console__connection-dot--online': ready() }}
            />
          </div>
        </header>
        <main tabIndex={-1} id="main-content" class="console__main">
          <Show when={session() && !ready()}>
            <div role="alert" class="console__notice console__notice--danger">
              {connectionError() || 'Проверяем подключение…'} Новые операции
              заблокированы. Последние данные сохранены на экране.
              <button
                class="console__text-button"
                onClick={() => {
                  const current = session()
                  if (current) {
                    void checkReadiness(current, generation)
                  }
                }}
              >
                Проверить связь
              </button>
            </div>
          </Show>
          <Show when={pending()}>
            <div role="status" class="console__notice">
              <b>Требуется проверить отправку операции</b>
              <p>
                Ответ мог потеряться. Повторная отправка использует прежний
                requestId; новая операция не создаётся.
              </p>
              <p class="console__mono">{pending()?.endpoint}</p>
              <button
                class="console__button"
                onClick={() => void recover()}
                disabled={recovering() || !ready() || !!draft()}
              >
                {recovering() ? 'Проверка…' : 'Проверить отправку'}
              </button>
            </div>
          </Show>
          <Show when={recoveryError()}>
            <div role="alert" class="console__notice console__notice--danger">
              {recoveryError()}
            </div>
          </Show>
          <Show when={connectionVisible()}>
            <header class="console__page-heading">
              <div>
                <p class="console__eyebrow">Локальное рабочее пространство</p>
                <h1>Подключение</h1>
                <p>Ваш сервер. Ваши контракты. Ваш капитал.</p>
              </div>
            </header>
            <div class="console__connection-layout">
              <section class="console__panel">
                <h2>Сервер владельца</h2>
                <p>
                  Подключите панель к экземпляру Free Mine в Avalanche C-Chain.
                </p>
                <form onSubmit={event => void connect(event)}>
                  <div class="console__field">
                    <label for="api-endpoint">Адрес API</label>
                    <input
                      required
                      type="url"
                      id="api-endpoint"
                      value={endpoint()}
                      aria-describedby="endpoint-hint"
                      placeholder="http://127.0.0.1:5175"
                      onInput={event => setEndpoint(event.currentTarget.value)}
                    />
                    <small id="endpoint-hint">
                      В Docker Compose используется адрес самой панели. Другой
                      сервер должен разрешать origin {window.location.origin}.
                    </small>
                  </div>
                  <Show when={connectionError()}>
                    <p role="alert" class="console__field-error">
                      {connectionError()}
                    </p>
                  </Show>
                  <button
                    type="submit"
                    disabled={checking()}
                    class="console__button console__button--primary"
                  >
                    {checking()
                      ? 'Проверяем сервер…'
                      : ready()
                        ? 'Проверить подключение'
                        : 'Подключиться'}
                    <Icon tone="light" name="arrow-right" />
                  </button>
                </form>
              </section>
              <section class="console__connection-notes">
                <div class="console__connection-icon">
                  <Icon size="large" name="server" />
                </div>
                <h2>Ключ остаётся на сервере</h2>
                <p>
                  Приватный ключ и RPC URL задаются в окружении бекенда. Панель
                  получает публичные адреса и отправляет подтверждённые планы
                  операций.
                </p>
                <div class="console__check-row">
                  <Icon name="check" />
                  <span>Проверка сети и владельца</span>
                </div>
                <div class="console__check-row">
                  <Icon name="check" />
                  <span>Проверка контрактов и журнала</span>
                </div>
                <div class="console__check-row">
                  <Icon name="check" />
                  <span>Отдельное подтверждение каждой операции</span>
                </div>
              </section>
            </div>
            <Show when={session()}>
              {current => (
                <section class="console__panel">
                  <div class="console__section-heading">
                    <h2>Публичная конфигурация</h2>
                    <span class="console__badge">
                      Chain ID {current().config.chainId}
                    </span>
                  </div>
                  <dl class="console__details">
                    <dt>Владелец · оплачивает газ</dt>
                    <dd>
                      <Address full value={current().config.owner} />
                    </dd>
                    <For each={Object.entries(current().config.addresses)}>
                      {([label, value]) => (
                        <>
                          <dt>{label}</dt>
                          <dd>
                            <Address full value={value} />
                          </dd>
                        </>
                      )}
                    </For>
                    <dt>Срок плана</dt>
                    <dd>{current().config.previewTtlSeconds} с</dd>
                  </dl>
                </section>
              )}
            </Show>
          </Show>
          <Show keyed when={session()}>
            {current => (
              <Show when={!connectionVisible()}>
                <Show when={section() === 'fund'}>
                  <FundView session={current} onAction={openAction} />
                </Show>
                <Show when={section() === 'capital'}>
                  <CapitalView session={current} onAction={openAction} />
                </Show>
                <Show when={section() === 'successors'}>
                  <SuccessorsView session={current} onAction={openAction} />
                </Show>
                <Show when={section() === 'operations'}>
                  <OperationsView
                    session={current}
                    selectedId={selectedOperation()}
                    onSelect={id =>
                      navigate(id ? `operations/${id}` : 'operations')
                    }
                  />
                </Show>
              </Show>
            )}
          </Show>
          <footer class="console__footer">
            <span>
              {checkedAt()
                ? `Готовность проверена: ${dateTime(checkedAt() ?? 0)}`
                : 'Ожидание готовности сервера'}
            </span>
            <span>{socketStatus()}</span>
          </footer>
        </main>
      </div>
      <Show keyed when={draft()}>
        {value => (
          <Show when={session()}>
            {current => (
              <ActionDialog
                draft={value}
                session={current()}
                onSubmitted={submitted}
                onPending={updatePending}
                onClose={() => setDraft(undefined)}
              />
            )}
          </Show>
        )}
      </Show>
    </div>
  )
}
