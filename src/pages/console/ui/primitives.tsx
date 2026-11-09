import type { JSX } from 'solid-js'
import { For, Show, createSignal } from 'solid-js'

import { Icon } from '../../../shared/ui/icon'
import { statusLabels } from '../model/actions'
import type { RemoteData } from '../model/types'
import type { TabsProps, PagerProps, AddressProps } from './types'
import { dateTime, shortAddress } from '../../../shared/lib/format'

export function Address(props: AddressProps) {
  const [copied, setCopied] = createSignal(false)
  const [copyError, setCopyError] = createSignal(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }
  return (
    <span class="console__address">
      <a
        target="_blank"
        rel="noreferrer"
        title={props.value}
        href={`https://snowtrace.io/${props.transaction ? 'tx' : 'address'}/${props.value}`}
        classList={{
          'console__mono': true,
          'console__address--full': props.full,
        }}
      >
        {props.full ? props.value : shortAddress(props.value)}
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        class="console__icon-button"
        title={copied() ? 'Скопировано' : `Скопировать ${props.value}`}
        aria-label={copied() ? 'Скопировано' : `Скопировать ${props.value}`}
      >
        <Icon name={copied() ? 'check' : 'copy'} />
      </button>
      <Show when={copyError()}>
        <small role="status">Скопируйте адрес из ссылки.</small>
      </Show>
    </span>
  )
}

export function Status(props: { value: string }) {
  return (
    <span
      class="console__badge"
      classList={{
        'console__badge--danger': props.value === 'failed',
        'console__badge--success': ['succeeded', 'confirmed', 'ready'].includes(
          props.value,
        ),
        'console__badge--warning': [
          'needs_attention',
          'waiting',
          'queued',
        ].includes(props.value),
      }}
    >
      {statusLabels[props.value] ?? props.value}
    </span>
  )
}

export function DataState<T>(props: {
  remote: RemoteData<T>
  children?: JSX.Element
}) {
  return (
    <>
      <Show when={props.remote.error()}>
        <div role="alert" class="console__notice console__notice--danger">
          {props.remote.error()}{' '}
          <button
            class="console__text-button"
            onClick={() => void props.remote.refresh()}
          >
            Повторить
          </button>
        </div>
      </Show>
      <Show when={props.remote.loading() && !props.remote.data()}>
        <div role="status" class="console__empty">
          Загрузка данных…
        </div>
      </Show>
      <Show when={props.remote.updated() && props.remote.error()}>
        <p class="console__freshness">
          {props.remote.error() ? 'Последний успешный снимок' : 'Обновлено'}:{' '}
          {dateTime(props.remote.updated() ?? 0)}
          {props.remote.loading() ? ' · обновление…' : ''}
        </p>
      </Show>
      {props.children}
    </>
  )
}

export function Tabs(props: TabsProps) {
  return (
    <div role="group" class="console__tabs" aria-label={props.label}>
      <For each={props.items}>
        {item => (
          <button
            class="console__tab"
            aria-pressed={props.value === item.id}
            onClick={() => props.onChange(item.id)}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  )
}

export function Pager(props: PagerProps) {
  return (
    <div class="console__pager">
      <span>
        {props.label ??
          `Записи ${BigInt(props.total) === 0n ? 0 : props.offset + 1}–${BigInt(props.offset + 20) < BigInt(props.total) ? props.offset + 20 : props.total} из ${props.total}`}
      </span>
      <div class="console__row">
        <button
          class="console__icon-button"
          aria-label="Предыдущая страница"
          disabled={props.offset === 0 || props.loading}
          onClick={() => props.onChange(Math.max(0, props.offset - 20))}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          class="console__icon-button"
          aria-label="Следующая страница"
          onClick={() => props.onChange(props.offset + 20)}
          disabled={
            BigInt(props.offset + 20) >= BigInt(props.total) ||
            props.offset + 20 > 1000000 ||
            props.loading
          }
        >
          <Icon name="chevron-right" />
        </button>
      </div>
    </div>
  )
}
