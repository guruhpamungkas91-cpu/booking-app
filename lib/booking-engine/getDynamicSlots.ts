import { SupabaseClient } from '@supabase/supabase-js'
import { CalculatedSlot, SlotRequestParams } from './types'

export async function calculateDynamicSlots(
  supabase: SupabaseClient,
  params: SlotRequestParams
): Promise<CalculatedSlot[]> {
  const { tenantId, bookingDate, serviceDuration, staffId } = params

  // 1. Ambil jam operasional & pengaturan tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('open_time, close_time, slot_interval, auto_lunch_break, lunch_start_time, lunch_end_time')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) return []

  // 2. Ambil daftar staf aktif milik tenant untuk menentukan kapasitas maksimal
  const { data: activeStaffs } = await supabase
    .from('staff') // Sesuaikan nama tabel jika menggunakan 'staff' atau 'tenant_staff'
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const totalStaffCount = activeStaffs && activeStaffs.length > 0 ? activeStaffs.length : 1

  // 3. Ambil seluruh reservasi aktif pada tanggal tersebut
  let query = supabase
    .from('reservations')
    .select('staff_id, time_slot, duration_minutes, start_time, end_time')
    .eq('tenant_id', tenantId)
    .eq('booking_date', bookingDate)
    .neq('status', 'cancelled')

  // Jika user memilih staf spesifik, filter reservasi milik staf itu saja
  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  const { data: existingReservations } = await query

  const slots: CalculatedSlot[] = []
  const startMinutes = timeToMinutes(tenant.open_time || '09:00')
  const endMinutes = timeToMinutes(tenant.close_time || '17:00')
  const interval = tenant.slot_interval || 30

  const isLunchActive = tenant.auto_lunch_break ?? false
  const lunchStartMin = timeToMinutes(tenant.lunch_start_time || '12:00')
  const lunchEndMin = timeToMinutes(tenant.lunch_end_time || '13:00')

  for (let current = startMinutes; current + serviceDuration <= endMinutes; current += interval) {
    const slotTimeString = minutesToTime(current)
    const slotEndMinutes = current + serviceDuration

    const isLunchOverlap = isLunchActive && (current < lunchEndMin && slotEndMinutes > lunchStartMin)

    let isOverlap = false

    if (staffId) {
      // SKENARIO A: User memilih Staf Tertentu -> Cek bentrokan staf tersebut
      isOverlap = existingReservations?.some((res) => {
        const resStart = timeToMinutes(res.time_slot)
        const resEnd = resStart + (res.duration_minutes || 30)
        return current < resEnd && slotEndMinutes > resStart
      }) ?? false
    } else {
      // SKENARIO B: User tidak memilih Staf -> Hitung berapa staf unik yang sibuk di jam ini
      const busyStaffIds = new Set<string>()

      existingReservations?.forEach((res) => {
        const resStart = timeToMinutes(res.time_slot)
        const resEnd = resStart + (res.duration_minutes || 30)

        // Cek apakah ada bentrokan selang waktu
        if (current < resEnd && slotEndMinutes > resStart) {
          if (res.staff_id) {
            busyStaffIds.add(res.staff_id)
          }
        }
      })

      // Slot dianggap PENUH ('booked') HANYA JIKA JUMLAH STAF SIBUK >= TOTAL STAF AKTIF
      isOverlap = busyStaffIds.size >= totalStaffCount
    }

    let isAvailable = true
    let reason: string | undefined = undefined

    if (isLunchOverlap) {
      isAvailable = false
      reason = 'Jam Istirahat'
    } else if (isOverlap) {
      isAvailable = false
      reason = 'booked'
    }

    slots.push({
      time: slotTimeString,
      isAvailable,
      reason,
    })
  }

  return slots
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}