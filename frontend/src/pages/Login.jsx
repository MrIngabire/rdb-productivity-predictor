import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/** 5.1.1 Manager and Administrator Secure Login */
export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  // Demo credentials are prefilled in development only, exactly like the prototype.
  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@rdb.rw' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="min-h-screen bg-rdb-green flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 border-t-4 border-rdb-gold">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 text-rdb-green rounded-full mb-3 text-2xl shadow-inner">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Rwanda Development Board</h1>
          <p className="text-sm text-gray-500 mt-1">AI-Based Business Productivity Prediction System</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Staff ID / Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full px-4 py-3 rounded-lg bg-green-50/50 border border-green-200 focus:outline-none focus:ring-2 focus:ring-rdb-green text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg bg-green-50/50 border border-green-200 focus:outline-none focus:ring-2 focus:ring-rdb-green text-sm text-gray-700"
            />
          </div>
          {error && <p className="text-xs text-rdb-red font-semibold">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-rdb-green text-white font-semibold rounded-lg shadow-md hover:bg-green-800 transition duration-200 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Secure Login'}
          </button>
        </form>
      </div>
    </section>
  )
}
