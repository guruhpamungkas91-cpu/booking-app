import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')

    if (!date || !tenantSlug) {
      return NextResponse.json({ success: false, blockedTimes: [], bookedTimes: [], slots: [] }, { status: 200 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, blockedTimes: [], bookedTimes: [], slots: [] }, { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 0. Ambil tenant_id berdasarkan tenantSlug dari tabel tenants (jika ada tabel tenants)
    // Atau langsung ambil tenant_slots berdasarkan tenant_id yang sudah kita tahu ('a70d8f4b-0c31-4c14-9ee6-4e209852ac0c' untuk mcut)
    let tenantId = null
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .maybeSingle()

    if (tenantData) {
      tenantId = tenantData.id
    } else if (tenantSlug === 'mcut') {
      tenantId = 'a70d8f4b-0c31-4c14-9ee6-4e209852ac0c' // Fallback hardcode khusus mcut kalau tabel tenants-nya beda kolom
    }

    // 1. Fetch master slot jam & max_quota dari tabel tenant_slots berdasarkan tenantId
    let slotConfigQuery = supabase.from('tenant_slots').select('time_slot, max_quota').eq('is_active', true)
    if (tenantId) {
      slotConfigQuery = slotConfigQuery.eq('tenant_id', tenantId)
    } else {
      slotConfigQuery = slotConfigQuery.eq('tenant_slug', tenantSlug) // Jaga-jaga kalau suatu saat kolom slug ditambahkan
    }
    const { data: slotConfigs } = await slotConfigQuery

    // 2. Fetch slot diblokir
    const { data: blockedData } = await supabase
      .from('blocked_slots')
      .select('block_time, start_time')
      .eq('tenant_slug', tenantSlug)
      .eq('block_date', date)

    // 3. Fetch slot terisi dari Reservations
    const { data: bookedData } = await supabase
      .from('Reservations')
      .select('booking_time')
      .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .eq('booking_date', date)
      .neq('status', 'cancelled')

    // Mapping data jam
    const blockedTimes = blockedData ? blockedData.map(item => (item.block_time || item.start_time)?.substring(0, 5)) : []
    const bookedTimes = bookedData ? bookedData.map(item => item.booking_time?.substring(0, 5)) : []
    
    // Kirim juga master slots dan max_quotanya ke frontend supaya pilihan jam bisa muncul!
    const slots = slotConfigs ? slotConfigs.map(s => ({
      time: s.time_slot?.substring(0, 5),
      max_quota: s.max_quota
    })) : []

    return NextResponse.json({
      success: true,
      slots, // Data jam operasional dari tenant_slots
      blockedTimes,
      bookedTimes
    })

  } catch (err: any) {
    console.error('API Availability Error:', err)
    return NextResponse.json({ success: false, blockedTimes: [], bookedTimes: [], slots: [] }, { status: 200 })
  }
}