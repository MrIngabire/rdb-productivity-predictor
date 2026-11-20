export const DEPARTMENTS = [
  'Business Registration',
  'Investment Promotion',
  'Digital Services',
  'Enterprise Development',
]

export const TASK_CATEGORIES = [
  'Project Monitoring & Evaluation',
  'Investor Inquiry Resolution',
  'Business Registration Processing',
  'SME Onboarding Log',
  'Digital Service Delivery',
]

export const ROLES = [
  { value: 'ADMIN', label: 'System Administrator' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'SENIOR_MANAGER', label: 'Senior Operational Manager' },
]

export const STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

export const NOTE_KINDS = [
  { value: 'INTERVENTION', label: 'Targeted intervention' },
  { value: 'SUPPORT_PLAN', label: 'Personalized support plan' },
  { value: 'MONITORING', label: 'Monitoring session' },
]

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'
