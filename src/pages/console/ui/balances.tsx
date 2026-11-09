import { For, Show } from 'solid-js'

import type { Balances } from '../api/types'
import type { Session } from '../model/types'
import { createRemote } from '../model/remote'
import { Address, DataState } from './primitives'
import { tokenUrls } from '../../../shared/assets'
import { units, decimal } from '../../../shared/lib/format'

export function BalanceStrip(props: { session: Session; expanded?: boolean }) {
  const balances = createRemote<Balances>(
    () => props.session,
    () => '/v1/balances',
  )
  return (
    <section>
      <div class="console__section-heading">
        <h2>Капитал OreVein</h2>
        <Address value={props.session.config.addresses.oreVein} />
      </div>
      <DataState remote={balances}>
        <Show when={balances.data()}>
          {data => (
            <>
              <div class="console__assets">
                <For each={data().tokens}>
                  {token => (
                    <div class="console__asset">
                      <div class="console__row">
                        <img
                          alt=""
                          width="28"
                          height="28"
                          src={
                            tokenUrls[
                              `./tokens/${token.symbol === 'BTC.b' ? 'btcb' : token.symbol.toLowerCase()}.svg`
                            ]
                          }
                        />
                        <span>{token.symbol}</span>
                      </div>
                      <strong>{units(token.balance, token.decimals)}</strong>
                      <Show when={props.expanded}>
                        <Address value={token.address} />
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <Show when={props.expanded}>
                <div class="console__grid">
                  <div class="console__panel">
                    <p class="console__eyebrow">Нативный баланс OreVein</p>
                    <h2>{decimal(data().oreVeinAvax)} AVAX</h2>
                    <p>Средства контракта, отдельно от WAVAX.</p>
                  </div>
                  <div class="console__panel">
                    <p class="console__eyebrow">Газ владельца</p>
                    <h2>{decimal(data().ownerAvax)} AVAX</h2>
                    <Address value={data().owner} />
                    <p>Комиссии всех операций оплачивает владелец.</p>
                  </div>
                </div>
              </Show>
            </>
          )}
        </Show>
      </DataState>
    </section>
  )
}
