import { iconUrls } from '../../assets'
import type { IconProps } from './icon.types'

export function Icon(props: IconProps) {
  return (
    <img
      alt=""
      width="20"
      height="20"
      class="icon"
      aria-hidden="true"
      src={iconUrls[`./icons/${props.name}.svg`]}
      classList={{
        'icon--light': props.tone === 'light',
        'icon--large': props.size === 'large',
      }}
    />
  )
}
