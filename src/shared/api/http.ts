import type { PublicError } from './types'

export class ApiError extends Error {
  constructor(
    public detail: PublicError,
    public status = 0,
  ) {
    super(detail.code)
  }
}

export function normalizeEndpoint(value: string) {
  const url = new URL(value.trim() || window.location.origin)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Укажите адрес HTTP(S) без пути, пароля и параметров.')
  }
  if (window.location.protocol === 'https:' && url.protocol !== 'https:') {
    throw new Error('Для этой страницы требуется HTTPS-адрес сервера.')
  }
  return url.origin
}

export async function request<T>(
  base: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(30000),
      method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
    })
  } catch {
    throw new ApiError({ code: 'CONNECTION_LOST' })
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      data?.error ?? { code: `HTTP_${response.status}` },
      response.status,
    )
  }
  if (data === null) {
    throw new ApiError({ code: 'INVALID_RESPONSE' })
  }
  return data as T
}
