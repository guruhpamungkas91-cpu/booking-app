import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function PATCH(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Environment variables Supabase tidak ditemukan.');
      return NextResponse.json(
        { success: false, message: 'Server Error: Kredensial Supabase belum lengkap.' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    
    // Gunakan tenant_id (UUID) sebagai parameter utama pencarian tenant
    const { tenant_id, tenant_slug, auto_wa_reminder, prevent_double_booking, hide_booked_slots } = body;

    if (!tenant_id && !tenant_slug) {
      return NextResponse.json(
        { success: false, message: 'Parameter tenant_id atau tenant_slug wajib diisi.' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (typeof auto_wa_reminder === 'boolean') updateData.auto_wa_reminder = auto_wa_reminder;
    if (typeof prevent_double_booking === 'boolean') updateData.prevent_double_booking = prevent_double_booking;
    if (typeof hide_booked_slots === 'boolean') updateData.hide_booked_slots = hide_booked_slots;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada data pengaturan yang valid untuk diperbarui.' },
        { status: 400 }
      );
    }

    const selectFields = ['id', 'tenant_slug', ...Object.keys(updateData)].join(', ');

    // Mulai query ke tabel tenants (pastikan huruf kecil: 'tenants')
    let query = supabase.from('tenants').update(updateData);

    // Prioritaskan pencarian berdasarkan tenant_id (UUID), fallback ke tenant_slug jika diperlukan
    if (tenant_id) {
      query = query.eq('id', tenant_id);
    } else {
      query = query.eq('tenant_slug', tenant_slug);
    }

    const { data, error } = await query.select(selectFields).maybeSingle();

    if (error) {
      console.error('Database Update Error:', error);
      return NextResponse.json(
        { success: false, message: `Database Error: ${error.message} (${error.code})` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: `Tenant tidak ditemukan di database.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pengaturan tenant berhasil diperbarui.',
      data,
    });

  } catch (err: any) {
    console.error('Server Internal Error:', err);
    return NextResponse.json(
      { success: false, message: `Server Crash: ${err?.message || 'Terjadi kesalahan internal'}` },
      { status: 500 }
    );
  }
}