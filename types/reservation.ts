// types/reservations.ts

export interface TimeSlot {
  time: string
  time_slot?: string
  max_quota?: number
  booked_count?: number
  disabled?: boolean
  is_available?: boolean
  isDisabled?: boolean
  reason?: string
  isHidden?: boolean
}

// 1. TAMBAHAN: Interface Reservation agar import Reservation di komponen tidak merah
export interface Reservation {
  id?: string | number
  tenant_id?: string | number
  customer_name?: string
  whatsapp_number?: string
  booking_date?: string
  booking_time?: string
  time?: string // <-- TAMBAHKAN BARIS INI
  staff?: string
  staff_name?: string
  staff_id?: string | number
  status?: string
  total_price?: number
  [key: string]: unknown
}

export interface BookedReservation {
  booking_time: string
  time?: string // <-- TAMBAHKAN BARIS INI
  duration_minutes?: number
  staff?: string
  staff_id?: string | number
  staff_name?: string
  status?: string
}

export interface TenantSettingsResponse {
  hide_booked_slots?: boolean
  enable_auto_disable_time_slots?: boolean
}

export interface AvailabilityApiResponse {
  success: boolean
  slots: string[]
  blockedTimes: string[]
  bookedReservations: BookedReservation[]
  tenantSettings?: TenantSettingsResponse
}

export interface BlockedSlot {
  id?: number | string
  created_at?: string
  tenant_id?: string
  block_date: string
  block_end_date?: string
  block_time?: string
  reason?: string
}

export interface BookingFormData {
  customer_name: string
  whatsapp_number: string
  booking_date: string
  booking_time: string
  selected_staff?: string
  selected_staff_id?: string
  selected_services: string[]
  selectedAddonIds?: (string | number)[]
  selectedTenantAddons?: Array<{
    id?: string | number
    name?: string
    label?: string
    price?: number
    duration?: number
  }>
  payment_method?: string
  payment_type?: string
  person_count?: number
  custom_notes?: string
  has_consent?: boolean
  [key: string]: unknown
}

// Tambahkan tipe enum status di atas
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | string

export interface InvoiceBooking {
  id?: string | number
  tenant_id?: string | number
  service_name?: string
  staff_name?: string
  customer_name?: string
  whatsapp_number?: string
  booking_date?: string
  booking_time?: string
  total_price?: number
  status?: string
  payment_method?: string
  payment_type?: string
  payment_status?: string
  created_at?: string
  [key: string]: unknown
}

export interface DashboardItem {
  id?: string | number
  customer_name?: string
  whatsapp_number?: string
  booking_date?: string
  booking_time?: string
  service_name?: string
  staff_name?: string
  total_price?: number
  payment_method?: string
  status?: string
  [key: string]: unknown
}