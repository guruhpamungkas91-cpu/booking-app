import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const tenantSlug = searchParams.get('tenant_slug')

    if (!date || !tenantSlug) {
      return NextResponse.json({ error: 'Date & tenant_slug required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Cek Feature Flag Tenant
    const { data: tenantData } = await supabase
      .from('Tenants')
      .select('enable_auto_disable_time_slots')
      .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .maybeSingle()

    const isAutoDisableActive = tenantData?.enable_auto_disable_time_slots ?? true

    if (!isAutoDisableActive) {
      return NextResponse.json({ success: true, blockedTimes: [], bookedTimes: [] })
    }

    // 2. Fetch slot diblokir admin / libur
    const { data: blockedData } = await supabase
      .from('blocked_slots')
      .select('start_time')
      .eq('tenant_id', tenantSlug)
      .eq('date', date)

    // 3. Fetch slot terisi (OPSI A: Semua status KECUALI cancelled)
    const { data: bookedData } = await supabase
      .from('Reservations')
      .select('booking_time')
      .or(`tenant_slug.eq.${tenantSlug},client_code.eq.${tenantSlug}`)
      .eq('booking_date', date)
      .neq('status', 'cancelled')

    const blockedTimes = blockedData ? blockedData.map(item => item.start_time) : []
    const bookedTimes = bookedData ? bookedData.map(item => item.booking_time) : []

    return NextResponse.json({
      success: true,
      blockedTimes,
      bookedTimes
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}