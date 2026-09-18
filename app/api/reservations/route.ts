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

    // --- 0. AMBIL STATUS TOGGLE PREVENT DOUBLE BOOKING DARI DATABASE ---
    const { data: tenantSettings } = await supabase
      .from('tenants')
      .select('id, prevent_double_booking')
      .or(`slug.eq.${body.tenant_slug},client_code.eq.${body.client_code}`)
      .maybeSingle()

    // Jika toggle belum diset atau kosong, default-nya TRUE (aktif)
    const isPreventDoubleBookingOn = tenantSettings?.prevent_double_booking ?? true

    // 1. Cek dulu apakah slot jam yang dipilih diblokir/libur oleh admin
    const { data: checkBlocked } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('tenant_slug', body.tenant_slug)
      .eq('date', body.booking_date)
      .eq('start_time', body.booking_time)
      .maybeSingle()

    if (checkBlocked) {
      return NextResponse.json(
        { error: 'Maaf, slot sudah penuh silahkan pilih slot jam lain.' },
        { status: 400 }
      )
    }

    // --- 2. VALIDASI ANTI-JEBOL PER STAFF (TETAP JALAN NORMAL SEPERTI SEMULA) ---
    if (body.staff_name) {
      const targetDate = body.booking_date
      const targetTime = body.booking_time?.substring(0, 5)
      
      const cleanInputStaff = body.staff_name.toLowerCase().replace(/^dr\.\s*/i, '').trim()

      const { data: staffInfo } = await supabase
        .from('staff')
        .select('max_slots')
        .or(`tenant_slug.eq.${body.tenant_slug},client_code.eq.${body.client_code}`)
        .ilike('name', `%${cleanInputStaff}%`)
        .maybeSingle()

      const allowedMaxSlots = staffInfo?.max_slots || 1

      const { count: activeBookingCount, error: countErr } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_slug', body.tenant_slug)
        .eq('booking_date', targetDate)
        .eq('booking_time', targetTime)
        .ilike('staff_name', `%${cleanInputStaff}%`)
        .not('status', 'in', '("cancelled","refunded","rejected")')

      // Validasi staff tetap aktif menjaga kapasitas maksimal per staff
      if (!countErr && (activeBookingCount || 0) >= allowedMaxSlots) {
        return NextResponse.json({ 
          success: false, 
          error: `Maaf, jadwal untuk staff ${body.staff_name} pada jam ${targetTime} sudah penuh (${activeBookingCount}/${allowedMaxSlots}).` 
        }, { status: 400 })
      }
    }
    // -------------------------------------------------------------------------

    // 3. AMBIL MAX QUOTA DINAMIS DARI DATABASE TENANT_SLOTS (Global Slot)
    const { data: slotConfig } = await supabase
      .from('tenant_slots')
      .select('max_quota')
      .eq('tenant_slug', body.tenant_slug)
      .eq('time_slot', body.booking_time)
      .maybeSingle()

    const targetMaxQuota = slotConfig?.max_quota || 1

    // --- 4. AMBIL TENANT_ID AGAR TIDAK NULL ---
    let resolvedTenantId = body.tenant_id || tenantSettings?.id || null
    if (!resolvedTenantId && body.tenant_slug) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', body.tenant_slug)
        .maybeSingle()
      
      if (tenantData) {
        resolvedTenantId = tenantData.id
      }
    }
    // ----------------------------------------

    // --- 5. AMBIL HARGA ASLI DARI TABEL SERVICES (SUPPORT MULTI-SERVICES) ---
    let resolvedPrice = 0
    let servicesList: string[] = []

    if (Array.isArray(body.selected_services) && body.selected_services.length > 0) {
      servicesList = body.selected_services
    } else if (body.service_name) {
      servicesList = [body.service_name]
    }

    if (servicesList.length > 0) {
      const { data: servicesData } = await supabase
        .from('services')
        .select('name, price')
        .in('name', servicesList)
        .eq('client_code', body.client_code)

      if (servicesData && servicesData.length > 0) {
        resolvedPrice = servicesData.reduce((sum, item) => sum + Number(item.price || 0), 0)
      } else {
        const { data: fallbackServices } = await supabase
          .from('services')
          .select('name, price')
          .in('name', servicesList)
        
        resolvedPrice = fallbackServices 
          ? fallbackServices.reduce((sum, item) => sum + Number(item.price || 0), 0) 
          : (body.total_price ? Number(body.total_price) : 0)
      }
    }
    // ---------------------------------------------

    // 6. Sanitasi payload
    const payload = {
      customer_name: body.customer_name || '',
      whatsapp_number: body.whatsapp_number || '',
      booking_date: body.booking_date || '',
      booking_time: body.booking_time || '',
      service_name: body.service_name || '',
      staff_name: body.staff_name || null,
      payment_method: body.payment_method || 'QRIS',
      status: body.status || 'pending',
      client_code: body.client_code || '',
      tenant_slug: body.tenant_slug || '',
      tenant_id: resolvedTenantId,
      payment_type: body.payment_type || 'FULL',
      total_price: resolvedPrice,
      person_count: body.person_count ? Number(body.person_count) : 1,
      need_remove_lash: Boolean(body.need_remove_lash),
      addon_person_count: body.addon_person_count ? Number(body.addon_person_count) : 0,
      has_eye_allergy_consent: Boolean(body.has_eye_allergy_consent),
      eye_shape_notes: body.eye_shape_notes || null
    }

    // --- 7. PANGGIL SUPABASE RPC book_slot_safely ---
    // Logika Pintar: 
    // - Jika toggle Prevent Double Booking ON -> Gunakan kuota normal (targetMaxQuota), sehingga aman dari bentrok.
    // - Jika toggle Prevent Double Booking OFF -> Berikan kuota longgar (misal 999), sehingga sistem mengizinkan booking masuk walau bersamaan.
    const finalQuotaToEnforce = isPreventDoubleBookingOn ? targetMaxQuota : 99999

    const { data: rpcData, error: rpcError } = await supabase.rpc('book_slot_safely', {
      p_tenant_slug: payload.tenant_slug,
      p_booking_date: payload.booking_date,
      p_booking_time: payload.booking_time,
      p_max_quota: finalQuotaToEnforce,
      p_customer_data: payload
    })

    if (rpcError) {
      console.error('Supabase RPC Error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    if (!rpcData.success) {
      return NextResponse.json({ error: rpcData.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: rpcData }, { status: 200 })

  } catch (err: any) {
    console.error('Server Internal Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}