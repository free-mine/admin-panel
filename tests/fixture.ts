import type { Page, WebSocketRoute } from '@playwright/test'

import type { MockState } from './fixture.types'
import { toUnits } from '../src/shared/lib/format'
import type {
  Fund,
  Config,
  Preview,
  Operation,
  PositionPage,
  PreviewRequest,
} from '../src/pages/console/api/types'

export const address = (suffix: number) =>
  `0x${String(suffix).padStart(40, '0')}`
export const config: Config = {
  chainId: 43114,
  readOnly: false,
  owner: address(1),
  websocket: '/v1/ws',
  previewTtlSeconds: 120,
  addresses: {
    aave: address(4),
    oreVein: address(2),
    freeMine: address(3),
    lfjRouter: address(5),
    lfjQuoter: address(6),
    uniswapFactory: address(7),
    uniswapPositionManager: address(8),
  },
  tokens: [
    { decimals: 6, symbol: 'USDT', address: address(11) },
    { decimals: 18, symbol: 'WAVAX', address: address(12) },
    { decimals: 6, symbol: 'USDC', address: address(13) },
    { decimals: 8, symbol: 'BTC.b', address: address(14) },
  ],
}
export const fund: Fund = {
  block: 98765,
  priceDecimals: 18,
  dollar: address(11),
  currentShiftId: '43',
  magicOre: address(15),
  priceUpdatedAt: 1700000000,
  nextPriceUpdateAt: 1700604800,
  contractURI: 'ipfs://free-mine',
  entryPrice: '1250000000000000000',
  minimumExitPrice: '1125000000000000000',
  maximumExitPrice: '1237500000000000000',
  minimumEntryPrice: '1200000000000000000',
  maximumEntryPrice: '1300000000000000000',
}

export async function mockApi(page: Page): Promise<MockState> {
  const sockets: WebSocketRoute[] = []
  const state: MockState = {
    ready: true,
    ttl: 120000,
    previews: [],
    loginPins: [],
    operations: [],
    connections: 0,
    socketUrls: [],
    readOnly: false,
    submissions: [],
    plans: new Map(),
    loseSubmit: false,
    changedPlan: false,
    authenticated: true,
    incompleteGas: false,
    disconnect: (code?: number, reason?: string) => {
      for (const socket of sockets.splice(0)) {
        socket.close({ code, reason })
      }
    },
    snapshot: () => {
      for (const socket of sockets) {
        socket.send(
          JSON.stringify({
            type: 'operations.snapshot',
            operations: state.operations,
          }),
        )
      }
    },
  }
  await page.routeWebSocket('**/v1/ws', socket => {
    state.connections++
    state.socketUrls.push(socket.url())
    sockets.push(socket)
    socket.send(
      JSON.stringify({
        type: 'operations.snapshot',
        operations: state.operations,
      }),
    )
  })
  await page.route(/\/(health|ready|v1\/.*)$/, async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const respond = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body })
    if (path === '/health') {
      return respond({ status: 'ok' })
    }
    if (path === '/v1/session') {
      if (route.request().method() === 'POST') {
        const { pin } = route.request().postDataJSON() as { pin: string }
        state.loginPins.push(pin)
        if (pin !== '012345') {
          return respond({ error: { code: 'INVALID_PIN' } }, 401)
        }
        state.authenticated = true
      }
      return respond({ authenticated: state.authenticated })
    }
    if (path === '/v1/session/logout') {
      state.authenticated = false
      return respond({ authenticated: false })
    }
    if (!state.authenticated) {
      return respond({ error: { code: 'AUTH_REQUIRED' } }, 401)
    }
    if (path === '/ready') {
      return state.ready
        ? respond({ status: 'ready', readOnly: state.readOnly })
        : respond(
            { status: 'unavailable', error: { code: 'SERVICE_NOT_READY' } },
            503,
          )
    }
    if (path === '/v1/config') {
      return respond({ ...config, readOnly: state.readOnly })
    }
    if (path === '/v1/journal') {
      return respond({ blocked: false })
    }
    if (path === '/v1/fund') {
      return respond(fund)
    }
    if (path === '/v1/balances') {
      const amounts = [
        '50000000000',
        '84600000000000000000',
        '12000000000',
        '12500000',
      ]
      return respond({
        oreVeinAvax: '0.2',
        owner: config.owner,
        ownerAvax: '0.8421',
        oreVein: config.addresses.oreVein,
        tokens: config.tokens.map((token, index) => ({
          ...token,
          balance: amounts[index],
        })),
      })
    }
    if (/\/shifts\/\d+\/claims/.test(path)) {
      const offset = Number(url.searchParams.get('offset') || 0)
      return respond({
        offset,
        limit: 20,
        block: 98765,
        totalIds: '41',
        shiftId: path.split('/')[4],
        claims:
          offset === 0
            ? [
                {
                  id: '1',
                  miner: address(31),
                  oreAmount: '4000000000000000000000',
                },
                {
                  id: '3',
                  miner: address(32),
                  oreAmount: '6000000000000000000000',
                },
              ]
            : offset === 20
              ? []
              : [
                  {
                    id: '41',
                    miner: address(33),
                    oreAmount: '1000000000000000000',
                  },
                ],
      })
    }
    if (/\/shifts\/\d+$/.test(path)) {
      const id = path.split('/').at(-1)
      return respond({
        id,
        block: 98765,
        closed: id !== '43',
        funded: id === '41',
        dollar: address(11),
        currentClaimId: '41',
        dollarScale: '1000000000000',
        oreAmount: '10000000000000000000000',
        fundedAt: id === '41' ? 1700000000 : 0,
        price: id === '41' ? '1200000000000000000' : '0',
        expireAvailableAt: id === '41' ? 1701209600 : null,
      })
    }
    if (path === '/v1/aave') {
      return respond({
        ltv: '7000',
        block: 98765,
        baseDecimals: 8,
        totalDebtBase: '0',
        healthFactor: null,
        healthFactorDecimals: 18,
        currentLiquidationThreshold: '8000',
        totalCollateralBase: '1000000000000',
        availableBorrowsBase: '700000000000',
        reserves: config.tokens.map(token => ({
          ...token,
          variableDebt: '0',
          supplied: '1000000',
          supplyRateRay: '20000000000000000000000000',
          variableBorrowRateRay: '40000000000000000000000000',
        })),
      })
    }
    if (path === '/v1/uniswap/positions') {
      const positions: PositionPage = {
        offset: 0,
        limit: 20,
        total: '2',
        positions: [
          {
            fee: 3000,
            inRange: true,
            tokenId: '123',
            currentPrice: '0.04',
            liquidity: '1000000',
            tokensOwedA: '2500000',
            tokenA: config.tokens[0],
            tokenB: config.tokens[1],
            tokensOwedB: '1000000000000000',
            range: {
              lowerPrice: '0.036',
              upperPrice: '0.0448',
              lowerDistancePercent: '10',
              upperDistancePercent: '12',
            },
          },
          { tokenId: '124', error: { code: 'UNSUPPORTED_TOKEN' } },
        ],
      }
      return respond(positions)
    }
    if (path === '/v1/successors') {
      return respond({
        block: 98765,
        blockTimestamp: 1800000000,
        successors: [
          { eligible: true, address: address(51), timestamp: 1800000000 },
        ],
      })
    }
    if (path === '/v1/previews') {
      const input = route.request().postDataJSON() as PreviewRequest
      state.previews.push(input)
      const id = `00000000-0000-4000-8000-${String(state.previews.length).padStart(12, '0')}`
      const preview: Preview = {
        id,
        request: input,
        knownGasEstimateAvax: '0.0018',
        expiresAt: Date.now() + state.ttl,
        gasEstimateComplete: !state.incompleteGas,
        steps: [
          {
            id: 0,
            code: 'EXECUTE',
            gasEstimate: {
              maxGasWei: state.incompleteGas ? null : '1800000000000000',
              status: state.incompleteGas
                ? 'requires_prior_steps'
                : 'estimated',
            },
          },
        ],
        summary:
          input.action.kind === 'fund.fundShift'
            ? {
                shiftId: '42',
                token: 'USDT',
                capitalHolder: address(2),
                price: '1200000000000000000',
                maximumFunding: '12000000000',
              }
            : input.action.kind === 'lfj.swap'
              ? {
                  tokenIn: 'USDT',
                  tokenOut: 'WAVAX',
                  amountIn: '1000000',
                  recipient: address(2),
                  quotedOut: '100000000000000000',
                  minimumOut: '99500000000000000',
                  route: [address(11), address(12)],
                }
              : input.action.kind === 'uniswap.mint'
                ? mintSummary(input)
                : { recipient: address(2), ...input.action.params },
      }
      state.plans.set(id, preview)
      return respond(preview, 201)
    }
    if (path === '/v1/operations' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        previewId: string
        requestId: string
      }
      state.submissions.push(body)
      const existing = state.operations.find(
        operation => operation.requestId === body.requestId,
      )
      if (existing) {
        return respond(existing)
      }
      if (state.changedPlan) {
        return respond({ error: { code: 'PLAN_CHANGED' } }, 400)
      }
      const plan = state.plans.get(body.previewId)
      if (!plan) {
        return respond({ error: { code: 'PREVIEW_NOT_FOUND' } }, 400)
      }
      if (plan.expiresAt <= Date.now()) {
        return respond({ error: { code: 'PREVIEW_EXPIRED' } }, 400)
      }
      const operation: Operation = {
        version: 1,
        status: 'succeeded',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        request: plan.request,
        summary: plan.summary,
        previewId: body.previewId,
        requestId: body.requestId,
        expiresAt: plan.expiresAt,
        maxGasWei: '5000000000000000',
        gasSpentWei: '1700000000000000',
        id: '00000000-0000-4000-9000-000000000001',
        steps: [
          {
            id: 0,
            code: 'EXECUTE',
            status: 'confirmed',
            transactionHash: `0x${'1'.repeat(64)}`,
            receipt: {
              status: 1,
              blockNumber: 98766,
              fee: '1700000000000000',
              hash: `0x${'1'.repeat(64)}`,
            },
          },
        ],
      }
      state.operations.push(operation)
      if (state.loseSubmit) {
        state.loseSubmit = false
        return route.abort()
      }
      return respond(operation, 202)
    }
    if (path === '/v1/operations') {
      return respond({
        offset: 0,
        limit: 20,
        operations: state.operations,
        total: state.operations.length,
      })
    }
    if (path.startsWith('/v1/operations/')) {
      const operation = state.operations.find(
        item => item.id === path.split('/')[3],
      )
      if (operation && path.endsWith('/resolve')) {
        operation.status = 'succeeded'
        operation.version++
        return respond(operation)
      }
      return operation
        ? respond(operation)
        : respond({ error: { code: 'NOT_FOUND' } }, 404)
    }
    return respond({ error: { code: 'UNHANDLED_TEST_ROUTE' } }, 500)
  })
  return state
}

function mintSummary(input: PreviewRequest) {
  const params = input.action.params
  const tokenA = config.tokens.find(token => token.symbol === params.tokenA)
  const tokenB = config.tokens.find(token => token.symbol === params.tokenB)
  if (!tokenA || !tokenB) {
    throw new Error('Unsupported mint fixture tokens')
  }
  const budgetA = toUnits(String(params.amountA), tokenA.decimals)
  const budgetB = toUnits(String(params.amountB), tokenB.decimals)
  const expectedA = (budgetA * 995n) / 1000n
  const expectedB = (budgetB * 995n) / 1000n
  return {
    inRange: true,
    fee: params.fee,
    initialize: false,
    currentPrice: '25',
    deadline: 2000000000,
    tokenA: tokenA.symbol,
    tokenB: tokenB.symbol,
    recipient: address(2),
    decimalsA: tokenA.decimals,
    decimalsB: tokenB.decimals,
    minimumUtilizationPercent: '99',
    minBoundaryPercent: params.minBoundaryPercent,
    range: {
      upperPrice: '28',
      lowerPrice: '22.5',
      lowerDistancePercent: '10',
      upperDistancePercent: '12',
    },
    amounts: {
      budgetA: budgetA.toString(),
      budgetB: budgetB.toString(),
      utilizationPercentA: '99.5',
      utilizationPercentB: '99.5',
      desiredA: budgetA.toString(),
      desiredB: budgetB.toString(),
      expectedA: expectedA.toString(),
      expectedB: expectedB.toString(),
      leftoverA: (budgetA - expectedA).toString(),
      leftoverB: (budgetB - expectedB).toString(),
      minimumA: ((budgetA * 99n) / 100n).toString(),
      minimumB: ((budgetB * 99n) / 100n).toString(),
    },
  }
}
