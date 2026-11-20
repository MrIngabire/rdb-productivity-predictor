import { useEffect } from 'react'
import { useStats } from '../context/StatsContext.jsx'

function Kpi({ label, value, valueClass = 'text-gray-800', border, icon, iconBox }) {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 ${border} flex items-center justify-between`}>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
        <h3 className={`text-3xl font-extrabold mt-1 ${valueClass}`}>{value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${iconBox}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
    </div>
  )
}

/** 5.1.2 Main Analytics Dashboard */
export default function Dashboard() {
  const { stats, error, refresh } = useStats()

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!stats) {
    return <div className="p-6 text-sm text-gray-500">{error || 'Loading analytics…'}</div>
  }

  const threshold = stats.pass_threshold

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Kpi
          label="Total Workflows Tracked"
          value={stats.total_workflows.toLocaleString()}
          border="border-l-rdb-green"
          icon="fa-users-rectangle"
          iconBox="bg-green-50 text-rdb-green"
        />
        <Kpi
          label="At-Risk Workflows"
          value={stats.at_risk_workflows.toLocaleString()}
          valueClass="text-rdb-red"
          border="border-l-rdb-red"
          icon="fa-triangle-exclamation"
          iconBox="bg-red-50 text-rdb-red"
        />
        <Kpi
          label="AI Model Accuracy"
          value={stats.model_accuracy != null ? `${stats.model_accuracy}%` : '—'}
          border="border-l-rdb-dark"
          icon="fa-brain"
          iconBox="bg-blue-50 text-rdb-dark"
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">Department Performance Forecast</h3>
          <p className="text-xs text-gray-500">Average predicted score. Red bars are below the {threshold}% pass threshold.</p>
        </div>
        <div className="h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 grid grid-cols-4 items-end p-6">
          {stats.departments.map((d) => {
            const score = d.average_score
            const failing = score != null && score < threshold
            return (
              <div key={d.department} className="flex justify-center h-full items-end">
                <div
                  style={{ height: `${Math.max(score ?? 0, 6)}%` }}
                  className={`w-16 rounded-t-lg flex items-center justify-center text-white text-xs font-bold ${
                    score == null ? 'bg-gray-300' : failing ? 'bg-rdb-red' : 'bg-rdb-green'
                  }`}
                  title={`${d.workflows} workflows, ${d.at_risk} at risk`}
                >
                  {score != null ? `${Math.round(score)}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-4 text-center text-xs font-semibold text-gray-600 mt-3">
          {stats.departments.map((d) => (
            <span key={d.department}>{d.department}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
