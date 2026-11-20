import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { TASK_CATEGORIES, fmtDate } from '../constants.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useStats } from '../context/StatsContext.jsx'
import EarlyWarningModal from '../components/EarlyWarningModal.jsx'
import NewProfileModal from '../components/NewProfileModal.jsx'
import TrajectoryChart from '../components/TrajectoryChart.jsx'

const TONES = {
  HIGH: {
    panel: 'border-red-200 border-l-rdb-red',
    soft: 'bg-red-50 border-red-100',
    text: 'text-rdb-red',
    hex: '#e74c3c',
    pill: 'bg-red-50 text-rdb-red',
    pillText: 'High Risk Flagged',
    verdict: 'FAIL TARGET',
    outlook: 'fall below acceptable performance thresholds',
  },
  MODERATE: {
    panel: 'border-amber-200 border-l-rdb-gold',
    soft: 'bg-amber-50 border-amber-100',
    text: 'text-amber-600',
    hex: '#f39c12',
    pill: 'bg-amber-50 text-amber-700',
    pillText: 'Watch Closely',
    verdict: 'NARROW PASS',
    outlook: 'only narrowly meet the performance threshold',
  },
  LOW: {
    panel: 'border-green-200 border-l-rdb-green',
    soft: 'bg-green-50 border-green-100',
    text: 'text-rdb-green',
    hex: '#007a33',
    pill: 'bg-green-50 text-rdb-green',
    pillText: 'On Track',
    verdict: 'PASS TARGET',
    outlook: 'meet its performance targets',
  },
}

const field = 'w-full px-3 py-2 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rdb-green'
const fieldLabel = 'block text-xs font-semibold uppercase text-gray-600 mb-1'

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** 5.1.3 Operational Record Profile View + 5.1.4 AI Productivity Forecast View */
export default function Profiles() {
  const { user } = useAuth()
  const { stats, refresh } = useStats()
  const navigate = useNavigate()
  const canInput = user.role === 'ADMIN' || user.role === 'SUPERVISOR'
  const threshold = stats?.pass_threshold ?? 50

  const [employees, setEmployees] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState({ task: TASK_CATEGORIES[0], completion: '45', hours: '8' })
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState(null)
  const [showNew, setShowNew] = useState(false)

  const loadEmployees = useCallback(async (preferId) => {
    try {
      const list = await api('/employees/')
      setEmployees(list)
      setSelectedId((cur) => preferId || cur || (list[0] ? String(list[0].id) : ''))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const loadDetail = useCallback(async (id) => {
    if (!id) return
    try {
      setDetail(await api(`/employees/${id}/`))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  useEffect(() => {
    setResult(null)
    setError('')
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const runForecast = async () => {
    const completion = Number(form.completion)
    const hours = Number(form.hours)
    if (form.completion === '' || Number.isNaN(completion) || completion < 0 || completion > 100) {
      return setError('Completion rate must be a number between 0 and 100.')
    }
    if (form.hours === '' || Number.isNaN(hours) || hours < 0 || hours > 24) {
      return setError('Working hours must be a number between 0 and 24.')
    }
    setRunning(true)
    setError('')
    try {
      const res = await api('/predict/', {
        method: 'POST',
        body: {
          employee_id: detail.employee_id,
          task_name: form.task,
          task_completion_rate: completion,
          working_hours_logged: hours,
        },
      })
      setResult({ ...res, completion, hours })
      if (res.alert.escalated) {
        setWarning({ ticket_id: res.alert.ticket_id, employee_name: detail.full_name })
      }
      await Promise.all([loadDetail(selectedId), loadEmployees(), refresh()])
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const escalate = async () => {
    if (result.alert.escalated) {
      return setWarning({ ticket_id: result.alert.ticket_id, employee_name: detail.full_name })
    }
    try {
      const alert = await api(`/alerts/${result.alert.id}/escalate/`, { method: 'POST' })
      setResult({ ...result, alert })
      setWarning({ ticket_id: alert.ticket_id, employee_name: detail.full_name })
      refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  const tone = result ? TONES[result.alert.risk_level] : null
  const history = detail ? [...detail.records].reverse().map((r) => r.task_completion_rate) : []

  return (
    <div className="p-6 space-y-6">
      {/* Profile selector */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-56 max-w-md">
          <label className={fieldLabel}>Workflow profile</label>
          <select className={field} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_id})
              </option>
            ))}
          </select>
        </div>
        {canInput && (
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition"
          >
            <i className="fa-solid fa-plus mr-1"></i> New Profile
          </button>
        )}
      </div>

      {!detail ? (
        <p className="text-sm text-gray-500">{error || (employees.length ? 'Loading profile…' : 'No workflow profiles yet.')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-rdb-green text-white text-xl font-bold flex items-center justify-center shadow-md mb-4">
                {initials(detail.full_name)}
              </div>
              <h3 className="text-lg font-bold text-gray-800">{detail.full_name}</h3>
              <p className="text-xs text-gray-500">ID: {detail.employee_id}</p>
              <span className="inline-block mt-2 px-3 py-1 bg-green-50 text-rdb-green rounded-full text-xs font-semibold">
                Department: {detail.department}
              </span>
              <div className="mt-6 border-t pt-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Overall Attendance:</span>
                  <span className="font-bold">{Math.round(detail.attendance_rate)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Sprint Average:</span>
                  <span className={`font-bold ${detail.last_sprint_average != null && detail.last_sprint_average < threshold ? 'text-rdb-red' : ''}`}>
                    {detail.last_sprint_average != null ? `${Math.round(detail.last_sprint_average)}/100` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action & Input Form */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-gray-800">Input New Task Assessment</h3>
                  <button
                    onClick={runForecast}
                    disabled={!canInput || running}
                    title={canInput ? '' : 'Only supervisors and administrators can input operational data'}
                    className="px-4 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg shadow hover:bg-green-800 transition disabled:opacity-50"
                  >
                    <i className={`fa-solid ${running ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} mr-1`}></i>
                    {running ? 'Forecasting…' : 'Run AI Forecast'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className={fieldLabel}>Task Category</label>
                    <select className={field} disabled={!canInput} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })}>
                      {TASK_CATEGORIES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabel}>Completion Rate (%)</label>
                    <input type="number" min="0" max="100" className={field} disabled={!canInput} value={form.completion} onChange={(e) => setForm({ ...form, completion: e.target.value })} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Working Hours / Day</label>
                    <input type="number" min="0" max="24" step="0.5" className={field} disabled={!canInput} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
                  </div>
                </div>
                {error && <p className="text-xs text-rdb-red font-semibold mb-2">{error}</p>}

                <h4 className="text-xs font-bold text-gray-500 uppercase mt-6 mb-2">Historical Task Logs</h4>
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 uppercase">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Milestone</th>
                      <th className="p-2">Hours</th>
                      <th className="p-2">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700">
                    {detail.records.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2">{fmtDate(r.recorded_at)}</td>
                        <td className="p-2">{r.task_name}</td>
                        <td className="p-2">{r.working_hours_logged}</td>
                        <td className={`p-2 font-semibold ${r.task_completion_rate < threshold ? 'text-rdb-red' : ''}`}>
                          {Math.round(r.task_completion_rate)}%
                        </td>
                      </tr>
                    ))}
                    {detail.records.length === 0 && (
                      <tr>
                        <td className="p-2 text-gray-500" colSpan="4">
                          No task logs yet. Enter a completion rate and run the AI forecast.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* AI Forecast Result Panel */}
          {result && (
            <div className={`bg-white p-6 rounded-xl shadow-sm border border-l-4 ${tone.panel}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  <i className={`fa-solid fa-robot ${tone.text} mr-2`}></i>AI Productivity Forecast Result
                </h3>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${tone.pill}`}>{tone.pillText}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className={`text-center p-4 rounded-xl border ${tone.soft}`}>
                  <p className="text-xs text-gray-500 uppercase font-bold">Predicted Outcome</p>
                  <h4 className={`text-4xl font-black mt-1 ${tone.text}`}>{Math.round(result.predicted_score)}%</h4>
                  <p className={`text-xs font-semibold mt-1 ${tone.text}`}>{tone.verdict}</p>
                </div>
                <div className="md:col-span-2 bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-900">
                  <p className="font-bold mb-1">
                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>{' '}
                    {result.alert.risk_level === 'LOW' ? 'Trajectory Outlook' : 'Trajectory Warning'}
                  </p>
                  <p className="text-xs">
                    Based on current working hours ({result.hours}h) and task completion rates ({result.completion}%), the model
                    predicts with <strong className="text-red-700">{result.confidence}% confidence</strong> that this workflow will{' '}
                    {tone.outlook}.
                  </p>
                  {result.alert.risk_level !== 'LOW' && (
                    <button
                      onClick={escalate}
                      className="mt-3 px-4 py-2 bg-rdb-red text-white text-xs font-bold rounded-lg shadow hover:bg-red-700 transition"
                    >
                      {result.alert.escalated ? `View Escalation ${result.alert.ticket_id}` : 'Escalate to Senior Manager'}
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Productivity trajectory</p>
                <TrajectoryChart history={history} predicted={result.predicted_score} threshold={threshold} color={tone.hex} />
              </div>
            </div>
          )}
        </>
      )}

      {warning && (
        <EarlyWarningModal
          alert={warning}
          onClose={() => setWarning(null)}
          onViewQueue={() => {
            setWarning(null)
            navigate('/queue')
          }}
        />
      )}
      {showNew && (
        <NewProfileModal
          onClose={() => setShowNew(false)}
          onCreated={(emp) => {
            setShowNew(false)
            loadEmployees(String(emp.id))
          }}
        />
      )}
    </div>
  )
}
