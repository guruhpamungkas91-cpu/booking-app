import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ----------------------------------------------------------------------
// NEXT.JS ROUTE SEGMENT CONFIG (PREVENT STATIC CACHING)
// ----------------------------------------------------------------------
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Header khusus untuk mematikan cache di browser, Vercel Edge Cache, dan CDN
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

// ----------------------------------------------------------------------
// STRICT TYPESCRIPT INTERFACES
// ----------------------------------------------------------------------
interface TenantRecord {
  id: string | number
  tenant_slug?: string | null
  client_code?: string | null
  slug?: string | null
  open_time?: string | null
  close_time?: string | null
  slot_interval?: number | null
  slot_interval_minutes?: number | null
  lunch_start_time?: string | null
  lunch_end_time?: string | null
  hide_booked_slots?: boolean | null
  enable_auto_disable_time_slots?: boolean | null
}

interface BlockedSlotRecord {
  start_time: string
  end_time?: string | null
}

interface ReservationRecord {
  booking_time: string
  duration_minutes?: number | null
  staff_id?: string | number | null
  staff_name?: string | null
  status?: string | null
}

interface StaffRecord {
  id: string | number
  name?: string | null
  is_active?: boolean | null
}

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------
function timeToMinutes(timeStr: unknown): number {
  if (!timeStr || typeof timeStr !== 'string') return 0
  const clean = timeStr.trim().substring(0, 5)
  const [hours, minutes] = clean.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return 0
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function normalizeStaffName(name: string): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/^dr\.\s*/i, '') // Hapus gelar 'dr. '
    .replace(/\s+/g, '')     // Hapus spasi agar 'putriziani' === 'putri ziani'
    .trim()
}

function generateDynamicSlots(
  openTimeStr: string,
  closeTimeStr: string,
  intervalMinutes: number
): string[] {
  const slots: string[] = []
  const startMin = timeToMinutes(openTimeStr)
  const endMin = timeToMinutes(closeTimeStr)
  const interval = intervalMinutes > 0 ? intervalMinutes : 30

  if (startMin >= endMin || interval <= 0) {
    return []
  }

  for (let current = startMin; current < endMin; current += interval) {
    slots.push(minutesToTime(current))
  }

  return slots
}

// ----------------------------------------------------------------------
// ROUTE HANDLER
// ----------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')
    const rawStaff = searchParams.get('staff') || ''
    const rawStaffId = searchParams.get('staff_id') || ''
    const durationParam = Number(searchParams.get('duration')) || 0

    // Bersihkan nilai string "null" atau "undefined" dari parameter query
    const staffQuery = (rawStaff === 'undefined' || rawStaff === 'null') ? '' : rawStaff.trim()
    const staffIdQuery = (rawStaffId === 'undefined' || rawStaffId === 'null') ? '' : rawStaffId.trim()

    if (!dateStr || !tenantSlug) {
      return NextResponse.json(
        { success: false, error: 'Parameter date dan tenant_slug wajib diisi.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. FETCH TENANT DATA
    let tenantData: TenantRecord | null = null

    const { data: tSlug } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle<TenantRecord>()

    if (tSlug) {
      tenantData = tSlug
    } else {
      const { data: tCode } = await supabase
        .from('tenants')
        .select('*')
        .or(`client_code.eq.${tenantSlug},slug.eq.${tenantSlug}`)
        .maybeSingle<TenantRecord>()
      tenantData = tCode
    }

    if (!tenantData) {
      return NextResponse.json(
        { success: false, error: 'Tenant tidak ditemukan di database.' },
        { status: 404, headers: NO_CACHE_HEADERS }
      )
    }

    const openTime = tenantData.open_time || '09:00:00'
    const closeTime = tenantData.close_time || '21:00:00'
    const intervalMinutes =
      Number(tenantData.slot_interval) ||
      Number(tenantData.slot_interval_minutes) ||
      30
    const tenantId = tenantData.id

    // GENERASI SLOT JAM DINAMIS
    const generatedSlots = generateDynamicSlots(openTime, closeTime, intervalMinutes)
    const blockedTimesSet = new Set<string>()
    const blockedReasonsMap = new Map<string, string>()

    // 2. FETCH BLOCKED SLOTS DARI MANAJEMEN ADMIN
    let blockedQuery = supabase
      .from('blocked_slots')
      .select('start_time, end_time')
      .eq('block_date', dateStr)

    if (tenantId) {
      blockedQuery = blockedQuery.or(`tenant_id.eq.${tenantId},tenant_slug.eq.${tenantSlug}`)
    } else {
      blockedQuery = blockedQuery.eq('tenant_slug', tenantSlug)
    }

    const { data: adminBlocked } = await blockedQuery.returns<BlockedSlotRecord[]>()

    // 3. FETCH STAF AKTIF
    let totalActiveStaffCount = 1
    if (tenantId) {
      const { data: staffs } = await supabase
        .from('staff')
        .select('id, name, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .returns<StaffRecord[]>()

      if (staffs && staffs.length > 0) {
        totalActiveStaffCount = staffs.length
      }
    }

    // 4. FETCH RESERVASI TERDAFTAR
    let resQuery = supabase
      .from('reservations')
      .select('booking_time, duration_minutes, staff_id, staff_name, status')
      .eq('booking_date', dateStr)

    if (tenantId) {
      resQuery = resQuery.or(`tenant_id.eq.${tenantId},tenant_slug.eq.${tenantSlug}`)
    } else {
      resQuery = resQuery.eq('tenant_slug', tenantSlug)
    }

    const { data: existingBookings, error: bookingErr } =
      await resQuery.returns<ReservationRecord[]>()

    if (bookingErr) {
      console.error('[API Availability] Error fetch reservations:', bookingErr)
    }

    const activeBookings = (existingBookings || []).filter(
      (b) =>
        b.status !== 'cancelled' &&
        b.status !== 'refunded' &&
        b.status !== 'rejected'
    )

    // 5. EVALUASI PENABRAKAN DURASI & JAM ISTIRAHAT UNTUK SETIAP SLOT
    const lunchStartMin = tenantData.lunch_start_time ? timeToMinutes(tenantData.lunch_start_time) : null
    const lunchEndMin = tenantData.lunch_end_time ? timeToMinutes(tenantData.lunch_end_time) : null
    const closeTimeMin = timeToMinutes(closeTime)
    const effectiveDuration = durationParam > 0 ? durationParam : intervalMinutes

    generatedSlots.forEach((slotStr) => {
      const slotStartMin = timeToMinutes(slotStr)
      const slotEndMin = slotStartMin + effectiveDuration

      // A. Menabrak Jam Tutup Toko
      if (slotEndMin > closeTimeMin) {
        blockedTimesSet.add(slotStr)
        blockedReasonsMap.set(slotStr, 'Penuh')
        return
      }

      // B. Menabrak Jam Istirahat Klinik
      if (lunchStartMin !== null && lunchEndMin !== null && lunchStartMin < lunchEndMin) {
        if (slotStartMin < lunchEndMin && slotEndMin > lunchStartMin) {
          blockedTimesSet.add(slotStr)
          blockedReasonsMap.set(slotStr, 'Jam Istirahat')
          return
        }
      }

      // C. Menabrak Blocked Slots Admin
      if (adminBlocked && adminBlocked.length > 0) {
        const isBlockedByAdmin = adminBlocked.some((b) => {
          if (!b.start_time) return false
          const bStart = timeToMinutes(b.start_time)
          const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + intervalMinutes
          return slotStartMin < bEnd && slotEndMin > bStart
        })
        if (isBlockedByAdmin) {
          blockedTimesSet.add(slotStr)
          blockedReasonsMap.set(slotStr, 'Penuh')
          return
        }
      }

      // D. Menabrak Jadwal Reservasi Staf Spesifik
      if (activeBookings.length > 0) {
        const isNoStaffSelected =
          !staffQuery ||
          staffQuery === 'all' ||
          staffQuery === 'any'

        if (isNoStaffSelected && !staffIdQuery) {
          // Jika user tidak memilih staf spesifik, hitung berapa staf unik yang sibuk
          const busyStaffIdentifiers = new Set<string>()

          activeBookings.forEach((b) => {
            if (!b.booking_time) return
            const bStart = timeToMinutes(b.booking_time)
            const bEnd = bStart + (Number(b.duration_minutes) || intervalMinutes)

            if (slotStartMin < bEnd && slotEndMin > bStart) {
              const identifier = b.staff_id
                ? `id_${b.staff_id}`
                : b.staff_name
                ? `name_${normalizeStaffName(b.staff_name)}`
                : `anon_${Math.random()}`
              busyStaffIdentifiers.add(identifier)
            }
          })

          if (busyStaffIdentifiers.size >= totalActiveStaffCount) {
            blockedTimesSet.add(slotStr)
            blockedReasonsMap.set(slotStr, 'Penuh')
          }
        } else {
          // Jika memilih staf spesifik
          const cleanParam = normalizeStaffName(staffQuery)

          const isStaffBusy = activeBookings.some((b) => {
            if (!b.booking_time) return false

            const cleanResName = normalizeStaffName(b.staff_name || '')

            // Cek kesamaan Staf berdasarkan ID atau Nama
            const isMatchById =
              Boolean(staffIdQuery) &&
              Boolean(b.staff_id) &&
              String(b.staff_id) === String(staffIdQuery)

            const isMatchByName =
              Boolean(cleanParam) &&
              Boolean(cleanResName) &&
              cleanResName.length > 2 &&
              (cleanResName === cleanParam ||
                cleanResName.includes(cleanParam) ||
                cleanParam.includes(cleanResName))

            const isSameStaff = isMatchById || isMatchByName

            if (!isSameStaff) return false

            const bStart = timeToMinutes(b.booking_time)
            const bEnd = bStart + (Number(b.duration_minutes) || intervalMinutes)
            return slotStartMin < bEnd && slotEndMin > bStart
          })

          if (isStaffBusy) {
            blockedTimesSet.add(slotStr)
            blockedReasonsMap.set(slotStr, 'Penuh')
          }
        }
      }
    })

    const blockedTimes = Array.from(blockedTimesSet)
    const blockedDetails = Object.fromEntries(blockedReasonsMap)

    return NextResponse.json(
      {
        success: true,
        slots: generatedSlots,
        blockedTimes,
        blockedDetails,
        bookedReservations: activeBookings,
        tenantSettings: {
          hide_booked_slots: tenantData.hide_booked_slots ?? false,
          enable_auto_disable_time_slots: tenantData.enable_auto_disable_time_slots ?? true,
        },
      },
      {
        headers: NO_CACHE_HEADERS,
      }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('[API Availability] Error:', err)
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}