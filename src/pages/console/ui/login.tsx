import { Show, createSignal } from 'solid-js'

import { wordmark } from '../../../shared/assets'
import type { AuthenticationProps } from './types'

export function Login(props: AuthenticationProps) {
  const [pin, setPin] = createSignal('')
  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const value = pin()
    setPin('')
    await props.authentication.login(value)
  }
  return (
    <main class="console console__login">
      <section class="console__login-card" aria-labelledby="login-title">
        <img width="166" height="36" src={wordmark} alt="free mine" />
        <p class="console__eyebrow">Панель владельца</p>
        <h1 id="login-title">Вход в панель</h1>
        <Show
          fallback={<p role="status">Проверяем вход…</p>}
          when={props.authentication.authenticated() !== undefined}
        >
          <p class="console__subtle">Введите PIN-код для продолжения.</p>
          <form onSubmit={event => void submit(event)}>
            <div class="console__field">
              <label for="panel-pin">PIN-код</label>
              <input
                required
                minlength={4}
                value={pin()}
                id="panel-pin"
                maxlength={32}
                type="password"
                inputmode="numeric"
                pattern="[0-9]{4,32}"
                autocomplete="current-password"
                disabled={props.authentication.busy()}
                onInput={event => setPin(event.currentTarget.value)}
              />
            </div>
            <Show when={props.authentication.error()}>
              <p role="alert" class="console__field-error">
                {props.authentication.error()}
              </p>
            </Show>
            <button
              type="submit"
              class="console__button console__button--primary"
              disabled={
                props.authentication.busy() || !/^[0-9]{4,32}$/.test(pin())
              }
            >
              {props.authentication.busy() ? 'Проверка…' : 'Войти'}
            </button>
          </form>
        </Show>
      </section>
    </main>
  )
}
