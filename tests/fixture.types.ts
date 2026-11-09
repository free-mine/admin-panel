import type {
  Preview,
  Operation,
  PreviewRequest,
} from '../src/pages/console/api/types'

export interface MockState {
  ttl: number
  ready: boolean
  loseSubmit: boolean
  connections: number
  changedPlan: boolean
  snapshot: () => void
  balanceError: boolean
  disconnect: () => void
  incompleteGas: boolean
  operations: Operation[]
  previews: PreviewRequest[]
  plans: Map<string, Preview>
  submissions: { previewId: string; requestId: string }[]
}
