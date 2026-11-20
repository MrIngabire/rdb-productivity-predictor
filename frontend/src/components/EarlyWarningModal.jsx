/** 5.1.5 Early Warning Notification. `alert` = { ticket_id, employee_name } or null. */
export default function EarlyWarningModal({ alert, variant = 'generated', onClose, onViewQueue }) {
  const clear = !alert
  const heading = clear ? 'No Pending Early Warnings' : variant === 'pending' ? 'Latest Early Warning' : 'Early Warning Generated'
  const body = clear
    ? 'Every escalated workflow has been picked up by a manager.'
    : variant === 'pending'
      ? `A high-priority alert for ${alert.employee_name} is waiting for intervention in the Senior Manager queue.`
      : `A high-priority alert has been created for ${alert.employee_name}. The profile has been escalated to the Senior Manager intervention queue.`

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center border-t-4 ${clear ? 'border-rdb-green' : 'border-rdb-red'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl ${
            clear ? 'bg-green-100 text-rdb-green' : 'bg-red-100 text-rdb-red'
          }`}
        >
          <i className={`fa-solid ${clear ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
        </div>
        <h3 className="text-lg font-bold text-gray-800">{heading}</h3>
        <p className="text-xs text-gray-500 mt-2">{body}</p>
        {!clear && (
          <div className="my-4 py-2 px-3 bg-gray-50 rounded border font-mono text-xs font-bold text-gray-700">
            Ticket ID: {alert.ticket_id}
          </div>
        )}
        <div className="flex space-x-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300">
            Close
          </button>
          <button onClick={onViewQueue} className="flex-1 py-2 bg-rdb-green text-white text-xs font-bold rounded-lg hover:bg-green-800">
            View Queue
          </button>
        </div>
      </div>
    </div>
  )
}
