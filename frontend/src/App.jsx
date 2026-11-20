import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profiles from './pages/Profiles.jsx'
import Queue from './pages/Queue.jsx'
import Admin from './pages/Admin.jsx'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>
  return user ? children : <Navigate to="/login" replace />
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profiles" element={<Profiles />} />
        <Route path="queue" element={<Queue />} />
        <Route
          path="admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <Admin />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
