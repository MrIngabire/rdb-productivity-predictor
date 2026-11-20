import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { STATUSES } from '../constants.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useStats } from '../context/StatsContext.jsx'
import AssignModal from '../components/AssignModal.jsx'

const RISK_STYLE = {
  HIGH: 'bg-red-100 text-red-700',
  MODERATE: 'bg-amber-100 text-amber-800',
  LOW: 'bg-green-100 text-green-700',
}
const RISK_TEXT = { HIGH: 'High Risk', MODERATE: 'Moderate Risk', LOW: 'Low Risk' }
const STATUS_STYLE = {
  PENDING: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
}
const STATUS_TEXT = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }

/** 5.1.6 Senior Manager Intervention Queue */
export default function Queue() {
  const { user } = useAuth()
  const { refresh } = useStats()
  const canManage = user.role === 'ADMIN' || user.role === 'SENIOR_MANAGER'

  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    try {
      setAlerts(await api('/alerts/'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (alerts || []).filter(
      (a) =>
        (!status || a.status === status) &&
        (!q ||
          a.ticket_id?.toLowerCase().includes(q) ||
          a.employee.full_name.toLowerCase().includes(q) ||
          a.employee.employee_id.toLowerCase().includes(q) ||
          a.employee.department.toLowerCase().includes(q)),
    )
  }, [alerts, search, status])

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 justify-between items-center">
          <h3 className="font-bold text-gray-800 text-sm">Senior Manager Intervention Queue</h3>
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1 text-xs border rounded-lg bg-white">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflow ID..."
              className="px-3 py-1 text-xs border rounded-lg bg-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
              <tr>
                <th className="p-3">Ticket ID</th>
                <th className="p-3">Workflow Name</th>
                <th className="p-3">Department Focus</th>
                <th className="p-3">AI Risk Level</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-gray-700 text-xs">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 font-mono font-bold">{a.ticket_id}</td>
                  <td className="p-3 font-semibold">{a.employee.full_name}</td>
                  <td className="p-3">{a.employee.department}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 font-bold rounded ${RISK_STYLE[a.risk_level]}`}>{RISK_TEXT[a.risk_level]}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 font-bold rounded ${STATUS_STYLE[a.status]}`}>{STATUS_TEXT[a.status]}</span>
                    {a.assigned_to_name && <p className="text-[10px] text-gray-500 mt-1">{a.assigned_to_name}</p>}
                  </td>
                  <td className="p-3">
                    <button onClick={() => setOpenId(a.id)} className="text-rdb-green font-bold hover:underline">
                      {canManage ? 'Assign' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
              {alerts && rows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan="6">
                    {alerts.length === 0
                      ? 'No escalated workflows. Predictions below the pass threshold appear here automatically.'
                      : 'No tickets match your filters.'}
                  </td>
                </tr>
              )}
              {!alerts && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan="6">
                    {error || 'Loading queue…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openId && (
        <AssignModal
          alertId={openId}
          canManage={canManage}
          onClose={() => setOpenId(null)}
          onSaved={() => {
            load()
            refresh()
          }}
        />
      )}
    </div>
  )
}
