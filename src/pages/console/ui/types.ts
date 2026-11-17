import type { Balances } from '../api/types'
import type { RemoteData, Authentication } from '../model/types'

export interface AuthenticationProps {
  authentication: Authentication
}

export interface BalanceStripProps {
  oreVein: string
  expanded?: boolean
  remote: RemoteData<Balances>
}

export interface AddressProps {
  value: string
  full?: boolean
  transaction?: boolean
}
export interface CopyButtonProps {
  value: string
  label?: string
}
export interface AmountProps {
  value: string
}
export interface PagerProps {
  offset: number
  label?: string
  loading?: boolean
  total: string | number
  onChange: (offset: number) => void
}
export interface TabsProps {
  value: string
  label: string
  onChange: (value: string) => void
  items: { id: string; label: string }[]
}
