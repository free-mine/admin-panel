import type { PublicError } from '../../../shared/api'

export type TokenSymbol = 'WAVAX' | 'USDT' | 'USDC' | 'BTC.b'
export interface Token {
  address: string
  decimals: number
  symbol: TokenSymbol
}
export interface Config {
  owner: string
  chainId: number
  tokens: Token[]
  readOnly: boolean
  websocket: string
  previewTtlSeconds: number
  addresses: {
    aave: string
    oreVein: string
    freeMine: string
    lfjRouter: string
    lfjQuoter: string
    uniswapFactory: string
    uniswapPositionManager: string
  }
}
export interface Readiness {
  status: string
  readOnly: boolean
}
export interface Balances {
  owner: string
  oreVein: string
  ownerAvax: string
  oreVeinAvax: string
  tokens: (Token & { balance: string })[]
}
export interface Fund {
  block: number
  dollar: string
  magicOre: string
  entryPrice: string
  contractURI: string
  priceDecimals: number
  currentShiftId: string
  priceUpdatedAt: number
  minimumExitPrice: string
  maximumExitPrice: string
  nextPriceUpdateAt: number
  minimumEntryPrice: string
  maximumEntryPrice: string
}
export interface Shift {
  id: string
  block: number
  price: string
  dollar: string
  closed: boolean
  funded: boolean
  fundedAt: number
  oreAmount: string
  dollarScale: string
  currentClaimId: string
  expireAvailableAt: number | null
}
export interface ClaimPage {
  block: number
  limit: number
  offset: number
  shiftId: string
  totalIds: string
  claims: { id: string; miner: string; oreAmount: string }[]
}
export interface Aave {
  ltv: string
  block: number
  baseDecimals: number
  totalDebtBase: string
  totalCollateralBase: string
  healthFactor: string | null
  availableBorrowsBase: string
  healthFactorDecimals: number
  currentLiquidationThreshold: string
  reserves: (Token & {
    supplied: string
    variableDebt: string
    supplyRateRay: string
    variableBorrowRateRay: string
  })[]
}
export interface Position {
  fee: number
  token0: Token
  token1: Token
  tokenId: string
  tickLower: number
  tickUpper: number
  liquidity: string
  tokensOwed0: string
  tokensOwed1: string
}
export interface PositionPage {
  total: string
  limit: number
  offset: number
  positions: (Position | { tokenId: string; error: PublicError })[]
}
export interface Successors {
  block: number
  blockTimestamp: number
  successors: { address: string; timestamp: number; eligible: boolean }[]
}
export type ActionKind =
  | 'successor.schedule'
  | 'successor.remove'
  | 'contract.setURI'
  | 'fund.closeShift'
  | 'fund.fundShift'
  | 'fund.expireClaim'
  | 'fund.updateEntryPrice'
  | 'fund.changeDollar'
  | 'aave.supply'
  | 'aave.borrow'
  | 'aave.repay'
  | 'aave.withdraw'
  | 'lfj.swap'
  | 'uniswap.mint'
  | 'uniswap.increase'
  | 'uniswap.collect'
  | 'uniswap.burn'
  | 'uniswap.close'
export interface Action {
  kind: ActionKind
  params: Record<string, string | number>
}
export interface PreviewRequest {
  action: Action
  maxGasAvax: string
}
export interface Approval {
  token: string
  amount: string
  spender: string
  resetBelow?: string
}
export interface Preview {
  id: string
  expiresAt: number
  request: PreviewRequest
  knownGasEstimateAvax: string
  gasEstimateComplete: boolean
  summary: Record<string, unknown>
  steps: {
    id: number
    code: string
    approval?: Approval
    gasEstimate: {
      maxGasWei: string | null
      status: 'estimated' | 'requires_prior_steps' | 'skipped'
    }
  }[]
}
export type OperationStatus =
  'queued' | 'running' | 'waiting' | 'needs_attention' | 'succeeded' | 'failed'
export interface Operation {
  id: string
  version: number
  previewId: string
  requestId: string
  createdAt: number
  updatedAt: number
  expiresAt: number
  maxGasWei: string
  gasSpentWei: string
  error?: PublicError
  status: OperationStatus
  request: PreviewRequest
  summary: Record<string, unknown>
  result?: Record<string, unknown>
  steps: {
    id: number
    code: string
    status: string
    nonce?: number
    approval?: Approval
    error?: PublicError
    transactionHash?: string
    receipt?: { fee: string; hash: string; status: number; blockNumber: number }
  }[]
}
export interface OperationPage {
  limit: number
  total: number
  offset: number
  operations: Operation[]
}
