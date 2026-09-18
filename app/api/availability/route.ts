import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')
    const staff = searchParams.get('staff') // Bisa berupa staff_name atau staff_id

    if (!date || !tenantSlug) {
      return NextResponse.json({ success: false, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const lowerTenantSlug = tenantSlug.toLowerCase().trim()

    // 1. Ambil pengaturan tenant (gunakan .ilike agar aman dari perbedaan huruf besar/kecil)
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, tenant_slug, client_code, enable_slot_blocking, enable_auto_disable_time_slots, hide_booked_slots, prevent_double_booking')
      .or(`tenant_slug.ilike.${lowerTenantSlug},client_code.ilike.${lowerTenantSlug}`)
      .maybeSingle()

    if (tenantErr || !tenantData) {
      console.error("Tenant tidak ditemukan lewat slug:", tenantSlug, tenantErr)
    }

    // Gunakan tenant_slug yang valid dari database jika ada, fallback ke parameter
    const activeTenantSlug = tenantData?.tenant_slug || tenantSlug
    const activeClientCode = tenantData?.client_code || tenantSlug

    const enableSlotBlocking = tenantData?.enable_slot_blocking ?? true
    const cleanStaffParam = staff ? staff.toLowerCase().replace(/^dr\.?\s*/i, '').trim() : ''

    // 2. Query blocked_slots (admin manual block) dengan insensitive match
    let blockedQuery = supabase
      .from('blocked_slots')
      .select('start_time, staff_name, staff_id')
      .ilike('tenant_slug', activeTenantSlug)
      .eq('block_date', date)

    // 3. Query Reservations (Gunakan .ilike untuk tenant_slug & client_code agar lebih toleran)
    let bookedQuery = supabase
      .from('reservations') 
      .select('booking_time, staff_name, staff_id, status, tenant_slug, client_code, booking_date')
      .or(`tenant_slug.ilike.${activeTenantSlug},client_code.ilike.${activeClientCode}`)
      .eq('booking_date', date)
      .not('status', 'in', '("cancelled","refunded","rejected")')

    // 4. Ambil data staff untuk mendapatkan max_slots masing-masing staff
    let staffQuery = supabase
      .from('staff')
      .select('id, name, max_slots')
      .or(`tenant_slug.ilike.${activeTenantSlug},client_code.ilike.${activeClientCode}`)

    const [slotConfigsRes, blockedDataRes, bookedDataRes, staffDataRes] = await Promise.all([
      supabase
        .from('tenant_slots')
        .select('time_slot, max_quota')
        .ilike('tenant_slug', activeTenantSlug)
        .eq('is_active', true),
      enableSlotBlocking ? blockedQuery : Promise.resolve({ data: [] }),
      bookedQuery,
      staffQuery
    ])

    const slotConfigs = slotConfigsRes.data || []
    const blockedData = blockedDataRes.data || []
    const bookedData = bookedDataRes.data || []
    const staffList = staffDataRes.data || []

    // DEBUG TERMINAL (Cek di terminal VS Code lu nanti)
    console.log("=== BACKEND AVAILABILITY DEBUG ===")
    console.log("Tanggal:", date, "| Tenant Slug:", activeTenantSlug, "| Staff Dipilih:", staff)
    console.log("Total Reservasi Ditemukan di DB:", bookedData.length, bookedData)

    // Buat mapping max_slots per staff
    const staffMaxSlotsMap: Record<string, number> = {}
    staffList.forEach((s: { name?: string | null; id?: string | null; max_slots?: number | null }) => {
      const maxSlotsVal = s.max_slots ?? 1
      if (s.name) {
        const rawName = String(s.name).toLowerCase().trim()
        const cleanName = rawName.replace(/^dr\.?\s*/i, '').trim()
        staffMaxSlotsMap[rawName] = maxSlotsVal
        staffMaxSlotsMap[cleanName] = maxSlotsVal
      }
      if (s.id) {
        staffMaxSlotsMap[String(s.id).trim()] = maxSlotsVal
      }
    })

    // 1. Ambil jam yang diblokir manual oleh admin
    const blockedTimes: string[] = []
    
    blockedData.forEach((item: { block_time?: string | null; start_time?: string | null; staff_name?: string | null; staff_id?: string | null }) => {
      const time = (item.block_time || item.start_time)?.substring(0, 5)
      if (!time) return

      if (staff && cleanStaffParam) {
        const itemStaffName = String(item.staff_name || '').toLowerCase().replace(/^dr\.?\s*/i, '').trim()
        const itemStaffId = String(item.staff_id || '').trim()
        if (itemStaffName.includes(cleanStaffParam) || itemStaffId === staff.trim()) {
          if (!blockedTimes.includes(time)) blockedTimes.push(time)
        }
      } else {
        if (!blockedTimes.includes(time)) blockedTimes.push(time)
      }
    })

    // 2. Akumulasi data booking menggunakan array list agar pencocokan fleksibel
    const bookingCountPerSlot: Record<string, number> = {}
    const activeBookingsList: Array<{ time: string; staffName: string }> = []
    
    bookedData.forEach((item: { booking_time?: string | null; staff_name?: string | null; staff_id?: string | null }) => {
      const timeSlot = item.booking_time?.substring(0, 5)
      const itemStaff = String(item.staff_name || '').toLowerCase().replace(/^dr\.?\s*/i, '').trim()
      
      if (timeSlot) {
        bookingCountPerSlot[timeSlot] = (bookingCountPerSlot[timeSlot] || 0) + 1
        
        if (itemStaff) {
          activeBookingsList.push({
            time: timeSlot,
            staffName: itemStaff
          })
        }
      }
    })

    // 3. Masukkan hasil cek kapasitas ke dalam array blockedTimes
    slotConfigs.forEach((slot: { time_slot?: string | null; max_quota?: number | null }) => {
      const timeSlot = slot.time_slot?.substring(0, 5)
      if (!timeSlot) return

      const globalMaxQuota = slot.max_quota ?? 1
      const totalGlobalBookings = bookingCountPerSlot[timeSlot] || 0

      // Kondisi Global: Jika kuota global tenant habis
      if (totalGlobalBookings >= globalMaxQuota) {
        if (!blockedTimes.includes(timeSlot)) {
          blockedTimes.push(timeSlot)
        }
      }

      // Kondisi Per-Staff: Jika staff tertentu sudah penuh
      if (staff && cleanStaffParam) {
        // Ambil max_slots staff dari mapping database, atau fallback ke 1
        const maxSlots = staffMaxSlotsMap[cleanStaffParam] || 1
        
        const currentStaffBookings = activeBookingsList.filter(
          b => b.time === timeSlot && (b.staffName.includes(cleanStaffParam) || cleanStaffParam.includes(b.staffName))
        ).length

        console.log(`Cek Jam ${timeSlot} untuk Staff ${cleanStaffParam}: Booking=${currentStaffBookings}, MaxSlots=${maxSlots}`)

        if (currentStaffBookings >= maxSlots && !blockedTimes.includes(timeSlot)) {
          blockedTimes.push(timeSlot)
        }
      }
    })
    
    const bookedReservations = bookedData.map((item: { booking_time?: string | null; staff_name?: string | null; staff_id?: string | null; status?: string | null }) => ({
      time: item.booking_time?.substring(0, 5),
      staff: item.staff_name || item.staff_id,
      status: item.status
    }))
    
    const hideBookedSlots = tenantData?.hide_booked_slots ?? false
    const autoDisableSlots = tenantData?.enable_auto_disable_time_slots ?? true

    let slots = slotConfigs.map((s: { time_slot?: string | null; max_quota?: number | null }) => {
      const time = s.time_slot?.substring(0, 5) || ''
      const isBlocked = blockedTimes.includes(time)

      return {
        time,
        max_quota: s.max_quota,
        is_available: autoDisableSlots ? !isBlocked : true,
        disabled: autoDisableSlots ? isBlocked : false
      }
    })

    if (hideBookedSlots) {
      slots = slots.filter(slot => !blockedTimes.includes(slot.time))
    }

    console.log("Final Blocked Times yang dikirim ke Frontend:", blockedTimes)

    return NextResponse.json({
      success: true,
      slots,
      blockedTimes,
      bookedReservations,
      tenantSettings: {
        hide_booked_slots: tenantData?.hide_booked_slots ?? false,
        enable_auto_disable_time_slots: autoDisableSlots
      }
    })

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('API Availability Error:', errorMessage)
    return NextResponse.json({ success: false, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
  }
}