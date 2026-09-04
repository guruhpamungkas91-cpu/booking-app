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

    // 1. Cek dulu apakah slot jam yang dipilih diblokir/libur
    const { data: checkBlocked, error: checkErr } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('tenant_slug', body.tenant_slug)
      .eq('date', body.booking_date)
      .eq('start_time', body.booking_time)
      .maybeSingle()

    if (checkErr) {
      console.error('Error Cek Blocked Slot:', checkErr)
    }

    if (checkBlocked) {
      return NextResponse.json(
        { error: 'Maaf, tanggal dan jam ini sudah diblokir oleh admin.' },
        { status: 400 }
      )
    }

    // 2. Sanitasi payload
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
      payment_type: body.payment_type || 'FULL',
      person_count: body.person_count ? Number(body.person_count) : 1,
      need_remove_lash: Boolean(body.need_remove_lash),
      addon_person_count: body.addon_person_count ? Number(body.addon_person_count) : 0,
      has_eye_allergy_consent: Boolean(body.has_eye_allergy_consent),
      eye_shape_notes: body.eye_shape_notes || null
    }

    // 3. PANGGIL SUPABASE RPC (Aman dari Double Booking / Race Condition)
    const { data: rpcData, error: rpcError } = await supabase.rpc('book_slot_safely', {
      p_tenant_slug: payload.tenant_slug,
      p_booking_date: payload.booking_date,
      p_booking_time: payload.booking_time,
      p_max_quota: 1, // Sesuaikan kuota per jam (bisa diatur dinamis jika diperlukan)
      p_customer_data: payload
    })

    if (rpcError) {
      console.error('Supabase RPC Error:', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    // Cek hasil validasi dari fungsi database
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