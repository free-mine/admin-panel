import { onMount, onCleanup, createSignal } from 'solid-js'

import { errorMessage } from './errors'
import type { Authentication } from './types'
import { request, ApiError } from '../../../shared/api'

export function createAuthentication(endpoint: string): Authentication {
  const [authenticated, setAuthenticated] = createSignal<boolean>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  let disposed = false
  let revision = 0

  async function check() {
    if (busy() || disposed) {
      return
    }
    setBusy(true)
    const current = revision
    try {
      const result = await authenticatedRequest<{ authenticated: boolean }>(
        '/v1/session',
      )
      if (!disposed && current === revision) {
        setAuthenticated(result.authenticated === true)
        setError('')
      }
    } catch (cause) {
      if (!disposed && current === revision) {
        setAuthenticated(value => value ?? false)
        setError(errorMessage(cause))
      }
    } finally {
      setBusy(false)
    }
  }

  async function login(pin: string) {
    if (busy()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await request<{ authenticated: boolean }>(
        endpoint,
        '/v1/session',
        { pin },
      )
      if (result.authenticated !== true) {
        throw new ApiError({ code: 'INVALID_RESPONSE' })
      }
      revision++
      setAuthenticated(true)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (busy()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await request(endpoint, '/v1/session/logout', {})
      revision++
      setAuthenticated(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function authenticatedRequest<T>(path: string, body?: unknown) {
    const current = revision
    try {
      return await request<T>(endpoint, path, body)
    } catch (cause) {
      if (
        current === revision &&
        cause instanceof ApiError &&
        ['AUTH_REQUIRED', 'DOMAIN_NOT_ALLOWED'].includes(cause.detail.code)
      ) {
        expire(cause)
      }
      throw cause
    }
  }

  function expire(cause: unknown = new ApiError({ code: 'AUTH_REQUIRED' })) {
    revision++
    setAuthenticated(false)
    setError(errorMessage(cause))
  }

  onMount(() => {
    void check()
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    onCleanup(() => window.removeEventListener('focus', onFocus))
  })
  onCleanup(() => {
    disposed = true
  })

  return {
    busy,
    error,
    check,
    login,
    logout,
    expire,
    authenticated,
    request: authenticatedRequest,
  }
}
