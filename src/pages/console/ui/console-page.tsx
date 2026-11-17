import { For, Show, onMount, untrack, onCleanup, createSignal } from 'solid-js'

import { Login } from './login'
import { Address } from './primitives'
import { FundView } from './fund-view'
import { CapitalView } from './capital-view'
import type { Operation } from '../api/types'
import { Icon } from '../../../shared/ui/icon'
import { errorMessage } from '../model/errors'
import { ActionDialog } from './action-dialog'
import { wordmark } from '../../../shared/assets'
import { SuccessorsView } from './successors-view'
import { OperationsView } from './operations-view'
import type { AuthenticationProps } from './types'
import { dateTime } from '../../../shared/lib/format'
import { createConnection } from '../model/connection'
import { createAuthentication } from '../model/authentication'
import type { ActionDraft, PendingSubmission } from '../model/types'
import {
  readPending,
  savePending,
  isSubmissionRejected,
} from '../model/submission'

const navigation = [
  { id: 'fund', icon: 'fund', title: 'Фонд' },
  { id: 'capital', icon: 'wallet', title: 'Капитал' },
  { id: 'operations', title: 'Операции', icon: 'operations' },
  { id: 'successors', title: 'Преемники', icon: 'successors' },
]

export function ConsolePage() {
  const authentication = createAuthentication(window.location.origin)
  return (
    <Show
      when={authentication.authenticated()}
      fallback={<Login authentication={authentication} />}
    >
      <ConsoleWorkspace authentication={authentication} />
    </Show>
  )
}

function ConsoleWorkspace(props: AuthenticationProps) {
  const [route, setRoute] = createSignal(
    window.location.hash.slice(1) || 'fund',
  )
  const [menu, setMenu] = createSignal(false)
  const endpoint = window.location.origin
  const {
    check,
    ready,
    session,
    readOnly,
    checking,
    checkedAt,
    socketStatus,
    connectionError,
  } = createConnection(
    endpoint,
    untrack(() => props.authentication.request),
    () => props.authentication.expire(),
  )
  const [draft, setDraft] = createSignal<ActionDraft>()
  const [pending, setPending] = createSignal(readPending())
  const [recovering, setRecovering] = createSignal(false)
  const [recoveryError, setRecoveryError] = createSignal('')
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
  function updatePending(value: PendingSubmission | undefined) {
    savePending(value)
    setPending(value)
  }
  function submitted(operation: Operation) {
    setDraft(undefined)
    navigate(`operations/${operation.id}`)
    session()?.refresh()
  }
  function openAction(value: ActionDraft) {
    if (ready() && !pending()) {
      setDraft(value)
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
      const operation = await props.authentication.request<Operation>(
        '/v1/operations',
        { previewId: submission.previewId, requestId: submission.requestId },
      )
      updatePending(undefined)
      submitted(operation)
    } catch (cause) {
      if (isSubmissionRejected(cause)) {
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
    onCleanup(() => {
      window.removeEventListener('hashchange', listener)
      window.removeEventListener('storage', syncSubmission)
    })
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
            <button
              class="console__text-button"
              disabled={props.authentication.busy()}
              onClick={() => void props.authentication.logout()}
            >
              Выйти
            </button>
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
          <Show when={props.authentication.error()}>
            <div role="alert" class="console__notice console__notice--danger">
              {props.authentication.error()}
            </div>
          </Show>
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
                disabled={checking()}
                class="console__text-button"
                onClick={() => void check()}
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
                  onClick={() => void check()}
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
