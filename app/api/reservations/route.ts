import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // Inisialisasi di dalam handler agar tidak crash saat npm run build
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    const { tenant_slug, client_code, booking_date, booking_time } = body

    const targetSlug = tenant_slug || client_code

    // 1. BACKEND VALIDATION: Cek slot terblokir
    const { data: isBlocked, error: checkError } = await supabase
      .from('blocked_slots')
      .select('id')
      .eq('tenant_id', targetSlug)
      .eq('date', booking_date)
      .eq('start_time', booking_time)
      .maybeSingle()

    if (checkError) {
      console.error('Error Cek Slot:', checkError)
      return NextResponse.json({ error: 'Gagal mengecek ketersediaan slot.' }, { status: 500 })
    }

    if (isBlocked) {
      return NextResponse.json(
        { error: 'Maaf, slot jadwal pada jam tersebut sedang terblokir!' },
        { status: 400 }
      )
    }

    // 2. JIKA AMAN: Insert ke tabel Reservations
    const { data: insertedData, error: insertError } = await supabase
      .from('Reservations')
      .insert([body])
      .select('id')
      .single()

    if (insertError) {
      console.error('Error Insert Reservation:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: insertedData }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}