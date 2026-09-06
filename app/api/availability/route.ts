import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')
    const staff = searchParams.get('staff')

    if (!date || !tenantSlug) {
      return NextResponse.json({ success: false, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Ambil pengaturan tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('enable_slot_blocking, enable_auto_disable_time_slots, hide_booked_slots, prevent_double_booking')
      .or(`slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .single()

    const preventDoubleBooking = tenantData?.prevent_double_booking ?? false
    const enableSlotBlocking = tenantData?.enable_slot_blocking ?? true

    // 2. Query blocked_slots (admin manual block)
    let blockedQuery = supabase
      .from('blocked_slots')
      .select('block_time, start_time')
      .eq('tenant_slug', tenantSlug)
      .eq('block_date', date)

    // 3. Query Reservations (Status aktif: pending, confirmed, completed. Abaikan cancelled & refunded)
    let bookedQuery = supabase
      .from('Reservations')
      .select('booking_time, staff_name, staff_id, status')
      .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .eq('booking_date', date)
      .not('status', 'in', '("cancelled","refunded")')

    if (staff) {
      blockedQuery = blockedQuery.or(`staff_name.eq.${staff},staff_id.eq.${staff}`)
      bookedQuery = bookedQuery.or(`staff_name.eq.${staff},staff_id.eq.${staff}`)
    }

    const [slotConfigsRes, blockedDataRes, bookedDataRes] = await Promise.all([
      supabase
        .from('tenant_slots')
        .select('time_slot, max_quota')
        .eq('tenant_slug', tenantSlug)
        .eq('is_active', true),
      enableSlotBlocking ? blockedQuery : Promise.resolve({ data: [] }),
      bookedQuery
    ])

    const slotConfigs = slotConfigsRes.data || []
    const blockedData = blockedDataRes.data || []
    const bookedData = bookedDataRes.data || []

    // Ambil jam yang diblokir manual oleh admin
    let blockedTimes = blockedData.map(item => (item.block_time || item.start_time)?.substring(0, 5))

    // 4. LOGIKA BARU: Hitung slot berdasarkan max_quota & prevent_double_booking
    // Buat map untuk menghitung jumlah booking aktif di setiap jam (time slot)
    const bookingCountPerSlot: { [key: string]: number } = {}
    bookedData.forEach(item => {
      const t = item.booking_time?.substring(0, 5)
      if (t) {
        bookingCountPerSlot[t] = (bookingCountPerSlot[t] || 0) + 1
      }
    })

    // Cek setiap slot jam yang ada
    slotConfigs.forEach(slot => {
      const timeSlot = slot.time_slot?.substring(0, 5)
      const maxQuota = slot.max_quota || 1
      const currentBookings = bookingCountPerSlot[timeSlot] || 0

      if (timeSlot) {
        if (preventDoubleBooking) {
          // MODE KETAT (Prevent Double Booking ON): 
          // Jika sudah ada reservasi sama sekali di jam tersebut (atau di staff tersebut), langsung blokir!
          if (currentBookings > 0 && !blockedTimes.includes(timeSlot)) {
            blockedTimes.push(timeSlot)
          }
        } else {
          // MODE FLEKSIBEL (Prevent Double Booking OFF):
          // Jam HANYA diblokir jika jumlah booking aktif SUDAH MENCAPAI atau MELEBIHI max_quota.
          // Jadi kalau max_quota = 2, baru ada 1 booking, TIDAK AKAN DIBLOKIR.
          if (currentBookings >= maxQuota && !blockedTimes.includes(timeSlot)) {
            blockedTimes.push(timeSlot)
          }
        }
      }
    })
    
    const bookedReservations = bookedData.map(item => ({
      time: item.booking_time?.substring(0, 5),
      staff: item.staff_name || item.staff_id,
      status: item.status
    }))
    
    const slots = slotConfigs.map(s => ({
      time: s.time_slot?.substring(0, 5),
      max_quota: s.max_quota
    }))

    return NextResponse.json({
      success: true,
      slots,
      blockedTimes,
      bookedReservations,
      tenantSettings: tenantData || {}
    })

  } catch (err: any) {
    console.error('API Availability Error:', err)
    return NextResponse.json({ success: false, blockedTimes: [], bookedReservations: [], slots: [], tenantSettings: {} }, { status: 200 })
  }
}