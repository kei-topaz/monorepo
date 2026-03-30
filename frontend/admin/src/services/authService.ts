import { api } from '@/services/api'

// --- Types (from admin-api.openapi.json) ---

export type AuthorityLevel = '시스템관리자' | '관리자' | '운영자'

export interface User {
  id: string
  email: string
  name: string
  authority: AuthorityLevel
}

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
  token: string
  user: User
}

// --- Mock ---

const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'
const MOCK_DELAY = 1000

const MOCK_USER: User = {
  id: '1',
  email: 'admin@example.com',
  name: '관리자',
  authority: '시스템관리자',
}
const MOCK_TOKEN = 'mock-jwt-token'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Service functions ---

export async function login(request: LoginRequest): Promise<LoginResponse> {
  if (MOCK_ENABLED) {
    await delay(MOCK_DELAY)
    if (request.email === 'admin@example.com' && request.password === 'admin') {
      return { token: MOCK_TOKEN, user: MOCK_USER }
    }
    throw new Error('AUTH_INVALID_CREDENTIALS')
  }

  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function logout(): Promise<void> {
  if (MOCK_ENABLED) {
    await delay(MOCK_DELAY)
    clearAuth()
    return
  }

  await api<void>('/auth/logout', { method: 'POST' })
  clearAuth()
}

// --- Local auth state ---

export function saveAuth(response: LoginResponse): void {
  localStorage.setItem('auth_token', response.token)
  localStorage.setItem('auth_user', JSON.stringify(response.user))
}

export function clearAuth(): void {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

export function getSavedUser(): User | null {
  const raw = localStorage.getItem('auth_user')
  if (!raw) return null
  return JSON.parse(raw) as User
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('auth_token')
}
