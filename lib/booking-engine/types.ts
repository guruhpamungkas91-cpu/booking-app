export interface CalculatedSlot {
  time: string
  isAvailable: boolean
  reason?: string // Gunakan string agar bebas menerima alasan apapun
}

export interface SlotRequestParams {
  tenantId: string
  tenantSlug: string
  bookingDate: string
  serviceDuration: number
  staffId?: string | null
}