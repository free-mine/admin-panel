import type { JSX } from 'solid-js'
import { For, Show, createSignal } from 'solid-js'

import { Icon } from '../../../shared/ui/icon'
import { statusLabels } from '../model/actions'
import type { RemoteData } from '../model/types'
import { dateTime, shortAddress } from '../../../shared/lib/format'
import type {
  TabsProps,
  PagerProps,
  AddressProps,
  CopyButtonProps,
} from './types'

export function CopyButton(props: CopyButtonProps) {
  const [copied, setCopied] = createSignal('')
  const [copyError, setCopyError] = createSignal('')
  const label = () =>
    copied() === props.value
      ? 'Скопировано'
      : (props.label ?? `Скопировать ${props.value}`)
  async function copy() {
    const value = props.value
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setCopyError('')
    } catch {
      setCopied('')
      setCopyError(value)
    }
  }
  return (
    <>
      <button
        type="button"
        title={label()}
        aria-label={label()}
        onClick={() => void copy()}
        class="console__icon-button"
      >
        <Icon name={copied() === props.value ? 'check' : 'copy'} />
      </button>
      <Show when={copyError() === props.value}>
        <small role="status" class="console__copy-error">
          Не удалось скопировать. Скопируйте вручную: {props.value}
        </small>
      </Show>
    </>
  )
}

export function Address(props: AddressProps) {
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
      <CopyButton value={props.value} />
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
