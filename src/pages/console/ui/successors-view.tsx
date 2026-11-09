import { For, Show } from 'solid-js'

import type { Successors } from '../api/types'
import { createRemote } from '../model/remote'
import type { ViewProps } from '../model/types'
import { Address, DataState } from './primitives'
import { dateTime } from '../../../shared/lib/format'

export function SuccessorsView(props: ViewProps) {
  const data = createRemote<Successors>(
    () => props.session,
    () => '/v1/successors',
  )
  return (
    <>
      <header class="console__page-heading">
        <div>
          <h1>Преемники</h1>
          <p>Расписание получения полномочий OreVein.</p>
        </div>
        <button
          disabled={!props.session.ready()}
          class="console__button console__button--primary"
          onClick={() => props.onAction({ kind: 'successor.schedule' })}
        >
          Назначить преемника
        </button>
      </header>
      <div class="console__notice">
        В назначенное время преемник сможет запросить права администратора.
        Получение прав не происходит автоматически.
      </div>
      <DataState remote={data}>
        <Show when={data.data()}>
          {snapshot => (
            <>
              <div class="console__stack">
                <For each={snapshot().successors}>
                  {item => (
                    <section class="console__panel">
                      <div class="console__section-heading">
                        <Address full value={item.address} />
                        <span
                          class="console__badge"
                          classList={{
                            'console__badge--success': item.eligible,
                          }}
                        >
                          {item.eligible
                            ? 'Доступно получение прав'
                            : 'Запланирован'}
                        </span>
                      </div>
                      <p>{dateTime(item.timestamp * 1000)}</p>
                      <div class="console__actions">
                        <button
                          class="console__button"
                          disabled={!props.session.ready() || !!data.error()}
                          onClick={() =>
                            props.onAction({
                              kind: 'successor.schedule',
                              values: { address: item.address },
                            })
                          }
                        >
                          Перенести дату
                        </button>
                        <button
                          class="console__text-button"
                          disabled={!props.session.ready() || !!data.error()}
                          onClick={() =>
                            props.onAction({
                              kind: 'successor.remove',
                              values: { address: item.address },
                            })
                          }
                        >
                          Удалить преемника
                        </button>
                      </div>
                    </section>
                  )}
                </For>
              </div>
              <Show when={!snapshot().successors.length}>
                <div class="console__empty">
                  Преемники пока не назначены.
                  <small>
                    Добавьте адрес и дату получения права на полномочия.
                  </small>
                </div>
              </Show>
              <p class="console__freshness">
                Состояние на блоке {snapshot().block} ·{' '}
                {dateTime(snapshot().blockTimestamp * 1000)}
              </p>
            </>
          )}
        </Show>
      </DataState>
    </>
  )
}
