import type { Accessor } from 'solid-js'

import type { Config, Operation, ActionKind } from '../api/types'

export interface RemoteData<T> {
  error: Accessor<string>
  loading: Accessor<boolean>
  refresh: () => Promise<void>
  data: Accessor<T | undefined>
  updated: Accessor<number | undefined>
}
export interface Session {
  config: Config
  endpoint: string
  refresh: () => void
  request: ConsoleRequest
  ready: Accessor<boolean>
  revision: Accessor<number>
  readOnly: Accessor<boolean>
}
export type ConsoleRequest = <T>(path: string, body?: unknown) => Promise<T>

export interface Authentication {
  expire: () => void
  busy: Accessor<boolean>
  error: Accessor<string>
  request: ConsoleRequest
  check: () => Promise<void>
  logout: () => Promise<void>
  login: (pin: string) => Promise<void>
  authenticated: Accessor<boolean | undefined>
}
export interface ActionDraft {
  token0?: string
  token1?: string
  kind: ActionKind
  values?: Record<string, string>
}
export interface ViewProps {
  session: Session
  onAction: (draft: ActionDraft) => void
}
export interface PendingSubmission {
  endpoint: string
  previewId: string
  requestId: string
}
export interface OperationDetailProps {
  session: Session
  operation: Operation
}
export interface Field {
  key: string
  min?: number
  max?: number
  label: string
  hint?: string
  default?: string
  optional?: boolean
  options?: { value: string; label: string }[]
  kind:
    | 'token'
    | 'decimal'
    | 'integer'
    | 'address'
    | 'datetime-local'
    | 'text'
    | 'select'
}
export interface ActionDefinition {
  title: string
  fields: Field[]
  description: string
}
