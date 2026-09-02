import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Kredensial Supabase tidak ditemukan' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { tenantSlug } = await request.json()

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug wajib diisi' }, { status: 400 })
    }

    // Ambil kolom qris_url dari tabel Tenants secara otomatis
    const { data: tenant, error } = await supabase
      .from('Tenants')
      .select('qris_url')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle()

    if (error || !tenant?.qris_url) {
      return NextResponse.json({ error: 'QRIS tidak ditemukan di database' }, { status: 404 })
    }

    // Mengembalikan URL publik dari database
    return NextResponse.json({ qrUrl: tenant.qris_url })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal generate QRIS' }, { status: 500 })
  }
}