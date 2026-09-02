import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Ambil Environment Variables dengan Fallback lengkap
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function PATCH(request: Request) {
  try {
    // 1. Validasi keberadaan kredensial Supabase di server runtime
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Environment variables Supabase tidak ditemukan.')
      return NextResponse.json(
        {
          success: false,
          message: 'Server Error: Kredensial Supabase (URL / Key) belum terpasang di environment.',
        },
        { status: 500 }
      )
    }

    // Inisialisasi Supabase Client di dalam handler agar aman saat runtime
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    const { tenant_slug, auto_wa_reminder, prevent_double_booking, hide_booked_slots } = body

    // 2. Validasi tenant_slug
    if (!tenant_slug) {
      return NextResponse.json(
        {
          success: false,
          message: 'Parameter tenant_slug wajib diisi.',
        },
        { status: 400 }
      )
    }

    // 3. Susun objek data yang akan di-update & select kolom secara DINAMIS
    const updateData: Record<string, any> = {}
    
    if (typeof auto_wa_reminder === 'boolean') updateData.auto_wa_reminder = auto_wa_reminder
    if (typeof prevent_double_booking === 'boolean') updateData.prevent_double_booking = prevent_double_booking
    if (typeof hide_booked_slots === 'boolean') updateData.hide_booked_slots = hide_booked_slots

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Tidak ada data pengaturan yang valid untuk diperbarui.',
        },
        { status: 400 }
      )
    }

    // Buat daftar kolom yang di-select sesuai field yang sedang di-update saja
    // 1. Sesuaikan daftar kolom select agar menggunakan tenant_slug
    const selectFields = ['id', 'tenant_slug', ...Object.keys(updateData)].join(', ')

    // 2. Sesuaikan .eq() dan .select() ke kolom tenant_slug
    const { data, error } = await supabase
    .from('Tenants')
    .update(updateData)
    .eq('tenant_slug', tenant_slug) // 👈 Ganti 'slug' menjadi 'tenant_slug'
    .select(selectFields)
    .maybeSingle()

    if (error) {
      console.error('Database Update Error:', error)
      return NextResponse.json(
        {
          success: false,
          message: `Database Error: ${error.message} (${error.code})`,
        },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: `Tenant dengan slug "${tenant_slug}" tidak ditemukan di database.`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Pengaturan tenant berhasil diperbarui.',
      data,
    })

  } catch (err: any) {
    console.error('Server Internal Error:', err)
    return NextResponse.json(
      { 
        success: false, 
        message: `Server Crash: ${err?.message || 'Terjadi kesalahan internal pada server'}` 
      },
      { status: 500 }
    )
  }
}