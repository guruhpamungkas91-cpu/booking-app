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

    // --- INTEGRASI FEATURE FLAG: Cek settingan tenant ---
    const { data: tenantData } = await supabase
      .from('tenants') // Sesuaikan nama tabel jika menggunakan 'businesses'
      .select('enable_slot_blocking')
      .or(`tenant_slug.eq.${targetSlug},client_code.eq.${targetSlug}`)
      .maybeSingle()

    // Jika tenant mengaktifkan fitur slot blocking (atau jika data setting belum ada/default true)
    const isBlockingEnabled = tenantData?.enable_slot_blocking ?? true

    if (isBlockingEnabled) {
      // 1. CEK DIBLOKIR / LIBUR (Tabel blocked_slots)
      const { data: isBlocked, error: checkBlockedError } = await supabase
        .from('blocked_slots')
        .select('id')
        .eq('tenant_id', targetSlug)
        .eq('date', booking_date)
        .eq('start_time', booking_time)
        .maybeSingle()

      if (checkBlockedError) {
        console.error('Error Cek Blocked Slot:', checkBlockedError)
        return NextResponse.json({ error: 'Gagal mengecek ketersediaan slot.' }, { status: 500 })
      }

      if (isBlocked) {
        return NextResponse.json(
          { 
            success: false, 
            code: 'STORE_CLOSED',
            error: 'Maaf, layanan tidak tersedia pada tanggal/jam tersebut. Silakan pilih jadwal operasional lainnya.' 
          },
          { status: 400 }
        )
      }

      // 2. CEK SUDAH DIBOOKING CUSTOMER LAIN (Tabel Reservations)
      const { data: isBooked, error: checkBookedError } = await supabase
        .from('Reservations')
        .select('id')
        .or(`tenant_slug.eq.${targetSlug},client_code.eq.${targetSlug}`)
        .eq('booking_date', booking_date)
        .eq('booking_time', booking_time)
        .neq('status', 'cancelled') // Mengecualikan reservasi yang dibatalkan
        .maybeSingle()

      if (checkBookedError) {
        console.error('Error Cek Existing Reservation:', checkBookedError)
        return NextResponse.json({ error: 'Gagal mengecek reservasi yang ada.' }, { status: 500 })
      }

      if (isBooked) {
        return NextResponse.json(
          { 
            success: false, 
            code: 'SLOT_BOOKED',
            error: 'Maaf, slot waktu ini sudah dipesan. Silakan pilih jam atau tanggal lain.' 
          },
          { status: 400 }
        )
      }
    }

    // 3. JIKA AMAN ATAU FEATURE FLAG DISABLED: Insert ke tabel Reservations
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