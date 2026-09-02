import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')

    if (!date || !tenantSlug) {
      return NextResponse.json({ success: false, blockedTimes: [], bookedTimes: [] }, { status: 200 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: true, blockedTimes: [], bookedTimes: [] }, { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch slot diblokir
    // FIX: Hanya panggil tenant_slug (karena tenant_id tidak ada di tabel blocked_slots)
    const { data: blockedData, error: blockedErr } = await supabase
      .from('blocked_slots')
      .select('start_time')
      .eq('tenant_slug', tenantSlug)
      .eq('date', date)

    if (blockedErr) {
      console.error('Error fetching blocked_slots:', blockedErr)
    }

    // 2. Fetch slot terisi
    const { data: bookedData, error: bookedErr } = await supabase
      .from('Reservations')
      .select('booking_time')
      .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .eq('booking_date', date)
      .neq('status', 'cancelled')

    if (bookedErr) {
      console.error('Error fetching Reservations:', bookedErr)
    }

    const blockedTimes = blockedData ? blockedData.map(item => item.start_time?.substring(0, 5)) : []
    const bookedTimes = bookedData ? bookedData.map(item => item.booking_time?.substring(0, 5)) : []

    return NextResponse.json({
      success: true,
      blockedTimes,
      bookedTimes
    })

  } catch (err: any) {
    console.error('API Availability Error:', err)
    return NextResponse.json({ success: false, blockedTimes: [], bookedTimes: [] }, { status: 200 })
  }
}