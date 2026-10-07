import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase credentials missing on server environment' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // --- 0. AMBIL TENANT DATA & TOGGLE ---
    const { data: tenantSettings } = await supabase
      .from('tenants')
      .select('id, prevent_double_booking, slot_mode')
      .or(`tenant_slug.eq.${body.tenant_slug},client_code.eq.${body.client_code}`)
      .maybeSingle()

    const isPreventDoubleBookingOn = tenantSettings?.prevent_double_booking ?? true
    const resolvedTenantId = body.tenant_id || tenantSettings?.id || null

    if (!resolvedTenantId) {
      return NextResponse.json({ error: 'Tenant tidak ditemukan.' }, { status: 404 })
    }

    // --- 1. CEK DIBLOKIR / LIBUR BY ADMIN ---
    const { data: checkBlocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('tenant_slug', body.tenant_slug)
      .eq('block_date', body.booking_date)
      .eq('start_time', body.booking_time)
      .maybeSingle()

    if (checkBlocked) {
      return NextResponse.json(
        { error: 'Maaf, slot waktu ini diblokir/libur oleh admin.' },
        { status: 400 }
      )
    }

    // --- 2. HITUNG TOTAL DURASI & HARGA DARI SERVICES ---
    let resolvedPrice = 0
    let totalDuration = 30 // Default 30 menit
    // 1. Kumpulkan seluruh layanan (Service Utama + Add-ons) ke dalam satu array
    const servicesList : string[] = []

    // Handling Service Utama
    if (Array.isArray(body.selected_services) && body.selected_services.length > 0) {
      servicesList.push(...body.selected_services.map((item: unknown) => String(item)))
    } else if (body.service_name) {
      servicesList.push(String(body.service_name))
    }

    // Handling Add-ons (Mendukung key selected_addons maupun selectedAddonIds)
    const rawAddons = body.selected_addons || body.selectedAddonIds || body.selected_add_ons
    if (Array.isArray(rawAddons) && rawAddons.length > 0) {
      servicesList.push(...rawAddons.map((item: unknown) => String(item)))
    }

    // 2. Query ke Supabase untuk menghitung total harga & durasi
    if (servicesList.length > 0) {
      const { data: servicesData } = await supabase
        .from('services')
        .select('name, price, duration')
        .in('name', servicesList)

      if (servicesData && servicesData.length > 0) {
        resolvedPrice = servicesData.reduce((sum, item) => sum + Number(item.price || 0), 0)
        
        // Hitung akumulasi durasi (treatment + add-on)
        totalDuration = servicesData.reduce((sum, item) => sum + Number(item.duration || 0), 0)
        
        // Fallback durasi jika totalnya 0 (misal: default minimum 30 menit)
        if (totalDuration === 0) {
          totalDuration = 30
        }
      } else {
        // Fallback jika nama service tidak cocok di DB
        resolvedPrice = body.total_price ? Number(body.total_price) : 0
        totalDuration = body.duration ? Number(body.duration) : 30
      }
    }

    // Calculate start & end minutes for overlapping check
    const bookingTimeStr = body.booking_time?.substring(0, 5) || '09:00'
    const newStartMin = timeToMinutes(bookingTimeStr)
    const newEndMin = newStartMin + totalDuration

    // --- 3. AMBIL SELURUH STAF AKTIF TENANT ---
    const { data: activeStaffs } = await supabase
      .from('staff')
      .select('id, name')
      .eq('tenant_id', resolvedTenantId)
      .eq('is_active', true)

    let assignedStaffId = body.staff_id || null
    let assignedStaffName = body.staff_name || null

    // --- 4. VALIDASI ANTI-DOUBLE BOOKING & AUTO-ASSIGN STAFF ---
    if (isPreventDoubleBookingOn && activeStaffs && activeStaffs.length > 0) {
      // Ambil reservasi aktif pada tanggal tersebut
      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('staff_id, staff_name, booking_time, duration_minutes')
        .eq('tenant_id', resolvedTenantId)
        .eq('booking_date', body.booking_date)
        .not('status', 'in', '("cancelled","refunded","rejected")')

      // Filter reservasi yang berbenturan waktu (Overlapping Check)
      const overlappingReservations = (existingReservations || []).filter((res) => {
        const resTime = res.booking_time || '00:00'
        const resStart = timeToMinutes(resTime.substring(0, 5))
        const resEnd = resStart + (res.duration_minutes || 30)

        // Rumus bentrokan selang waktu:
        return newStartMin < resEnd && newEndMin > resStart
      })

      if (assignedStaffId || assignedStaffName) {
        // SKENARIO A: KLIEN PILIH STAF SPESIFIK
        const isStaffBusy = overlappingReservations.some((res) => {
          if (assignedStaffId && res.staff_id) return res.staff_id === assignedStaffId
          if (assignedStaffName && res.staff_name) {
            const clean1 = assignedStaffName.toLowerCase().replace(/^dr\.\s*/i, '').trim()
            const clean2 = res.staff_name.toLowerCase().replace(/^dr\.\s*/i, '').trim()
            return clean1 === clean2
          }
          return false
        })

        if (isStaffBusy) {
          return NextResponse.json(
            { success: false, error: `Maaf, ${assignedStaffName || 'Staf'} sedang ada pelayanan di rentang waktu tersebut (${bookingTimeStr} - ${minutesToTime(newEndMin)}).` },
            { status: 400 }
          )
        }
      } else {
        // SKENARIO B: KLIEN TIDAK PILIH STAF -> AUTO ASSIGN STAF KOSONG
        const busyStaffIds = new Set(
          overlappingReservations
            .map((res) => res.staff_id)
            .filter((id): id is string => Boolean(id))
        )

        const availableStaff = activeStaffs.find((s) => !busyStaffIds.has(s.id))

        if (!availableStaff) {
          return NextResponse.json(
            { success: false, error: `Maaf, seluruh staf sudah terisi penuh di jam ${bookingTimeStr}. Silakan pilih jam lain.` },
            { status: 400 }
          )
        }

        // Cari staf kosong dan assign otomatis
        assignedStaffId = availableStaff.id
        assignedStaffName = availableStaff.name
      }
    }

    // --- 5. DISIMPANKAN KE DATABASE (INSERT DIRECT/RPC) ---
    const payload = {
      tenant_id: resolvedTenantId,
      tenant_slug: body.tenant_slug || '',
      client_code: body.client_code || '',
      customer_name: body.customer_name || '',
      whatsapp_number: body.whatsapp_number || '',
      booking_date: body.booking_date || '',
      booking_time: bookingTimeStr, // Kolom ini yang benar untuk waktu
      duration_minutes: totalDuration,
      service_name: body.service_name || servicesList.join(', '),
      staff_id: assignedStaffId,
      staff_name: assignedStaffName,
      payment_method: body.payment_method || 'QRIS',
      status: body.status || 'pending',
      payment_type: body.payment_type || 'FULL',
      total_price: resolvedPrice,
      person_count: body.person_count ? Number(body.person_count) : 1,
      need_remove_lash: Boolean(body.need_remove_lash),
      addon_person_count: body.addon_person_count ? Number(body.addon_person_count) : 0,
      has_eye_allergy_consent: Boolean(body.has_eye_allergy_consent),
      eye_shape_notes: body.eye_shape_notes || null,
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('reservations')
      .insert([payload])
      .select()
      .single()

    if (insertError) {
      console.error('Database Insert Error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: insertedData }, { status: 200 })

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error'
    console.error('Server Internal Error:', err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
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