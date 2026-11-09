export interface AddressProps {
  value: string
  full?: boolean
  transaction?: boolean
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
