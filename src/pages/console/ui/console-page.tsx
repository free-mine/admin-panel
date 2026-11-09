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
import { dateTime } from '../../../shared/lib/format'
import { request, ApiError } from '../../../shared/api'
import { readPending, savePending } from '../model/submission'
import type { Config, Operation, Readiness } from '../api/types'
import type { Session, ActionDraft, PendingSubmission } from '../model/types'

const navigation = [
  { id: 'fund', icon: 'fund', title: 'Фонд' },
  { id: 'capital', icon: 'wallet', title: 'Капитал' },
  { id: 'operations', title: 'Операции', icon: 'operations' },
  { id: 'successors', title: 'Преемники', icon: 'successors' },
]

export function ConsolePage() {
  const [route, setRoute] = createSignal(
    window.location.hash.slice(1) || 'fund',
  )
  const [menu, setMenu] = createSignal(false)
  const endpoint = window.location.origin
  const [session, setSession] = createSignal<Session>()
  const [ready, setReady] = createSignal(false)
  const [readOnly, setReadOnly] = createSignal(true)
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
    url.hostname = 'localhost'
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
      const result = await request<Readiness>(current.endpoint, '/ready')
      if (version !== generation || check !== readinessGeneration || disposed) {
        return
      }
      if (result.status !== 'ready' || typeof result.readOnly !== 'boolean') {
        throw new Error('Сервер не подтвердил готовность.')
      }
      setReadOnly(result.readOnly)
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
  async function connect() {
    if (checking()) {
      return
    }
    const base = endpoint
    const version = ++generation
    setChecking(true)
    setReady(false)
    setConnectionError('')
    setDraft(undefined)
    stopSocket()
    try {
      const results = await Promise.allSettled([
        request<{ status: string }>(base, '/health'),
        request<Readiness>(base, '/ready'),
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
        typeof config.value.readOnly !== 'boolean' ||
        typeof readiness.value.readOnly !== 'boolean' ||
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
        readOnly,
        revision,
        endpoint: base,
        config: config.value,
      }
      setSession(current)
      setReadOnly(config.value.readOnly || readiness.value.readOnly)
      setReady(true)
      setCheckedAt(Date.now())
      startSocket(current, version)
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
      readOnly() ||
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
        cause.detail.code !== 'READ_ONLY' &&
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
    healthTimer = setInterval(() => {
      const current = session()
      if (current) {
        void checkReadiness(current, generation)
      } else {
        void connect()
      }
    }, 15000)
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
            ● {ready() ? 'Сервер подключён' : 'Нет подключения'}
          </span>
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
          <Show when={session() && readOnly()}>
            <div role="status" class="console__notice">
              <b>Режим только чтения</b>
              <p>
                Можно просматривать данные и проверять планы операций.
                Выполнение доступно после запуска сервера с ключом владельца.
              </p>
            </div>
          </Show>
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
                disabled={
                  recovering() ||
                  !ready() ||
                  readOnly() ||
                  !!draft() ||
                  pending()?.endpoint !== endpoint
                }
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
          <Show
            keyed
            when={session()}
            fallback={
              <section role="status" class="console__empty">
                <h1>
                  {checking() ? 'Подключаемся к серверу…' : 'Сервер недоступен'}
                </h1>
                <p>{connectionError() || 'Ожидаем ответа сервера.'}</p>
                <p>Подключение восстанавливается автоматически.</p>
                <button
                  disabled={checking()}
                  class="console__button"
                  onClick={() => void connect()}
                >
                  Повторить
                </button>
              </section>
            }
          >
            {current => (
              <>
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
              </>
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
