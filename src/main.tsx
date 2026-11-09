import { render } from 'solid-js/web'

import { App } from './app/ui'
import './app/styles'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

render(() => <App />, root)
