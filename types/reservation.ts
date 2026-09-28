export interface Reservation {
  id: string | number // ID wajib ada
  created_at?: string
  customer_name: string
  whatsapp_number: string
  service_name: string
  staff_name?: string
  booking_date: string
  booking_time: string
  payment_method?: string
  payment_type?: string
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | string
  tenant_id?: string
  total_price?: number
  [key: string]: unknown
}

export interface TimeSlot {
  time: string
  max_quota?: number
  booked_count?: number
  disabled?: boolean
  is_available?: boolean
}

export interface BlockedSlot {
  id: number | string
  created_at?: string
  tenant_id?: string
  block_date: string
  block_end_date?: string
  block_time?: string
  reason?: string
}