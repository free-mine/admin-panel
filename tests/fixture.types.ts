import type {
  Preview,
  Operation,
  PreviewRequest,
} from '../src/pages/console/api/types'

export interface MockState {
  ttl: number
  ready: boolean
  readOnly: boolean
  loginPins: string[]
  loseSubmit: boolean
  connections: number
  socketUrls: string[]
  changedPlan: boolean
  snapshot: () => void
  authenticated: boolean
  incompleteGas: boolean
  operations: Operation[]
  previews: PreviewRequest[]
  plans: Map<string, Preview>
  disconnect: (code?: number, reason?: string) => void
  submissions: { previewId: string; requestId: string }[]
}
