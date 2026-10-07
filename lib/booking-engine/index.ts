import { SupabaseClient } from '@supabase/supabase-js'
import { getFixedSlots } from './getFixedSlots'
import { calculateDynamicSlots } from './getDynamicSlots'
import { CalculatedSlot, SlotRequestParams } from './types'

export async function fetchAvailableSlots(
  supabase: SupabaseClient,
  params: SlotRequestParams
): Promise<CalculatedSlot[]> {
  // Ambil mode slot tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slot_mode')
    .eq('id', params.tenantId)
    .single()

  const mode = tenant?.slot_mode || 'fixed'

  if (mode === 'dynamic') {
    return calculateDynamicSlots(supabase, params)
  }

  // Fallback / Mode Default: Fixed Slots (Logika yang sudah berjalan sekarang)
  return getFixedSlots(supabase, params)
}