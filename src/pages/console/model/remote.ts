import type { Accessor } from 'solid-js'
import { onCleanup, createEffect, createSignal } from 'solid-js'

import { errorMessage } from './errors'
import { request } from '../../../shared/api'
import type { Session, RemoteData } from './types'

// Keep the last successful snapshot on failure, but never reuse another query's data.
export function createRemote<T>(
  session: Accessor<Session>,
  path: () => string | undefined,
): RemoteData<T> {
  const [data, setData] = createSignal<T>()
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [updated, setUpdated] = createSignal<number>()
  let generation = 0
  let lastPath: string | undefined
  let inFlight = false
  let disposed = false
  async function refresh() {
    const url = path()
    // A slow RPC read must be allowed to finish between polling ticks.
    if (inFlight && url === lastPath) {
      return
    }
    const current = ++generation
    if (url !== lastPath) {
      setData(undefined)
      setUpdated(undefined)
      lastPath = url
    }
    if (!url) {
      inFlight = false
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    inFlight = true
    try {
      const result = await request<T>(session().endpoint, url)
      if (disposed || generation !== current) {
        return
      }
      setData(() => result)
      setUpdated(Date.now())
      setError('')
    } catch (cause) {
      if (!disposed && generation === current) {
        setError(errorMessage(cause))
      }
    } finally {
      if (!disposed && generation === current) {
        inFlight = false
        setLoading(false)
      }
    }
  }
  createEffect(() => {
    session().revision()
    void refresh()
  })
  onCleanup(() => {
    disposed = true
    generation++
  })
  return { data, error, loading, updated, refresh }
}
