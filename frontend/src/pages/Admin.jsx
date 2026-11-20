import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { ROLES, fmtDateTime } from '../constants.js'
import { useStats } from '../context/StatsContext.jsx'

const field = 'w-full px-3 py-2 rounded-lg border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rdb-green'
const fieldLabel = 'block text-xs font-semibold uppercase text-gray-600 mb-1'
const EMPTY_USER = { title: '', first_name: '', last_name: '', email: '', role: 'SUPERVISOR', job_title: '', password: '' }

function EngineCard() {
  const { refresh } = useStats()
  const [cfg, setCfg] = useState(null)
  const [meta, setMeta] = useState(null)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState('')

  const apply = (data) => {
    const { model, ...settings } = data
    setCfg(settings)
    setMeta(model)
  }

  useEffect(() => {
    api('/settings/').then(apply).catch((e) => setMsg({ type: 'error', text: e.message }))
  }, [])

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy('save')
    try {
      apply(
        await api('/settings/', {
          method: 'PUT',
          body: {
            pass_threshold: Number(cfg.pass_threshold),
            moderate_threshold: Number(cfg.moderate_threshold),
            n_estimators: Number(cfg.n_estimators),
            max_depth: Number(cfg.max_depth),
          },
        }),
      )
      setMsg({ type: 'ok', text: 'Settings saved. Thresholds apply to new forecasts immediately; retrain to apply tree settings.' })
      refresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy('')
    }
  }

  const retrain = async () => {
    setBusy('train')
    try {
      apply(await api('/settings/retrain/', { method: 'POST' }))
      setMsg({ type: 'ok', text: 'Model retrained with the saved parameters.' })
      refresh()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy('')
    }
  }

  if (!cfg) return <div className="bg-white p-6 rounded-xl border text-sm text-gray-500">{msg.text || 'Loading engine settings…'}</div>

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-base font-bold text-gray-800 mb-4">
        <i className="fa-solid fa-sliders text-rdb-green mr-2"></i>Configure ML Engine Parameters
      </h3>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <div>
          <label className={fieldLabel}>Pass threshold (%)</label>
          <input type="number" step="0.5" className={field} value={cfg.pass_threshold} onChange={set('pass_threshold')} />
        </div>
        <div>
          <label className={fieldLabel}>Moderate risk below (%)</label>
          <input type="number" step="0.5" className={field} value={cfg.moderate_threshold} onChange={set('moderate_threshold')} />
        </div>
        <div>
          <label className={fieldLabel}>Trees (n_estimators)</label>
          <input type="number" className={field} value={cfg.n_estimators} onChange={set('n_estimators')} />
        </div>
        <div>
          <label className={fieldLabel}>Max tree depth</label>
          <input type="number" className={field} value={cfg.max_depth} onChange={set('max_depth')} />
        </div>
        <div className="col-span-2 flex gap-3">
          <button disabled={busy === 'save'} className="px-4 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg shadow hover:bg-green-800 disabled:opacity-60">
            {busy === 'save' ? 'Saving…' : 'Save settings'}
          </button>
          <button type="button" onClick={retrain} disabled={busy === 'train'} className="px-4 py-2 bg-rdb-dark text-white text-xs font-bold rounded-lg shadow hover:opacity-90 disabled:opacity-60">
            <i className={`fa-solid ${busy === 'train' ? 'fa-spinner fa-spin' : 'fa-rotate'} mr-1`}></i>
            {busy === 'train' ? 'Training…' : 'Retrain model'}
          </button>
        </div>
      </form>
      {msg.text && <p className={`text-xs font-semibold mt-3 ${msg.type === 'error' ? 'text-rdb-red' : 'text-rdb-green'}`}>{msg.text}</p>}

      {meta?.accuracy != null && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t pt-4">
          {[
            ['Algorithm', meta.algorithm],
            ['Pass/fail accuracy', `${(meta.accuracy * 100).toFixed(1)}%`],
            ['Mean absolute error', `${meta.mae} pts`],
            ['R² score', meta.r2],
            ['Training samples', meta.training_samples?.toLocaleString()],
            ['Last trained', fmtDateTime(meta.trained_at)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-gray-500">{k}</dt>
              <dd className="font-bold text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function UsersCard() {
  const [users, setUsers] = useState(null)
  const [form, setForm] = useState(EMPTY_USER)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => api('/users/').then(setUsers).catch((e) => setError(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/users/', { method: 'POST', body: form })
      setForm(EMPTY_USER)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (u) => {
    try {
      await api(`/users/${u.id}/`, { method: 'PATCH', body: { is_active: !u.is_active } })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-base font-bold text-gray-800 mb-4">
        <i className="fa-solid fa-users-gear text-rdb-green mr-2"></i>Provision User Accounts
      </h3>
      <form onSubmit={create} className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <label className={fieldLabel}>First name</label>
          <input required className={field} value={form.first_name} onChange={set('first_name')} />
        </div>
        <div>
          <label className={fieldLabel}>Last name</label>
          <input required className={field} value={form.last_name} onChange={set('last_name')} />
        </div>
        <div className="col-span-2">
          <label className={fieldLabel}>Staff email</label>
          <input required type="email" className={field} value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className={fieldLabel}>Role</label>
          <select className={field} value={form.role} onChange={set('role')}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Temporary password</label>
          <input required type="password" minLength="8" className={field} value={form.password} onChange={set('password')} />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <button disabled={saving} className="px-4 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg shadow hover:bg-green-800 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create account'}
          </button>
          {error && <p className="text-xs text-rdb-red font-semibold">{error}</p>}
        </div>
      </form>

      <table className="w-full text-left text-xs">
        <thead className="bg-gray-100 text-gray-600 uppercase">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Role</th>
            <th className="p-2">Access</th>
          </tr>
        </thead>
        <tbody className="divide-y text-gray-700">
          {(users || []).map((u) => (
            <tr key={u.id}>
              <td className="p-2">
                <p className="font-semibold">{u.display_name}</p>
                <p className="text-[10px] text-gray-500">{u.email}</p>
              </td>
              <td className="p-2">{u.role_label}</td>
              <td className="p-2">
                <button onClick={() => toggle(u)} className={`font-bold hover:underline ${u.is_active ? 'text-rdb-green' : 'text-rdb-red'}`}>
                  {u.is_active ? 'Active' : 'Disabled'}
                </button>
              </td>
            </tr>
          ))}
          {!users && (
            <tr>
              <td className="p-2 text-gray-500" colSpan="3">
                Loading accounts…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Administrator use cases: provision accounts and configure the ML engine. */
export default function Admin() {
  return (
    <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <EngineCard />
      <UsersCard />
    </div>
  )
}
