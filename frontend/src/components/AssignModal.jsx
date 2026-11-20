import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { NOTE_KINDS, STATUSES, fmtDateTime } from '../constants.js'

const input = 'w-full px-3 py-2 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rdb-green disabled:opacity-60'
const label = 'block text-xs font-semibold uppercase text-gray-600 mb-1'

/** Intervention workspace for one ticket: assign, change status, log plans and monitoring sessions. */
export default function AssignModal({ alertId, canManage, onClose, onSaved }) {
  const [alert, setAlert] = useState(null)
  const [assignees, setAssignees] = useState([])
  const [assignee, setAssignee] = useState('')
  const [status, setStatus] = useState('PENDING')
  const [kind, setKind] = useState(NOTE_KINDS[0].value)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const apply = (a) => {
    setAlert(a)
    setAssignee(a.assigned_to ? String(a.assigned_to) : '')
    setStatus(a.status)
  }

  useEffect(() => {
    Promise.all([api(`/alerts/${alertId}/`), api('/alerts/assignees/')])
      .then(([a, list]) => {
        apply(a)
        setAssignees(list)
      })
      .catch((e) => setError(e.message))
  }, [alertId])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let current = alert
      if (assignee && assignee !== String(alert.assigned_to || '')) {
        current = await api(`/alerts/${alertId}/assign/`, { method: 'POST', body: { assigned_to: Number(assignee) } })
      }
      const wantedStatus = status !== alert.status && status !== current.status ? status : null
      if (wantedStatus) {
        current = await api(`/alerts/${alertId}/status/`, { method: 'POST', body: { status: wantedStatus } })
      }
      if (text.trim()) {
        await api(`/alerts/${alertId}/notes/`, { method: 'POST', body: { kind, text } })
        current = await api(`/alerts/${alertId}/`)
        setText('')
      }
      apply(current)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border-t-4 border-rdb-red space-y-4"
      >
        {!alert ? (
          <p className="text-sm text-gray-500">{error || 'Loading ticket…'}</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs font-bold text-gray-500">{alert.ticket_id}</p>
                <h3 className="text-lg font-bold text-gray-800">{alert.employee.full_name}</h3>
                <p className="text-xs text-gray-500">
                  {alert.employee.department} · forecast {Math.round(alert.predicted_score)}% ({alert.confidence}% confidence)
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" title="Close">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Assign to</label>
                <select disabled={!canManage} className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Status</label>
                <select disabled={!canManage} className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {canManage && (
              <div className="space-y-2">
                <label className={label}>Log an intervention</label>
                <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
                  {NOTE_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <textarea
                  rows="3"
                  className={input}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe the support plan, intervention or monitoring session…"
                />
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Ticket history</h4>
              <ul className="space-y-2 text-xs">
                {alert.notes.map((n) => (
                  <li key={n.id} className="bg-gray-50 rounded-lg border p-2">
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span className="font-semibold">{n.kind_label} · {n.author_name}</span>
                      <span>{fmtDateTime(n.created_at)}</span>
                    </div>
                    <p className="text-gray-700 mt-1">{n.text}</p>
                  </li>
                ))}
              </ul>
            </div>

            {error && <p className="text-xs text-rdb-red font-semibold">{error}</p>}
            <div className="flex space-x-3">
              <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300">
                Close
              </button>
              {canManage && (
                <button disabled={saving} className="flex-1 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg hover:bg-green-800 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  )
}
