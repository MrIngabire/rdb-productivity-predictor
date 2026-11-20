import { useState } from 'react'
import { api } from '../api/client.js'
import { DEPARTMENTS } from '../constants.js'

const input = 'w-full px-3 py-2 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rdb-green'
const label = 'block text-xs font-semibold uppercase text-gray-600 mb-1'

export default function NewProfileModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ employee_id: '', full_name: '', department: DEPARTMENTS[0], attendance_rate: '90' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await api('/employees/', {
        method: 'POST',
        body: { ...form, attendance_rate: Number(form.attendance_rate) },
      })
      onCreated(created)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-t-4 border-rdb-gold space-y-4">
        <h3 className="text-lg font-bold text-gray-800">New workflow profile</h3>
        <div>
          <label className={label}>Employee ID</label>
          <input required className={input} value={form.employee_id} onChange={set('employee_id')} placeholder="RDB-2026-0001" />
        </div>
        <div>
          <label className={label}>Full name</label>
          <input required className={input} value={form.full_name} onChange={set('full_name')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Department</label>
            <select className={input} value={form.department} onChange={set('department')}>
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Attendance (%)</label>
            <input type="number" min="0" max="100" className={input} value={form.attendance_rate} onChange={set('attendance_rate')} />
          </div>
        </div>
        {error && <p className="text-xs text-rdb-red font-semibold">{error}</p>}
        <div className="flex space-x-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300">
            Cancel
          </button>
          <button disabled={saving} className="flex-1 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg hover:bg-green-800 disabled:opacity-60">
            {saving ? 'Saving…' : 'Create profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
