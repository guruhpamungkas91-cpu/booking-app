import { SupabaseClient } from '@supabase/supabase-js'
import { CalculatedSlot, SlotRequestParams } from './types'

export async function getFixedSlots(
  supabase: SupabaseClient,
  params: SlotRequestParams
): Promise<CalculatedSlot[]> {
  const { tenantId, bookingDate, staffId } = params

  // 1. Ambil data tenant untuk setting jam istirahat
  const { data: tenant } = await supabase
    .from('tenants')
    .select('auto_lunch_break, lunch_start_time, lunch_end_time')
    .eq('id', tenantId)
    .maybeSingle()

  // 2. Ambil daftar jam statis dari tabel tenant_slots
  const { data: tenantSlots, error: slotError } = await supabase
    .from('tenant_slots')
    .select('slot_time, max_quota')
    .eq('tenant_id', tenantId)
    .order('slot_time', { ascending: true })

  if (slotError || !tenantSlots) return []

  // 3. Ambil data reservasi aktif pada tanggal & tenant terkait
  let query = supabase
    .from('reservations')
    .select('time_slot, staff_id')
    .eq('tenant_id', tenantId)
    .eq('booking_date', bookingDate)
    .neq('status', 'cancelled')

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  const { data: existingReservations } = await query

  const isLunchActive = tenant?.auto_lunch_break ?? false
  const lunchStart = tenant?.lunch_start_time?.substring(0, 5) || '12:00'
  const lunchEnd = tenant?.lunch_end_time?.substring(0, 5) || '13:00'

  // 4. Petakan slot fixed ke format CalculatedSlot
  return tenantSlots.map((slot): CalculatedSlot => {
    const timeFormatted = slot.slot_time.substring(0, 5) // Format HH:mm
    
    const bookedCount = existingReservations?.filter(
      (res) => res.time_slot.substring(0, 5) === timeFormatted
    ).length || 0

    const maxQuota = slot.max_quota || 1
    const isQuotaFull = bookedCount >= maxQuota
    const isLunchBreak = isLunchActive && (timeFormatted >= lunchStart && timeFormatted < lunchEnd)

    let isAvailable = true
    let reason: string | undefined = undefined

    if (isLunchBreak) {
      isAvailable = false
      reason = 'Jam Istirahat'
    } else if (isQuotaFull) {
      isAvailable = false
      reason = 'quota_full'
    }

    return {
      time: timeFormatted,
      isAvailable,
      reason
    }
  })
}