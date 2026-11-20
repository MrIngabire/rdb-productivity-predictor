import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api/client.js'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const clear = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    if (!getToken()) return
    api('/auth/me/')
      .then(setUser)
      .catch(clear)
      .finally(() => setLoading(false))
  }, [clear])

  useEffect(() => {
    window.addEventListener('rdb:unauthorized', clear)
    return () => window.removeEventListener('rdb:unauthorized', clear)
  }, [clear])

  const login = async (email, password) => {
    const data = await api('/auth/login/', { method: 'POST', body: { email, password } })
    setToken(data.token)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await api('/auth/logout/', { method: 'POST' })
    } catch {
      /* token may already be invalid */
    }
    clear()
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}
