import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { StatsProvider, useStats } from '../context/StatsContext.jsx'
import EarlyWarningModal from './EarlyWarningModal.jsx'

const TITLES = {
  '/': 'Analytics Dashboard',
  '/profiles': 'Operational Record Profile View',
  '/queue': 'Senior Manager Intervention Queue',
  '/admin': 'System Administration',
}

const NAV = [
  { to: '/', icon: 'fa-gauge', label: 'Dashboard', end: true },
  { to: '/profiles', icon: 'fa-folder-open', label: 'Operational Profiles' },
  { to: '/queue', icon: 'fa-triangle-exclamation', label: 'Intervention Queue', badge: true },
  { to: '/admin', icon: 'fa-user-shield', label: 'Administration', adminOnly: true },
]

function Shell() {
  const { user, logout } = useAuth()
  const { stats } = useStats()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [bellOpen, setBellOpen] = useState(false)

  const items = NAV.filter((n) => !n.adminOnly || user.role === 'ADMIN')
  const pending = stats?.pending_alerts ?? 0

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-rdb-dark text-gray-300 flex-col justify-between hidden md:flex shadow-xl">
        <div>
          <div className="p-5 flex items-center space-x-3 border-b border-gray-800">
            <div className="w-10 h-10 rounded-lg bg-rdb-green flex items-center justify-center text-white font-bold text-lg">
              <i className="fa-solid fa-brain"></i>
            </div>
            <div>
              <h2 className="text-white font-bold text-sm tracking-wide">RDB AI Predictor</h2>
              <p className="text-[10px] text-gray-400">Enterprise Productivity Engine</p>
            </div>
          </div>
          <nav className="p-4 space-y-1 text-sm font-medium">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition relative ${
                    isActive ? 'bg-rdb-green text-white' : 'hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <i className={`fa-solid ${n.icon} w-5`}></i>
                <span>{n.label}</span>
                {n.badge && pending > 0 && (
                  <span className="absolute right-3 bg-rdb-red text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {pending}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* USER PROFILE FOOTER */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-rdb-green text-white font-bold flex items-center justify-center text-xs">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user.display_name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.job_title || user.role_label}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 transition" title="Logout">
            <i className="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </aside>

      {/* CONTENT VIEWPORT */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-gray-200 h-16 shrink-0 flex items-center justify-between px-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800">{TITLES[pathname] || 'RDB AI Predictor'}</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setBellOpen(true)}
              className="relative text-gray-600 hover:text-rdb-green transition"
              title="Early warnings"
            >
              <i className="fa-solid fa-bell text-lg"></i>
              {pending > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rdb-red rounded-full"></span>}
            </button>
          </div>
        </header>

        {/* Mobile navigation (the sidebar is hidden below md, as in the prototype) */}
        <nav className="md:hidden bg-rdb-dark text-gray-300 flex items-center justify-around text-xs px-2 py-2">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${isActive ? 'bg-rdb-green text-white' : ''}`
              }
            >
              <i className={`fa-solid ${n.icon}`}></i>
              <span>{n.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button onClick={handleLogout} className="flex flex-col items-center gap-1 px-3 py-1">
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </nav>

        <Outlet />
      </main>

      {bellOpen && (
        <EarlyWarningModal
          variant="pending"
          alert={stats?.latest_alert ?? null}
          onClose={() => setBellOpen(false)}
          onViewQueue={() => {
            setBellOpen(false)
            navigate('/queue')
          }}
        />
      )}
    </div>
  )
}

export default function Layout() {
  return (
    <StatsProvider>
      <Shell />
    </StatsProvider>
  )
}
