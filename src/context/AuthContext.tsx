import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'faaliyet-takvimi-admin-token'

interface AuthContextValue {
  isAdmin: boolean
  login: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(loadToken)

  useEffect(() => {
    try {
      if (token) sessionStorage.setItem(STORAGE_KEY, token)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [token])

  const login = useCallback(async (password: string) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const body = (await res.json().catch(() => null)) as {
      token?: string
      error?: string
    } | null
    if (!res.ok) {
      throw new Error(body?.error || 'Giris basarisiz')
    }
    if (!body?.token) throw new Error('Oturum anahtari alinamadi')
    setToken(body.token)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      isAdmin: Boolean(token),
      login,
      logout,
    }),
    [token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return ctx
}

export function getAdminAuthHeader(): Record<string, string> {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}
