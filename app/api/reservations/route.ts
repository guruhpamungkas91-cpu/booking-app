import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Inisialisasi Supabase Client Server-Side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Memakai service role key agar aman di server
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenant_slug, client_code, booking_date, booking_time } = body

    // Target slug yang dipakai (bisa dari tenant_slug atau client_code)
    const targetSlug = tenant_slug || client_code

    // 1. BACKEND VALIDATION: Cek apakah slot terblokir di DB (Tabel: BlockedSlots)
    const { data: isBlocked, error: checkError } = await supabase
      .from('BlockedSlots')
      .select('id')
      .or(`client_code.eq.${targetSlug},tenant_slug.eq.${targetSlug}`)
      .eq('block_date', booking_date)
      .eq('block_time', booking_time)
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

    // 2. JIKA AMAN: Lakukan insert ke tabel Reservations
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