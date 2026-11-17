import { onMount, onCleanup, createSignal } from 'solid-js'

import { errorMessage } from './errors'
import type { Config, Readiness } from '../api/types'
import type { Session, ConsoleRequest } from './types'

export function createConnection(
  endpoint: string,
  request: ConsoleRequest,
  onAuthRequired: () => void,
) {
  const [session, setSession] = createSignal<Session>()
  const [ready, setReady] = createSignal(false)
  const [readOnly, setReadOnly] = createSignal(true)
  const [revision, setRevision] = createSignal(0)
  const [checking, setChecking] = createSignal(false)
  const [checkedAt, setCheckedAt] = createSignal<number>()
  const [connectionError, setConnectionError] = createSignal('')
  const [socketStatus, setSocketStatus] = createSignal('Ожидание подключения')
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function refresh() {
    setRevision(value => value + 1)
  }

  function startSocket(config: Config) {
    const url = new URL(config.websocket, endpoint)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const activeSocket = new WebSocket(url)
    socket = activeSocket
    activeSocket.onopen = () => {
      setSocketStatus('Обновления в реальном времени')
    }
    activeSocket.onmessage = event => {
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
    activeSocket.onerror = () => activeSocket.close()
    activeSocket.onclose = event => {
      if (event.code === 1008 && event.reason === 'AUTH_REQUIRED') {
        onAuthRequired()
        return
      }
      setSocketStatus('События недоступны · обновление каждые 15 с')
      retry = setTimeout(() => startSocket(config), 5000)
    }
  }

  async function check() {
    if (checking() || disposed) {
      return
    }
    const current = session()
    setChecking(true)
    try {
      const readiness = await request<Readiness>('/ready')
      if (disposed) {
        return
      }
      if (
        readiness.status !== 'ready' ||
        typeof readiness.readOnly !== 'boolean'
      ) {
        throw new Error('Сервер не подтвердил готовность.')
      }
      if (!current) {
        const config = await request<Config>('/v1/config')
        if (disposed) {
          return
        }
        if (
          config.chainId !== 43114 ||
          typeof config.readOnly !== 'boolean' ||
          !Array.isArray(config.tokens) ||
          !config.addresses?.oreVein ||
          config.websocket !== '/v1/ws'
        ) {
          throw new Error(
            'Неподдерживаемая конфигурация API. Требуется Avalanche C-Chain (43114).',
          )
        }
        setSession({
          ready,
          config,
          refresh,
          request,
          endpoint,
          readOnly,
          revision,
        })
        setReadOnly(readiness.readOnly || config.readOnly)
        startSocket(config)
      } else {
        setReadOnly(readiness.readOnly)
      }
      setReady(true)
      setConnectionError('')
      setCheckedAt(Date.now())
    } catch (cause) {
      if (!disposed) {
        setReady(false)
        setConnectionError(errorMessage(cause))
      }
    } finally {
      if (!disposed) {
        setChecking(false)
        current?.refresh()
      }
    }
  }

  onMount(() => {
    void check()
    const timer = setInterval(() => void check(), 15000)
    onCleanup(() => clearInterval(timer))
  })
  onCleanup(() => {
    disposed = true
    clearTimeout(retry)
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      socket.close()
    }
  })

  return {
    check,
    ready,
    session,
    readOnly,
    checking,
    checkedAt,
    socketStatus,
    connectionError,
  }
}
