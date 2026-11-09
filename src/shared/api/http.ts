import type { PublicError } from './types'

export class ApiError extends Error {
  constructor(
    public detail: PublicError,
    public status = 0,
  ) {
    super(detail.code)
  }
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
