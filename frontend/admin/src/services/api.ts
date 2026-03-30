const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.code ?? 'UNKNOWN_ERROR')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
