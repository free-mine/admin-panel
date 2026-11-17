import type { Accessor } from 'solid-js'
import { untrack, onCleanup, createEffect, createSignal } from 'solid-js'

import { errorMessage } from './errors'
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
  async function refresh() {
    const url = path()
    // A slow RPC read must be allowed to finish between polling ticks.
    if (untrack(loading) && url === lastPath) {
      return
    }
    const current = ++generation
    if (url !== lastPath) {
      setData(undefined)
      setUpdated(undefined)
      setError('')
      lastPath = url
    }
    if (!url) {
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    try {
      const result = await session().request<T>(url)
      if (generation !== current) {
        return
      }
      setData(() => result)
      setUpdated(Date.now())
      setError('')
    } catch (cause) {
      if (generation === current) {
        setError(errorMessage(cause))
      }
    } finally {
      if (generation === current) {
        setLoading(false)
      }
    }
  }
  createEffect(() => {
    session().revision()
    void refresh()
  })
  onCleanup(() => {
    generation++
  })
  return { data, error, loading, updated, refresh }
}
