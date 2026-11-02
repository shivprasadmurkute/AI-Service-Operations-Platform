import type { Summary, Ticket, Insights } from './types'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `API error ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const getSummary = () => request<Summary>('/api/v1/summary')
export const getInsights = () => request<Insights>('/api/v1/insights')
export const getTickets = (search = '') => request<Ticket[]>(`/api/v1/tickets?limit=100${search ? `&search=${encodeURIComponent(search)}` : ''}`)
export const createTicket = (ticket: Record<string, unknown>) =>
  request<Ticket>('/api/v1/tickets', { method: 'POST', body: JSON.stringify(ticket) })
export const predictRisk = (payload: Record<string, unknown>) =>
  request<{risk_score:number;risk_band:string;explanation:string}>('/api/v1/predict-risk', {
    method: 'POST', body: JSON.stringify(payload)
  })
