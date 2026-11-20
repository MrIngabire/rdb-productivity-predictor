import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const StatsContext = createContext(null)
export const useStats = () => useContext(StatsContext)

/** Dashboard KPIs shared by the sidebar badge, the bell and the dashboard page. */
export function StatsProvider({ children }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setStats(await api('/dashboard/'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return <StatsContext.Provider value={{ stats, error, refresh }}>{children}</StatsContext.Provider>
}
