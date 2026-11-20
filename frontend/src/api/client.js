const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'rdb_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

function messageFrom(data, fallback) {
  if (!data) return fallback
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (data.error) return data.error
  const first = Object.entries(data)[0]
  if (first) {
    const [field, value] = first
    const text = Array.isArray(value) ? value[0] : typeof value === 'object' ? JSON.stringify(value) : value
    return field === 'non_field_errors' ? text : `${field.replace(/_/g, ' ')}: ${text}`
  }
  return fallback
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Token ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Cannot reach the server. Check that the backend is running on port 8000.', 0)
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('rdb:unauthorized'))
    throw new ApiError(messageFrom(data, `Request failed (${res.status})`), res.status, data)
  }
  return data
}
