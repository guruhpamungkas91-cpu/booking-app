export interface LogItem {
  reservation_id?: string | number
  phone?: string
  status?: 'success' | 'failed'
  message?: string
  customer?: string
  targetDate?: string
  fonnteResponse?: unknown
  [key: string]: unknown
}