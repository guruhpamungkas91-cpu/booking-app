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

    // JALANKAN SEMUA QUERY SUPABASE SECARA BERSAMAAN (PARALLEL) AGAR KILAT ⚡
    const [slotConfigsRes, blockedDataRes, bookedDataRes] = await Promise.all([
      supabase
        .from('tenant_slots')
        .select('time_slot, max_quota')
        .eq('tenant_slug', tenantSlug)
        .eq('is_active', true),

      supabase
        .from('blocked_slots')
        .select('block_time, start_time')
        .eq('tenant_slug', tenantSlug)
        .eq('block_date', date),

      supabase
        .from('Reservations')
        .select('booking_time')
        .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
        .eq('booking_date', date)
        .neq('status', 'cancelled')
    ])

    const slotConfigs = slotConfigsRes.data
    const blockedData = blockedDataRes.data
    const bookedData = bookedDataRes.data

    const blockedTimes = blockedData ? blockedData.map(item => (item.block_time || item.start_time)?.substring(0, 5)) : []
    const bookedTimes = bookedData ? bookedData.map(item => item.booking_time?.substring(0, 5)) : []
    
    const slots = slotConfigs ? slotConfigs.map(s => ({
      time: s.time_slot?.substring(0, 5),
      max_quota: s.max_quota
    })) : []

    return NextResponse.json({
      success: true,
      slots,
      blockedTimes,
      bookedTimes
    })

  } catch (err: any) {
    console.error('API Availability Error:', err)
    return NextResponse.json({ success: false, blockedTimes: [], bookedTimes: [], slots: [] }, { status: 200 })
  }
}