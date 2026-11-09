import { CopyButton } from './primitives'
import type { AmountProps } from './types'
import { decimal } from '../../../shared/lib/format'

export function Amount(props: AmountProps) {
  const display = () => {
    const [whole, fraction = ''] = props.value.split('.')
    return decimal(`${whole}.${fraction.slice(0, 8)}`)
  }
  return (
    <span class="console__amount">
      <span title={props.value} class="console__amount-value">
        {display()}
      </span>
      <CopyButton
        value={props.value}
        label={`Скопировать точную сумму ${props.value}`}
      />
    </span>
  )
}
