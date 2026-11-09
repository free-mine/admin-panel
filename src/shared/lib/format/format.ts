export function toUnits(value: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.length > 160) {
    throw new Error('Введите неотрицательное число с точкой, без экспоненты.')
  }
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > decimals) {
    throw new Error(`Допустимо не более ${decimals} знаков после точки.`)
  }
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, '0') || '0')
  if (result > 2n ** 256n - 1n) {
    throw new Error('Сумма превышает допустимое значение.')
  }
  return result
}

export function fromUnits(value: string | bigint, decimals = 18): string {
  const raw = BigInt(value)
  const sign = raw < 0n ? '-' : ''
  const digits = (raw < 0n ? -raw : raw).toString().padStart(decimals + 1, '0')
  if (!decimals) {
    return `${sign}${digits}`
  }
  const fraction = digits.slice(-decimals).replace(/0+$/, '')
  return `${sign}${digits.slice(0, -decimals)}${fraction ? `.${fraction}` : ''}`
}

export function decimal(value: string): string {
  const [whole, fraction] = value.split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}${fraction ? `,${fraction}` : ''}`
}

export function units(value: string, decimals = 18) {
  return decimal(fromUnits(value, decimals))
}

export function dateTime(milliseconds: number) {
  return `${new Intl.DateTimeFormat('ru-RU', {
    timeStyle: 'short',
    dateStyle: 'medium',
    timeZone: 'Europe/Moscow',
  }).format(milliseconds)} МСК`
}

export function shortAddress(value: string) {
  return value.length > 20 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}
