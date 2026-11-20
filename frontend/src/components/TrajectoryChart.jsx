/** Small trajectory chart: past completion rates, the forecast, and the pass threshold. */
export default function TrajectoryChart({ history, predicted, threshold, color }) {
  const W = 360
  const H = 120
  const padX = 28
  const padY = 12
  const values = [...history, predicted]
  const x = (i) => padX + (values.length === 1 ? (W - padX * 2) / 2 : (i * (W - padX * 2)) / (values.length - 1))
  const y = (v) => padY + ((100 - v) / 100) * (H - padY * 2)

  const past = history.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const lastIdx = history.length - 1
  const forecastIdx = values.length - 1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" role="img" aria-label="Productivity trajectory">
      <line x1={padX} x2={W - padX} y1={y(threshold)} y2={y(threshold)} stroke="#9ca3af" strokeDasharray="4 4" />
      <text x={W - padX} y={y(threshold) - 4} textAnchor="end" fontSize="9" fill="#6b7280">
        pass {threshold}%
      </text>
      {history.length > 1 && <polyline points={past} fill="none" stroke="#6b7280" strokeWidth="2" />}
      {history.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#6b7280" />
      ))}
      {lastIdx >= 0 && (
        <line x1={x(lastIdx)} y1={y(history[lastIdx])} x2={x(forecastIdx)} y2={y(predicted)} stroke={color} strokeWidth="2" strokeDasharray="5 4" />
      )}
      <circle cx={x(forecastIdx)} cy={y(predicted)} r="5" fill={color} />
      <text x={x(forecastIdx)} y={y(predicted) - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
        {Math.round(predicted)}%
      </text>
    </svg>
  )
}
