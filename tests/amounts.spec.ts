import { test, expect } from '@playwright/test'

import { fund, config } from './fixture'
import type { ActionKind } from '../src/pages/console/api/types'
import { toUnits, fromUnits } from '../src/shared/lib/format/format'
import {
  actions,
  initialValues,
  validateAction,
} from '../src/pages/console/model/actions'

test('amounts retain precision beyond Number and reject invalid representations', () => {
  expect(
    fromUnits(toUnits('9007199254740993.000000000000000001', 18), 18),
  ).toBe('9007199254740993.000000000000000001')
  expect(fromUnits(toUnits('0.00000001', 8), 8)).toBe('0.00000001')
  for (const value of ['1e6', '1,2', '-1', '1.0000001', '', 'NaN']) {
    expect(() => toUnits(value, 6)).toThrow()
  }
  expect(
    (BigInt('10000000000000000000000') * toUnits('1.20', 18)) /
      (10n ** 18n * 10n ** 12n),
  ).toBe(12000000000n)
})

test('all 18 API actions have forms; numeric API fields and ID strings keep their types', () => {
  expect(Object.keys(actions)).toHaveLength(18)
  for (const kind of Object.keys(actions) as ActionKind[]) {
    const draft = { kind, token0: 'USDT', token1: 'WAVAX' }
    const values = {
      ...initialValues(draft),
      amount: '1',
      amountA: '1',
      amountB: '1',
      amount0: '1',
      amount1: '1',
      claimId: '1',
      price: '1.20',
      shiftId: '42',
      uri: 'ipfs://metadata',
      tokenId: '9007199254740993',
      timestamp: '2090-01-01T12:00',
      address: '0x0000000000000000000000000000000000000001',
    }
    const result = validateAction(draft, values, config, fund)
    expect(result.errors, kind).toEqual({})
    if ('tokenId' in result.action.params) {
      expect(result.action.params.tokenId).toBe('9007199254740993')
    }
    if ('slippageBps' in result.action.params) {
      expect(result.action.params.slippageBps).toBe(50)
    }
    if (kind === 'uniswap.mint') {
      expect(result.action.params).not.toHaveProperty('tickLower')
      expect(result.action.params.fee).toBe(3000)
    }
    if (kind === 'successor.schedule') {
      expect(result.action.params.timestamp).toBe(
        Date.parse('2090-01-01T09:00:00Z') / 1000,
      )
    }
  }
})
