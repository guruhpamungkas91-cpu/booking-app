'use client'

export const dynamic = 'force-dynamic'

// ============================================================================
// 1. IMPORTS & DEPENDENCIES
// ============================================================================
import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ============================================================================
// 2. TYPE DEFINITIONS & INTERFACES
// ============================================================================
interface ServiceItem {
  id: number
  tenant_slug: string
  name: string
  price: string | number
  desc: string
  long_description?: string
  duration?: string
  image_url?: string
  is_addon?: boolean
}

interface AddonService {
  id: number
  tenant_slug?: string
  addon_label: string
  addon_price: string | number
  desc?: string
  long_description?: string
  image_url?: string
  duration?: string
  is_addon?: boolean
}

interface StaffItem {
  id: number
  tenant_slug: string
  name: string
  role: string
  max_slots: number
  photo_url?: string | null
  phone?: string | null
}

interface TenantAddonItem {
  label: string
  price: number | string
  desc?: string
  long_description?: string
  image_url?: string
  duration?: string
}

interface TenantData {
  id?: number | string
  clientCode?: string
  tenantSlug?: string
  name?: string
  adminWa?: string
  subscriptionPlan?: string // 'PROFESIONAL' atau 'ULTIMATE'
  category?: string
  staffLabel?: string
  layoutType?: string
  layout_type?: string
  themeColor?: string
  requireConsent?: boolean
  custom_terms_text?: string
  showExtraAddon?: boolean
  addonLabel?: string
  addonPrice?: number
  custom_payment_dp?: boolean
  dpType?: string
  dpValue?: number
  waGatewayUrl?: string
  waApiKey?: string
  qrisUrl?: string
  is_system_maintenance?: boolean
  is_maintenance_mode?: boolean
  isMaintenance?: boolean 
  maintenance_message?: string
  bank_accounts?: Array<{
    bank_name: string
    account_number: string
    holder_name: string
  }>
  ewallet_accounts?: Array<{
    wallet_name: string
    phone_number: string
    holder_name: string
  }>
  
  // Slot & Booking Flags (camelCase & snake_case)
  preventDoubleBooking?: boolean
  prevent_double_booking?: boolean
  hideBookedSlots?: boolean
  hide_booked_slots?: boolean            // <-- DITAMBAHKAN
  maxPersonPerBooking?: number
  enable_guest_count?: boolean
  enableAutoDisableTimeSlots?: boolean
  enable_auto_disable_time_slots?: boolean // <-- DITAMBAHKAN
  enableSlotBlocking?: boolean
  enable_slot_blocking?: boolean
  enable_multi_staff?: boolean
  enable_multi_service?: boolean
  enableNotes?: boolean
  enable_notes?: boolean
  
  addons?: TenantAddonItem[]
}

interface TimeSlot {
  time: string
  maxQuota?: number
  max_quota?: number
  bookedCount?: number
  disabled?: boolean
  is_available?: boolean
}

// ============================================================================
// 3. UTILITY / HELPER FUNCTIONS
// ============================================================================
const formatWaNumber = (phone: string) => {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  return cleaned
}

const isValidWhatsAppNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/[^0-9]/g, '')

  if (!cleaned.startsWith('08') && !cleaned.startsWith('628')) {
    return false
  }
  
  if (cleaned.length < 10 || cleaned.length > 14) {
    return false
  }

  const isAllSame = /^(\d)\1+$/.test(cleaned)
  const isSequential = /^(08)?(123456|111111|222222|333333|444444|555555|666666|777777|888888|999999|012345|123456|234567|345678|456789)/.test(cleaned)

  if (isAllSame || isSequential) {
    return false
  }

  return true
}

// ============================================================================
// 4. SUB-COMPONENTS
// ============================================================================
interface TimePickerProps {
  availableSlots: any[]
  blockedTimes: string[]
  selectedTime: string
  onSelectTime: (time: string) => void
  tenantData: TenantData
  theme: any
}

function TimePicker({
  availableSlots,
  blockedTimes,
  selectedTime,
  onSelectTime,
  tenantData,
  theme
}: TimePickerProps) {
  const shouldHideBooked = tenantData?.hideBookedSlots || tenantData?.hide_booked_slots || false
  const shouldAutoDisable = tenantData?.enableAutoDisableTimeSlots ?? tenantData?.enable_auto_disable_time_slots ?? true

  const displayedSlots = availableSlots.map((slot) => {
    const rawTime = slot.time || slot.time_slot || ''
    const timeStr = typeof rawTime === 'string' ? rawTime.substring(0, 5) : ''

    const isBlockedByApi = blockedTimes.some(b => typeof b === 'string' && b.substring(0, 5) === timeStr)
    const isSlotDisabled = slot.disabled === true || slot.is_available === false || isBlockedByApi

    return {
      ...slot,
      time: timeStr,
      isDisabled: shouldAutoDisable ? isSlotDisabled : false,
      isHidden: shouldHideBooked && isSlotDisabled
    }
  }).filter(slot => !slot.isHidden && slot.time)

  if (displayedSlots.length === 0) {
    return (
      <div className="text-center py-4 text-zinc-500 text-xs italic">
        Tidak ada jadwal / slot waktu yang tersedia pada tanggal ini.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 mt-2.5">
      {displayedSlots.map((slot) => {
        const isSelected = selectedTime === slot.time

        return (
          <button
            key={slot.time}
            type="button"
            disabled={slot.isDisabled}
            style={isSelected && theme.inlineStyle ? theme.inlineStyle : undefined}
            onClick={() => {
              if (!slot.isDisabled) {
                onSelectTime(slot.time)
              }
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all duration-300 border relative overflow-hidden group ${
              slot.isDisabled
                ? 'bg-zinc-950/60 text-zinc-600 border-zinc-800/50 cursor-not-allowed opacity-50'
                : isSelected
                ? `${theme.accentBg} !text-black border-white/25 scale-[1.04] z-10 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.6)] ring-2 ring-white/40`
                : 'bg-zinc-950/90 text-zinc-300 border-zinc-800/80 hover:border-zinc-700 hover:text-white hover:bg-zinc-900/80 hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]'
            }`}
          >
            <span className="relative z-10">{slot.time}</span>
            {slot.isDisabled && (
              <span className="block text-[9px] text-rose-500 font-semibold tracking-wide mt-0.5">Penuh</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// 5. MAIN BOOKING FORM COMPONENT
// ============================================================================
function BookingFormContent({ initialTenant }: { initialTenant?: TenantData }) {
  const params = useParams()
  const routerSlug = (params?.tenant_slug as string) || ''

  // --------------------------------------------------------------------------
  // 5.1 State Management
  // --------------------------------------------------------------------------
  const [step, setStep] = useState(1)
  const [tenant, setTenant] = useState<TenantData>(initialTenant || {
    clientCode: '',
    tenantSlug: '',
    name: '',
    adminWa: '',
    subscriptionPlan: 'PROFESIONAL',
    category: '',
    staffLabel: 'Staff',
    layoutType: 'STEP_WIZARD',
    themeColor: 'rose',
    requireConsent: false,
    custom_terms_text: '',
    showExtraAddon: false,
    addonLabel: '', 
    addonPrice: 0,   
    dpType: 'PERCENTAGE',
    dpValue: 50,          
    waGatewayUrl: '',
    waApiKey: '',
    qrisUrl: '',
    isMaintenance: false,
    preventDoubleBooking: true,
    hideBookedSlots: false,
    maxPersonPerBooking: 5,
    enable_guest_count: true,
    enableAutoDisableTimeSlots: true,
    enableSlotBlocking: true,
    enable_multi_staff: false,
    enable_multi_service: true,
    enable_notes: true,
    enableNotes: true,
    addons: []
  })

  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [fetchingServices, setFetchingServices] = useState(true)

  const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceItem | TenantAddonItem | null>(null)
  const [qrisData, setQrisData] = useState<{ qrUrl?: string; qrString?: string; snapToken?: string } | null>(null)
  const [loadingQris, setLoadingQris] = useState(false)

  const [isAddonExpanded, setIsAddonExpanded] = useState(false)

  const [blockedSlots, setBlockedSlots] = useState<{ block_date: string; block_time: string }[]>([])
  const [blockedTimes, setBlockedTimes] = useState<string[]>([])
  const [bookedReservations, setBookedReservations] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])

  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    selected_services: [] as string[],
    selectedAddonIds: [] as number[],
    selectedTenantAddons: [] as { label: string; price: number }[],
    selected_staff: '',
    payment_method: 'Cash / Bayar di Tempat',
    person_count: 1,
    payment_type: 'FULL',
    has_consent: false,
    custom_notes: ''
  })
  
  const [addonQuantities, setAddonQuantities] = useState<{ [key: number]: number }>({})
  const [loading, setLoading] = useState(false)

  // --------------------------------------------------------------------------
  // 5.2 Derived States & Calculations
  // --------------------------------------------------------------------------
  const mainServices = services.filter((s) => !s.is_addon)
  const addonServices: AddonService[] = services.filter((s) => s.is_addon).map((s) => ({
    id: s.id,
    tenant_slug: s.tenant_slug,
    addon_label: s.name,
    addon_price: s.price,
    desc: s.desc,
    long_description: s.long_description,
    image_url: s.image_url,
    duration: s.duration,
    is_addon: s.is_addon
  }))

  const currentLayout = tenant.layoutType || tenant.layout_type || 'STEP_WIZARD'
  const isSinglePage = currentLayout.toUpperCase() === 'SINGLE_PAGE'
  const isWizard = !isSinglePage
  const isUltimate = tenant.subscriptionPlan === 'ULTIMATE'
  const isProfesional = tenant.subscriptionPlan === 'PROFESIONAL'
  const isNotesEnabled = tenant.enableNotes ?? tenant.enable_notes ?? true;

  const parsePrice = (priceVal: string | number) => {
    if (typeof priceVal === 'number') return isNaN(priceVal) ? 0 : priceVal;
    if (!priceVal) return 0;
    const numeric = priceVal.replace(/[^0-9]/g, '')
    return numeric ? parseInt(numeric, 10) : 0
  }

  const calculateTotal = () => {
    let serviceTotal = mainServices
      .filter((s) => formData.selected_services.includes(s.name))
      .reduce((sum, item) => sum + parsePrice(item.price), 0)

    serviceTotal = serviceTotal * formData.person_count

    const extraFeeOld = addonServices
      .filter((addon) => formData.selectedAddonIds.includes(addon.id))
      .reduce((sum, addon) => {
        const qty = addonQuantities[addon.id] || 1
        return sum + (parsePrice(addon.addon_price) * qty)
      }, 0)

    const extraFeeNew = formData.selectedTenantAddons
      .reduce((sum, addon) => sum + parsePrice(addon.price), 0)

    return serviceTotal + extraFeeOld + extraFeeNew
  }

  const grandTotal = calculateTotal()

  const calculateDP = () => {
    const dpVal = tenant.dpValue ?? 50
    if (tenant.dpType === 'FIXED') {
      return dpVal > grandTotal ? grandTotal : dpVal
    }
    return Math.round(grandTotal * (dpVal / 100))
  }

  const dpAmount = calculateDP()
  const payableAmount = formData.payment_type === 'DP' ? dpAmount : grandTotal
  const remainingAmount = grandTotal - payableAmount

  const getAvailablePaymentMethods = () => {
    const methods: { id: string; title: string; detail?: string }[] = []
    const isPayingDp = formData.payment_type === 'DP' || formData.payment_type === 'PERCENTAGE' || tenant?.custom_payment_dp;

    if (tenant?.qrisUrl && tenant.qrisUrl.trim() !== '') {
      methods.push({ id: 'QRIS', title: 'QRIS Instan', detail: 'Scan QR langsung dari HP' })
    }

    if (Array.isArray(tenant?.bank_accounts) && tenant.bank_accounts.length > 0) {
      tenant.bank_accounts.forEach((bank: any) => {
        methods.push({
          id: `Transfer ${bank.bank_name}`,
          title: `Transfer ${bank.bank_name}`,
          detail: `${bank.account_number} (a.n ${bank.holder_name})`,
        })
      })
    }

    if (Array.isArray(tenant?.ewallet_accounts) && tenant.ewallet_accounts.length > 0) {
      tenant.ewallet_accounts.forEach((wallet: any) => {
        methods.push({
          id: wallet.wallet_name,
          title: wallet.wallet_name,
          detail: `${wallet.phone_number} (a.n ${wallet.holder_name})`,
        })
      })
    }

    if (!isPayingDp) {
      methods.push({ 
        id: 'Cash / Bayar di Tempat', 
        title: 'Cash / Bayar di Tempat', 
        detail: 'Bayar langsung di lokasi' 
      })
    }

    return methods
  }

  const availablePaymentMethods = getAvailablePaymentMethods()

  // --------------------------------------------------------------------------
  // 5.3 Theme Configuration Helper
  // --------------------------------------------------------------------------
  const getThemeClasses = (color: string) => {
    const trimmedColor = (color || 'rose').trim()

    if (trimmedColor.startsWith('#')) {
      return {
        accentBg: 'bg-gradient-to-r opacity-95 hover:opacity-100 shadow-[0_0_25px_rgba(0,0,0,0.4)]',
        accentSolidBg: '',
        accentText: '',
        accentBorder: 'shadow-[0_0_25px_rgba(0,0,0,0.25)]',
        accentBgLight: 'backdrop-blur-md',
        accentRing: 'focus:ring-2 shadow-[0_0_20px_rgba(0,0,0,0.15)]',
        iconBg: 'backdrop-blur-md shadow-[0_0_35px_rgba(0,0,0,0.35)]',
        checkbox: 'text-current',
        inlineStyle: {
          background: `linear-gradient(to right, ${trimmedColor}, ${trimmedColor}dd)`,
          borderColor: trimmedColor,
          color: trimmedColor
        },
        inlineText: { color: trimmedColor },
        inlineBorder: { borderColor: trimmedColor },
        inlineBgLight: { backgroundColor: `${trimmedColor}22` },
        inlineShadow: { boxShadow: `0 0 30px ${trimmedColor}66` }
      }
    }

    switch (trimmedColor.toLowerCase()) {
      case 'rose':
      case 'pink':
        return {
          accentBg: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-700 shadow-[0_0_30px_rgba(244,63,94,0.45)]',
          accentSolidBg: 'bg-rose-500',
          accentText: 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]',
          accentBorder: 'border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.25)]',
          accentBgLight: 'bg-rose-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
          iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.4)]',
          checkbox: 'accent-rose-500 text-rose-500'
        }
      case 'teal':
      case 'emerald':
        return {
          accentBg: 'bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-600 hover:from-teal-600 hover:to-emerald-700 shadow-[0_0_30px_rgba(20,184,166,0.45)]',
          accentSolidBg: 'bg-teal-500',
          accentText: 'text-teal-400 drop-shadow-[0_0_12px_rgba(20,184,166,0.6)]',
          accentBorder: 'border-teal-500/50 shadow-[0_0_25px_rgba(20,184,166,0.25)]',
          accentBgLight: 'bg-teal-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]',
          iconBg: 'bg-teal-500/15 text-teal-400 border-teal-500/40 shadow-[0_0_35px_rgba(20,184,166,0.4)]',
          checkbox: 'accent-teal-500 text-teal-500'
        }
      case 'indigo':
      case 'blue':
        return {
          accentBg: 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-700 shadow-[0_0_30px_rgba(99,102,241,0.45)]',
          accentSolidBg: 'bg-indigo-500',
          accentText: 'text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]',
          accentBorder: 'border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.25)]',
          accentBgLight: 'bg-indigo-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]',
          iconBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40 shadow-[0_0_35px_rgba(99,102,241,0.4)]',
          checkbox: 'accent-indigo-500 text-indigo-500'
        }
      case 'purple':
      case 'violet':
        return {
          accentBg: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-600 hover:from-purple-600 hover:to-fuchsia-700 shadow-[0_0_30px_rgba(168,85,247,0.45)]',
          accentSolidBg: 'bg-purple-500',
          accentText: 'text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]',
          accentBorder: 'border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.25)]',
          accentBgLight: 'bg-purple-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
          iconBg: 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-[0_0_35px_rgba(168,85,247,0.4)]',
          checkbox: 'accent-purple-500 text-purple-500'
        }
      case 'red':
        return {
          accentBg: 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 hover:from-red-600 hover:to-rose-700 shadow-[0_0_30px_rgba(239,68,68,0.45)]',
          accentSolidBg: 'bg-red-500',
          accentText: 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]',
          accentBorder: 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.25)]',
          accentBgLight: 'bg-red-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-red-500 focus:ring-2 focus:ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
          iconBg: 'bg-red-500/15 text-red-400 border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.4)]',
          checkbox: 'accent-red-500 text-red-500'
        }
      case 'orange':
      case 'amber':
      case 'yellow':
      default:
        return {
          accentBg: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-yellow-700 shadow-[0_0_30px_rgba(245,158,11,0.45)]',
          accentSolidBg: 'bg-amber-500',
          accentText: 'text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]',
          accentBorder: 'border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.25)]',
          accentBgLight: 'bg-amber-500/[0.12] backdrop-blur-md',
          accentRing: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
          iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.4)]',
          checkbox: 'accent-amber-500 text-amber-500'
        }
    }
  }

  const theme = getThemeClasses(tenant.themeColor || 'rose')

  // --------------------------------------------------------------------------
  // 5.4 Side Effects (useEffect Hooks)
  // --------------------------------------------------------------------------
  // Effect 1: Initial Load (Tenant, Slots, Services, Staff, Blocked Slots)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase()
      const searchParams = new URLSearchParams(window.location.search)
      const tenantQuery = searchParams.get('tenant')

      let detectedKeyword = ''

      if (hostname.includes('localhost') || hostname.startsWith('127.')) {
        detectedKeyword = routerSlug || tenantQuery || ''
      } else {
        const parts = hostname.toLowerCase().split('.')
        detectedKeyword = parts.length > 2 ? parts[0] : hostname.toLowerCase()
      }

      const keywordQuery = (detectedKeyword || tenantQuery || routerSlug || '').trim().toLowerCase()

      if (!keywordQuery) {
        setFetchingServices(false)
        return
      }

      const fetchTenantAndData = async () => {
        setFetchingServices(true)

        try {
          const { data: tenantData, error: tenantErr } = await supabase
            .from('tenants')
            .select('*')
            .or(`domain.eq.${hostname},domain_url.eq.${hostname},domain.eq.${keywordQuery},domain_url.eq.${keywordQuery},tenant_slug.eq.${keywordQuery},client_code.ilike.${keywordQuery}`)
            .maybeSingle()

          if (tenantErr || !tenantData) {
            console.error("Tenant tidak ditemukan:", tenantErr)
            setFetchingServices(false)
            return
          }

          const uniqueTenantId = tenantData.id || tenantData.tenant_id
          const dbClientCode = tenantData.client_code
          const dbSlug = tenantData.tenant_slug

          if (!uniqueTenantId || !dbClientCode || !dbSlug) {
            setFetchingServices(false)
            return
          }

          const dbPlan = ((tenantData?.subscription_plan || 'PROFESIONAL') as string).toUpperCase() as 'PROFESIONAL' | 'ULTIMATE'
          const rawCategory = tenantData?.category || 'Layanan'

          const activeTenant: TenantData = {
            id: uniqueTenantId,
            clientCode: dbClientCode,
            tenantSlug: dbSlug,
            name: tenantData?.business_name || tenantData?.name || dbClientCode,
            adminWa: tenantData?.admin_wa || '',
            subscriptionPlan: dbPlan,
            category: rawCategory,
            staffLabel: tenantData?.staff_label || 'Staff',
            layoutType: tenantData?.layout_type || 'STEP_WIZARD',
            themeColor: tenantData?.theme_color || 'rose',
            
            requireConsent: tenantData?.require_consent ?? false,
            custom_terms_text: tenantData?.custom_terms_text || '',
            showExtraAddon: tenantData?.show_extra_addon ?? true,
            
            addonLabel: tenantData?.addon_label || 'Add-on Tambahan',
            addonPrice: tenantData?.addon_price || 0,
            custom_payment_dp: tenantData?.custom_payment_dp ?? false,
            dpType: tenantData?.dp_type || 'PERCENTAGE',
            dpValue: tenantData?.dp_value ?? 50,
            waGatewayUrl: tenantData?.wa_gateway_url || '',
            waApiKey: tenantData?.wa_api_key || '',
            qrisUrl: tenantData?.qris_url || '',
            is_system_maintenance: tenantData?.is_system_maintenance ?? false,
            is_maintenance_mode: tenantData?.is_maintenance_mode ?? false,
            maintenance_message: tenantData?.maintenance_message || 'Mohon maaf, halaman pemesanan layanan saat ini sedang ditutup sementara.',
            bank_accounts: Array.isArray(tenantData?.bank_accounts) ? tenantData.bank_accounts : [],
            ewallet_accounts: Array.isArray(tenantData?.ewallet_accounts) ? tenantData.ewallet_accounts : [],
        
            preventDoubleBooking: tenantData?.prevent_double_booking ?? true,
            hideBookedSlots: tenantData?.hide_booked_slots ?? false,
            maxPersonPerBooking: tenantData?.max_person_per_booking || 5,
            enable_guest_count: tenantData?.enable_guest_count ?? false,
            enableAutoDisableTimeSlots: tenantData?.enable_auto_disable_time_slots ?? true,
            enableSlotBlocking: tenantData?.enable_slot_blocking ?? true,
            enable_multi_staff: tenantData?.enable_multi_staff ?? false,
            enable_multi_service: tenantData?.enable_multi_service ?? true,
            enable_notes: tenantData?.enable_notes ?? true,
            enableNotes: tenantData?.enable_notes ?? true,
            addons: Array.isArray(tenantData?.addons) ? tenantData.addons : []
          }

          setTenant(activeTenant)

          const { data: slotData } = await supabase
            .from('tenant_slots')
            .select('time_slot, max_quota')
            .eq('tenant_id', uniqueTenantId)
            .eq('is_active', true)
            .order('time_slot', { ascending: true })

          if (slotData && slotData.length > 0) {
            const formattedSlots: TimeSlot[] = slotData.map((s) => ({
              time: s.time_slot.substring(0, 5),
              maxQuota: s.max_quota,
              max_quota: s.max_quota,
              bookedCount: 0
            }))
            setAvailableSlots(formattedSlots)
          } else {
            setAvailableSlots([])
          }

          const { data: serviceData } = await supabase
            .from('services')
            .select('*')
            .eq('tenant_id', uniqueTenantId)

          if (serviceData && serviceData.length > 0) {
            setServices(serviceData)
            const firstMain = serviceData.filter((s: ServiceItem) => !s.is_addon)
            if (firstMain.length > 0) {
              setFormData((prev) => ({ ...prev, selected_services: [firstMain[0].name] }))
            }
          } else {
            setServices([])
          }

          const { data: staffData } = await supabase
            .from('staff')
            .select('*')
            .eq('tenant_id', uniqueTenantId)
            .eq('is_active', true)

          if (staffData && staffData.length > 0) {
            setStaffList(staffData)
            setFormData((prev) => ({ ...prev, selected_staff: staffData[0].name }))
          } else {
            setStaffList([])
          }

          const { data: blockedData } = await supabase
            .from('blocked_slots')
            .select('date, start_time')
            .eq('tenant_id', uniqueTenantId)

          const { data: confirmedReservations } = await supabase
            .from('reservations')
            .select('booking_date, booking_time, status')
            .eq('tenant_id', uniqueTenantId)
            .neq('status', 'cancelled')
            .neq('status', 'refunded')

          const combinedBlockedSlots = [
            ...(blockedData?.map((item) => ({
              block_date: item.date,
              block_time: item.start_time ? item.start_time.substring(0, 5) : '',
            })) || []),
            ...(confirmedReservations?.map((item) => ({
              block_date: item.booking_date,
              block_time: item.booking_time ? item.booking_time.substring(0, 5) : '',
            })) || [])
          ]

          setBlockedSlots(combinedBlockedSlots)

        } catch (err) {
          console.error("Error fetching secure data:", err)
        } finally {
          setFetchingServices(false)
        }
      }

      fetchTenantAndData()
    }
  }, [routerSlug])

  // Effect 2: Dynamic Slot Availability Check
  useEffect(() => {
    if (!formData.booking_date || !tenant?.tenantSlug) return

    const fetchAvailability = async () => {
      setLoadingSlots(true)
      try {
        const staffParam = formData.selected_staff ? `&staff=${encodeURIComponent(formData.selected_staff)}` : ''
        const res = await fetch(`/api/availability?date=${formData.booking_date}&tenant_slug=${tenant.tenantSlug}${staffParam}`)
        
        if (res.ok) {
          const data = await res.json()
          
          setBlockedTimes(data.blockedTimes || [])
          
          const activeBookings = (data.bookedReservations || []).filter(
            (b: any) => b.status !== 'cancelled' && b.status !== 'refunded'
          )
          setBookedReservations(activeBookings)
          setAvailableSlots(data.slots || []) 

          if (data.tenantSettings && Object.keys(data.tenantSettings).length > 0) {
            setTenant((prev: any) => ({
              ...prev,
              hideBookedSlots: data.tenantSettings.hide_booked_slots ?? prev?.hideBookedSlots ?? false,
              enableAutoDisableTimeSlots: data.tenantSettings.enable_auto_disable_time_slots ?? prev?.enableAutoDisableTimeSlots ?? true,
            }))
          }
        } else {
          setBlockedTimes([])
          setBookedReservations([])
          setAvailableSlots([])
        }
      } catch (err) {
        setBlockedTimes([])
        setBookedReservations([])
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchAvailability()
  }, [formData.booking_date, formData.selected_staff, tenant?.tenantSlug])

  // Effect 3: Dynamic QRIS Generation
  useEffect(() => {
    let isMounted = true

    const generateDynamicQris = async () => {
      if (isMounted) setLoadingQris(true)
      
      try {
        const response = await fetch('/api/qris/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: payableAmount,
            tenantSlug: tenant.tenantSlug,
            customerName: formData.customer_name || 'Pelanggan'
          })
        })

        if (!isMounted) return

        if (response.ok) {
          const resData = await response.json()
          setQrisData({ qrUrl: resData.qrUrl })
        } else {
          setQrisData(null)
        }
      } catch (err) {
        if (isMounted) {
          setQrisData(null)
        }
      } finally {
        if (isMounted) {
          setLoadingQris(false)
        }
      }
    }

    if (formData.payment_method === 'QRIS' && payableAmount > 0) {
      generateDynamicQris()
    }

    return () => {
      isMounted = false
    }
  }, [formData.payment_method, payableAmount, tenant?.tenantSlug])

  // --------------------------------------------------------------------------
  // 5.5 Event Handlers & Form Logic
  // --------------------------------------------------------------------------
  const handleServiceSelect = (serviceName: string) => {
    if (!tenant.enable_multi_service) {
      setFormData((prev) => ({ ...prev, selected_services: [serviceName] }))
    } else {
      const exists = formData.selected_services.includes(serviceName)
      const updated = exists
        ? formData.selected_services.filter((s) => s !== serviceName)
        : [...formData.selected_services, serviceName]
      setFormData((prev) => ({ ...prev, selected_services: updated }))
    }
  }

  const isSlotBlocked = (date: string, time: string) => {
    if (!date || !time) return false
    return blockedTimes.includes(time)
  }

  const handlePrevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (!formData.customer_name || !formData.whatsapp_number) {
        alert('Mohon isi nama dan nomor WhatsApp!')
        return
      }
      if (!isValidWhatsAppNumber(formData.whatsapp_number)) {
        alert('⚠️ Mohon masukkan Nomor WhatsApp yang aktif dan valid! Nomor dengan format dummy/palsu tidak dapat diproses.')
        return
      }

      if (!formData.booking_date || !formData.booking_time) {
        alert('Mohon tentukan tanggal dan jam kedatangan!')
        return
      }
      if (isSlotBlocked(formData.booking_date, formData.booking_time)) {
        alert('Maaf, tanggal/jam yang Anda pilih sedang tidak tersedia. Silakan pilih jam lain.')
        return
      }

      if (formData.selected_staff && tenant?.preventDoubleBooking) {
        const activeBookings = bookedReservations.filter(
          b => b.time === formData.booking_time && b.status !== 'cancelled' && b.status !== 'refunded'
        )
        const currentStaffObj = staffList.find(
          s => s.name === formData.selected_staff || s.id.toString() === formData.selected_staff
        )
        
        if (currentStaffObj) {
          const staffMaxSlots = currentStaffObj.max_slots ?? 1
          const staffBookingsCount = activeBookings.filter(
            b => b.staff === formData.selected_staff || b.staff_name === formData.selected_staff
          ).length

          if (staffBookingsCount >= staffMaxSlots) {
            alert(`Maaf, ${currentStaffObj.name} sudah mencapai batas maksimal reservasi pada jam ${formData.booking_time}. Silakan pilih jam atau staff lain.`)
            return
          }
        }
      }
    }

    if (step === 2) {
      if (!formData.selected_services || formData.selected_services.length === 0) {
        alert('Pilih minimal 1 layanan!')
        return
      }
    }
    
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (tenant.isMaintenance) {
      alert('Maaf, halaman reservasi sedang ditutup sementara (Maintenance).')
      return
    }

    if (tenant.requireConsent && !formData.has_consent) {
      alert('Mohon centang persetujuan terlebih dahulu sebelum mengirim reservasi.')
      return
    }

    if (!formData.customer_name || !formData.whatsapp_number) {
      alert('Mohon isi nama dan nomor WhatsApp!')
      return
    }
    if (!isValidWhatsAppNumber(formData.whatsapp_number)) {
      alert('⚠️ Mohon masukkan Nomor WhatsApp yang aktif dan valid!')
      return
    }
    if (!formData.booking_date || !formData.booking_time) {
      alert('Mohon tentukan tanggal dan jam kedatangan!')
      return
    }
    if (formData.selected_services.length === 0) {
      alert('Mohon pilih minimal 1 layanan!')
      return
    }

    if (isSlotBlocked(formData.booking_date, formData.booking_time)) {
      alert('Maaf, slot waktu ini sudah dipesan. Silakan pilih jam atau tanggal lain.')
      return
    }

    setLoading(true)

    const formattedServicesText = formData.selected_services.join(', ')

    const insertPayload: any = {
      customer_name: formData.customer_name,
      whatsapp_number: formData.whatsapp_number,
      booking_date: formData.booking_date,
      booking_time: formData.booking_time,
      service_name: formattedServicesText,
      staff_name: formData.selected_staff || null,
      payment_method: formData.payment_method,
      status: 'pending',
      client_code: tenant.clientCode,
      tenant_slug: tenant.tenantSlug,
      tenant_id: tenant.id || null,
      total_price: grandTotal,
      person_count: formData.person_count,
      payment_type: formData.payment_type,
      selected_addon_ids: formData.selectedAddonIds,
      has_eye_allergy_consent: formData.has_consent,
      eye_shape_notes: formData.custom_notes
    }

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insertPayload)
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || 'Gagal membuat reservasi!')
        setLoading(false)
        return
      }

      alert('Reservasi berhasil dibuat!')

      const insertedData = result.data
      const bookingId = insertedData?.id ? `BK-${insertedData.id}` : 'BK-NEW'
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const invoiceUrl = `${origin}/invoice/${bookingId}`

      let messageText =
        `Halo *${tenant.name}*, saya ingin mengonfirmasi reservasi:\n\n` +
        `📌 *DETAIL RESERVASI*\n` +
        `• Kode Booking: #${bookingId}\n` +
        `• Nama: ${formData.customer_name}\n` +
        `• No. HP: ${formData.whatsapp_number}\n` +
        `• Tanggal & Jam: ${formData.booking_date} - ${formData.booking_time} WIB\n` +
        `• Layanan: ${formattedServicesText}\n` +
        `• Jumlah Orang: ${formData.person_count} Orang\n`

      const selectedAddonsForWa = addonServices.filter((addon) => formData.selectedAddonIds.includes(addon.id))
      if (selectedAddonsForWa.length > 0) {
        const addonNamesStr = selectedAddonsForWa.map((a) => {
          const qty = addonQuantities[a.id] || 1
          return qty > 1 ? `${a.addon_label} (${qty} orang)` : a.addon_label
        }).join(', ')
        messageText += `• Add-on: ${addonNamesStr}\n`
      }

      if (formData.selectedTenantAddons.length > 0) {
        const tenantAddonStrs = formData.selectedTenantAddons.map((ta) => ta.label).join(', ')
        messageText += `• Layanan Tambahan: ${tenantAddonStrs}\n`
      }

      if (formData.selected_staff) {
        messageText += `• ${tenant.staffLabel}: ${formData.selected_staff}\n`
      }

      if (formData.custom_notes) {
        messageText += `• Catatan Khusus: ${formData.custom_notes}\n`
      }

      messageText += `\n💳 *RINCIAN PEMBAYARAN*\n` +
        `• Metode Bayar: ${formData.payment_method}\n` +
        `• Total Biaya: Rp ${grandTotal.toLocaleString('id-ID')}\n` +
        `• Nominal Dibayar (${formData.payment_type}): Rp ${payableAmount.toLocaleString('id-ID')}\n`

      if (formData.payment_type === 'DP') {
        messageText += `• Sisa Pelunasan: Rp ${remainingAmount.toLocaleString('id-ID')} (Dibayar di Lokasi)\n`
      }

      messageText += `\n🧾 *LINK INVOICE:* \n${invoiceUrl}\n`
      messageText += `\n----------------------------------\nBerikut saya lampirkan bukti transfernya. Terima kasih!`

      if (tenant.waGatewayUrl) {
        try {
          let formattedPhone = formData.whatsapp_number.replace(/[^0-9]/g, '')
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.slice(1)
          }

          const formDataBody = new FormData()
          formDataBody.append('target', formattedPhone)
          formDataBody.append('message', messageText)

          await fetch(tenant.waGatewayUrl, {
            method: 'POST',
            headers: {
              'Authorization': tenant.waApiKey || ''
            },
            body: formDataBody
          })
        } catch (err) {
          console.error('Gagal memicu WA Gateway:', err)
        }
      }

      const adminPhone = tenant.adminWa || ''
      const formattedPhone = formatWaNumber(adminPhone)

      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`
      window.open(waUrl, '_blank')
    } catch (err: any) {
      alert('Terjadi kesalahan koneksi ke server.')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // 5.6 Render Helper Methods (Sub-views)
  // --------------------------------------------------------------------------
  const renderQrisSection = () => {
    const qrisSrc = qrisData?.qrUrl || tenant?.qrisUrl

    return (
      <div 
        style={theme.inlineBorder ? theme.inlineBorder : undefined}
        className={`p-4 bg-zinc-950/90 border ${theme.accentBorder} rounded-2xl text-center space-y-3 shadow-2xl backdrop-blur-md`}
      >
        <p style={theme.inlineText ? theme.inlineText : undefined} className={`text-xs font-extrabold ${theme.accentText} tracking-wide`}>
          Scan QRIS Pembayaran (Rp {payableAmount.toLocaleString('id-ID')})
        </p>

        {loadingQris ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-2">
            <div style={theme.inlineStyle ? { background: tenant.themeColor } : undefined} className={`w-6 h-6 border-2 ${theme.accentSolidBg} border-t-transparent rounded-full animate-spin`}></div>
            <span className="text-[11px] font-medium text-zinc-300">Memuat Kode QRIS dari Storage...</span>
          </div>
        ) : qrisSrc ? (
          <div className="p-2 bg-white rounded-2xl inline-block shadow-2xl border border-zinc-200 overflow-hidden w-full max-w-[260px]">
            <img
              src={qrisSrc}
              onError={(e) => { 
                e.currentTarget.onerror = null
              }}
              alt={`QRIS ${tenant?.name || 'Tenant'}`}
              className="w-full h-auto object-cover rounded-xl mx-auto"
            />
          </div>
        ) : (
          <div className="py-6 px-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-xs font-medium text-zinc-300">
            Gambar QRIS belum dikonfigurasi di storage.
          </div>
        )}
        <p className="text-[11px] font-medium text-zinc-300">Dapat di-scan menggunakan BCA, GoPay, OVO, Dana, LinkAja, dll.</p>
      </div>
    )
  }

  const renderAddonsSection = () => {
    if (!tenant.showExtraAddon) return null
    if (!tenant.addons || tenant.addons.length === 0) return null

    const hasAnyChecked = formData.selectedTenantAddons.length > 0

    return (
      <div 
        style={hasAnyChecked && theme.inlineBorder ? theme.inlineBorder : undefined}
        className={`mt-4 border ${hasAnyChecked ? `${theme.accentBorder} shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)]` : 'border-zinc-800/80'} rounded-2xl bg-zinc-950/70 overflow-hidden transition-all duration-300 shadow-2xl`}
      >
        <div
          onClick={() => setIsAddonExpanded(!isAddonExpanded)}
          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
        >
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              style={theme.inlineStyle ? { accentColor: tenant.themeColor } : undefined}
              className={`w-4 h-4 rounded-md ${theme.checkbox} cursor-pointer`}
              checked={hasAnyChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (!e.target.checked) {
                  setFormData((prev) => ({ ...prev, selectedTenantAddons: [] }))
                } else {
                  setIsAddonExpanded(true)
                }
              }}
            />
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              LAYANAN TAMBAHAN / ADD-ON (OPSIONAL)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {hasAnyChecked && (
              <span 
                style={theme.inlineBgLight && theme.inlineText ? { ...theme.inlineBgLight, ...theme.inlineText } : undefined}
                className={`text-[10px] px-2.5 py-0.5 rounded-full ${theme.accentBgLight} ${theme.accentText} font-bold border border-current/20`}
              >
                {formData.selectedTenantAddons.length} Dipilih
              </span>
            )}
            <svg
              className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isAddonExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {isAddonExpanded && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-zinc-800/60 animate-fadeIn">
            {tenant.addons.map((addon, index) => {
              const isChecked = formData.selectedTenantAddons.some((item) => item.label === addon.label)
              return (
                <div
                  key={index}
                  style={isChecked && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                  onClick={() => {
                    if (isChecked) {
                      setFormData((prev) => ({
                        ...prev,
                        selectedTenantAddons: prev.selectedTenantAddons.filter((item) => item.label !== addon.label)
                      }))
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        selectedTenantAddons: [...prev.selectedTenantAddons, { label: addon.label, price: parsePrice(addon.price) }]
                      }))
                    }
                  }}
                  className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex flex-col group ${
                    isChecked
                      ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]`
                      : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div 
                        style={isChecked && theme.inlineStyle ? { background: tenant.themeColor } : undefined}
                        className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                          isChecked ? `${theme.accentSolidBg} border-white shadow-[0_0_12px_currentColor]` : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p style={isChecked && theme.inlineText ? theme.inlineText : undefined} className={`text-xs font-bold transition-colors ${isChecked ? theme.accentText : 'text-zinc-200 group-hover:text-white'}`}>
                          {addon.label}
                        </p>
                        {addon.desc && (
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{addon.desc}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-zinc-200 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-inner whitespace-nowrap ml-2">
                      +Rp {parsePrice(addon.price).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {(addon.long_description || addon.desc || addon.image_url) && (
                    <button
                      type="button"
                      style={theme.inlineText ? theme.inlineText : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedServiceDetail(addon)
                      }}
                      className={`mt-2.5 self-start inline-flex items-center space-x-1 text-[10px] font-bold ${theme.accentText} hover:underline`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Lihat Detail Paket</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // 5.7 Early Return Views (Loading & Maintenance)
  // --------------------------------------------------------------------------
  if (fetchingServices) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div style={theme.inlineStyle ? { background: tenant.themeColor } : undefined} className={`w-8 h-8 border-2 ${theme.accentSolidBg} border-t-transparent rounded-full animate-spin shadow-[0_0_20px_currentColor]`}></div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">Memuat Halaman Reservasi...</p>
        </div>
      </main>
    )
  }

  if (tenant?.is_maintenance_mode) {
    return (
      <main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 font-sans">
        <div 
          style={theme.inlineBorder ? theme.inlineBorder : undefined}
          className={`max-w-md w-full bg-zinc-900/90 border ${theme.accentBorder} rounded-3xl p-8 text-center space-y-5 backdrop-blur-xl shadow-2xl`}
        >
          <h1 className="text-xl font-black tracking-tight text-white uppercase">{tenant.name || 'Reservasi'}</h1>
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">⚠️ TOKO SEMENTARA DITUTUP</p>
          <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
            {tenant.maintenance_message || 'Mohon maaf, halaman pemesanan layanan saat ini sedang ditutup sementara.'}
          </p>
        </div>
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // 5.8 Main JSX Render
  // --------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#060608] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))] text-zinc-100 flex items-center justify-center p-3 sm:p-6 font-sans relative overflow-x-hidden">
      
      {/* Background Ambient Glow */}
      <div 
        style={theme.inlineStyle ? { background: tenant.themeColor } : undefined}
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-25 ${theme.accentSolidBg}`} 
      />

      {/* CONTAINER UTAMA */}
      <div 
        style={
          theme.inlineBorder 
            ? { 
                ...theme.inlineBorder, 
                boxShadow: `0 0 50px rgba(0,0,0,0.8), 0 0 30px ${tenant.themeColor || '#e11d48'}22, inset 0 0 20px ${tenant.themeColor || '#e11d48'}11` 
              } 
            : undefined
        }
        className={`max-w-md w-full bg-zinc-950/95 border ${theme.accentBorder} rounded-[2rem] shadow-[0_30px_70px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-2xl relative z-10`}
      >
        
        {/* HEADER SECTION */}
        <div className="relative p-6 text-center bg-gradient-to-b from-zinc-900/80 via-zinc-950/90 to-zinc-950 border-b border-zinc-800/80">
          <div 
            style={theme.inlineBgLight && theme.inlineText && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineText, ...theme.inlineBorder, boxShadow: `0 0 35px ${tenant.themeColor}44` } : undefined}
            className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3.5 border ${theme.iconBg} backdrop-blur-xl shadow-2xl transform transition-transform hover:scale-105 duration-300`}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-md">{tenant.name}</h1>
          <p style={theme.inlineText ? theme.inlineText : undefined} className={`text-[11px] font-extrabold uppercase tracking-[0.25em] mt-1.5 ${theme.accentText}`}>{tenant.category}</p>

          {/* INDIKATOR STEP (Hanya jika layoutType = STEP_WIZARD) */}
          {isWizard && (
            <div className="flex items-center justify-center space-x-2.5 mt-5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={step === s && theme.inlineStyle ? { ...theme.inlineStyle, boxShadow: `0 0 20px ${tenant.themeColor}` } : undefined}
                  className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                    step === s ? `w-12 ${theme.accentBg} shadow-[0_0_20px_currentColor]` : 'w-2.5 bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* -------------------------------------------------------- */}
          {/* OPSI 1: STEP WIZARD LAYOUT */}
          {/* -------------------------------------------------------- */}
          {isWizard && (
            <>
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">Langkah 1 dari 3: Data Diri & Waktu</h2>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama kamu"
                      className={`w-full px-4.5 py-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.customer_name || ''}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nomor WhatsApp</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="Contoh: 081234567890"
                      className={`w-full px-4.5 py-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.whatsapp_number || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    />
                    <p className="text-[11px] text-zinc-300 italic leading-tight mt-1.5 font-medium">
                      Pastikan nomor WhatsApp aktif untuk menerima konfirmasi & pengingat jadwal.
                    </p>
                  </div>

                  {tenant?.enable_guest_count && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                        Jumlah Orang / Pasien
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: tenant.maxPersonPerBooking || 5 }, (_, i) => i + 1).map((num) => {
                          const isSelected = formData.person_count === num
                          return (
                            <button
                              type="button"
                              key={num}
                              onClick={() => setFormData((prev) => ({ ...prev, person_count: num }))}
                              className={`py-2.5 text-xs font-bold rounded-2xl border transition-all duration-300 ${
                                isSelected
                                  ? 'border-transparent shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.5)] scale-[1.03]'
                                  : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                              }`}
                              style={
                                isSelected
                                  ? {
                                      ...(theme.inlineStyle || {}),
                                      color: '#000000',
                                    }
                                  : undefined
                              }
                            >
                              {num}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {isNotesEnabled && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Catatan Khusus (Opsional)</label>
                      <input
                        type="text"
                        placeholder="Misal: Keluhan / Model request"
                        className={`w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                        value={formData.custom_notes || ''}
                        onChange={(e) => setFormData({ ...formData, custom_notes: e.target.value })}
                      />
                    </div>
                  )}

                  {tenant?.enable_multi_staff && staffList?.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                        {tenant.staffLabel || 'Pilih Staff / Terapis'}
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {staffList.map((st) => {
                          const isSelected = formData.selected_staff === st.name
                          return (
                            <button
                              type="button"
                              key={st.id}
                              style={isSelected && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                              onClick={async () => {
                                setFormData(prev => ({ ...prev, selected_staff: st.name, booking_time: '' }))
                              }}
                              className={`py-3 px-3.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-left ${
                                isSelected 
                                  ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.3)] scale-[1.01]` 
                                  : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                              }`}
                            >
                              <p style={isSelected && theme.inlineText ? theme.inlineText : undefined} className={`text-sm font-bold ${isSelected ? theme.accentText : 'text-zinc-100'}`}>{st.name}</p>
                              <p className="text-[11px] text-zinc-300 font-medium mt-0.5">{st.role}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal Kedatangan</label>
                      <input
                        type="date"
                        required
                        className={`w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 text-xs outline-none transition-all duration-300 [color-scheme:dark] ${theme.accentRing}`}
                        value={formData.booking_date || ''}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Jam Kedatangan</label>
                        {loadingSlots && <span style={theme.inlineText ? theme.inlineText : undefined} className={`text-[10px] font-bold animate-pulse ${theme.accentText}`}>Memuat ketersediaan...</span>}
                      </div>
                      
                      {!formData.booking_date ? (
                        <p className="text-[11px] text-zinc-300 font-medium italic p-3.5 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-center">
                          Silakan pilih tanggal kedatangan terlebih dahulu.
                        </p>
                      ) : (
                        <TimePicker 
                          availableSlots={availableSlots}
                          blockedTimes={blockedTimes}
                          selectedTime={formData.booking_time}
                          onSelectTime={(time: string) => setFormData(prev => ({ ...prev, booking_time: time }))}
                          tenantData={tenant}
                          theme={theme}
                        />
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-4 px-4 rounded-2xl font-extrabold text-xs text-black transition-all duration-300 mt-3 tracking-wider uppercase transform active:scale-[0.99] shadow-[0_4px_30px_rgba(var(--color-primary-rgb),0.5)]"
                    style={{
                      ...(theme.inlineStyle || {}),
                      color: '#000000',
                    }}
                  >
                    Lanjut Pilih Layanan &rarr;
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">Langkah 2 dari 3: Pilih Layanan & Add-on</h2>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Layanan Utama</label>
                      {!tenant.enable_multi_service ? (
                        <span className="text-[10px] text-zinc-300 font-medium">*Pilih 1 layanan</span>
                      ) : (
                        <span style={theme.inlineText ? theme.inlineText : undefined} className={`text-[10px] ${theme.accentText} font-bold`}>*Bisa pilih lebih dari 1</span>
                      )}
                    </div>

                    {fetchingServices ? (
                      <p className="text-xs text-zinc-300 font-medium animate-pulse text-center py-6">Memuat layanan...</p>
                    ) : mainServices.length === 0 ? (
                      <p className="text-xs text-zinc-300 font-medium text-center py-6">Belum ada layanan tersedia.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {mainServices.map((item) => {
                          const active = formData.selected_services.includes(item.name)
                          return (
                            <div
                              key={item.id}
                              style={active && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                              onClick={() => handleServiceSelect(item.name)}
                              className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex flex-col group ${
                                active 
                                  ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]` 
                                  : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-3.5">
                                  {tenant.enable_multi_service && (
                                    <div 
                                      style={active && theme.inlineStyle ? { background: tenant.themeColor } : undefined}
                                      className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                                        active ? `${theme.accentSolidBg} border-white shadow-[0_0_12px_currentColor]` : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                                      }`}
                                    >
                                      {active && (
                                        <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div>
                                    <p style={active && theme.inlineText ? theme.inlineText : undefined} className={`text-xs font-bold transition-colors ${active ? theme.accentText : 'text-zinc-100 group-hover:text-white'}`}>{item.name}</p>
                                    <p className="text-[11px] text-zinc-300 font-medium mt-0.5 leading-relaxed">{item.desc}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-extrabold text-white bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-inner whitespace-nowrap ml-2">
                                  Rp {parsePrice(item.price).toLocaleString('id-ID')}
                                </span>
                              </div>

                              {(item.long_description || item.desc || item.image_url) && (
                                <button
                                  type="button"
                                  style={theme.inlineText ? theme.inlineText : undefined}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedServiceDetail(item)
                                  }}
                                  className={`mt-2.5 self-start inline-flex items-center space-x-1 text-[10px] font-bold ${theme.accentText} hover:underline`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Lihat Detail Paket</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {renderAddonsSection()}

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-zinc-900/90 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all duration-300 shadow-sm"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-2/3 py-3.5 rounded-2xl font-extrabold text-xs transition-all duration-300 shadow-xl"
                      style={{
                        ...theme.inlineStyle,
                        color: '#000000',
                      }}
                    >
                      Lanjut Ringkasan &rarr;
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">Langkah 3 dari 3: Ringkasan & Pembayaran</h2>

                  <div 
                    style={theme.inlineBorder ? theme.inlineBorder : undefined}
                    className={`p-4.5 bg-zinc-900/90 border ${theme.accentBorder} rounded-2xl space-y-3 text-xs shadow-2xl backdrop-blur-md`}
                  >
                    <div className="flex justify-between text-zinc-300 font-medium">
                      <span>Layanan {formData.person_count > 1 ? `(${formData.person_count} Orang)` : ''}</span>
                      <span className="font-bold text-white">
                        Rp {((mainServices
                          .filter((s) => formData.selected_services.includes(s.name))
                          .reduce((sum, item) => sum + parsePrice(item.price), 0)) * formData.person_count).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {formData.selectedTenantAddons.map((ta, idx) => (
                      <div key={idx} className="flex justify-between text-zinc-300 text-xs font-medium">
                        <span>{ta.label}</span>
                        <span className="font-bold text-white">Rp {parsePrice(ta.price).toLocaleString('id-ID')}</span>
                      </div>
                    ))}

                    <div className="border-t border-zinc-800 pt-3 flex justify-between font-black text-white text-sm">
                      <span>Total Biaya Keseluruhan</span>
                      <span style={theme.inlineText ? theme.inlineText : undefined} className={`font-black ${theme.accentText} drop-shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]`}>
                        Rp {grandTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Tipe Pembayaran</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {['DP', 'FULL'].map((t) => {
                        const isSelectedType = formData.payment_type === t;
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setFormData((prev) => ({ ...prev, payment_type: t }))}
                            className={`py-3 px-2.5 text-xs rounded-2xl border transition-all duration-300 text-center ${
                              isSelectedType 
                                ? 'border-transparent font-extrabold shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.4)] scale-[1.02]' 
                                : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                            }`}
                            style={
                              isSelectedType
                                ? {
                                    ...(theme.inlineStyle || {}),
                                    color: '#000000',
                                  }
                                : undefined
                            }
                          >
                            <div className="font-extrabold text-sm" style={{ color: isSelectedType ? '#000000' : undefined }}>
                              {t === 'DP' 
                                ? `DP (${tenant.dpType === 'PERCENTAGE' ? `${tenant.dpValue}%` : 'Tetap'})` 
                                : 'Full Payment'}
                            </div>
                            <div className="text-[11px] font-bold mt-0.5" style={{ color: isSelectedType ? '#000000' : undefined }}>
                              Rp {(t === 'DP' ? dpAmount : grandTotal).toLocaleString('id-ID')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Metode Pembayaran</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {availablePaymentMethods.map((m) => {
                        const isSelectedMethod = formData.payment_method === m.id;
                        return (
                          <button
                            type="button"
                            key={m.id}
                            style={isSelectedMethod && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                            onClick={() => setFormData((prev) => ({ ...prev, payment_method: m.id }))}
                            className={`p-3.5 text-left rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                              isSelectedMethod 
                                ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder} shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]` 
                                : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                            }`}
                          >
                            <span style={isSelectedMethod && theme.inlineText ? theme.inlineText : undefined} className="font-extrabold text-xs tracking-wide text-white">
                              {m.title}
                            </span>
                            {m.detail && (
                              <span className={`text-[11px] mt-1 font-medium ${isSelectedMethod ? 'opacity-90' : 'text-zinc-300'}`}>
                                {m.detail}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.payment_method === 'QRIS' && renderQrisSection()}

                  {tenant.requireConsent && (
                    <div className="mt-4 pt-2 border-t border-zinc-800/80">
                      <label className="flex items-start space-x-3 p-4 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl cursor-pointer">
                        <input 
                          type="checkbox" 
                          required
                          style={theme.inlineStyle ? { accentColor: tenant.themeColor } : undefined}
                          className={`w-4 h-4 rounded-md ${theme.checkbox} mt-0.5`}
                          checked={formData.has_consent}
                          onChange={(e) => setFormData((prev) => ({ ...prev, has_consent: e.target.checked }))}
                        />
                        <span className="text-xs text-zinc-200 leading-relaxed font-medium">
                          {tenant.custom_terms_text || "Saya menyetujui ketentuan layanan dan konfirmasi data yang diberikan sudah benar."}
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-zinc-900/90 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all duration-300 shadow-sm"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={loading || (tenant?.requireConsent && !formData?.has_consent)}
                      className={`w-2/3 font-extrabold py-3.5 rounded-2xl transition-all duration-300 shadow-xl text-xs flex items-center justify-center space-x-2 tracking-wider uppercase transform active:scale-[0.99] ${
                        tenant?.requireConsent && !formData?.has_consent
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : ''
                      }`}
                      style={
                        tenant?.requireConsent && !formData?.has_consent
                          ? undefined
                          : {
                              ...theme.inlineStyle,
                              color: '#000000',
                            }
                      }
                    >
                      {loading ? 'Memproses...' : 'Kirim Konfirmasi via WhatsApp'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* -------------------------------------------------------- */}
          {/* OPSI 2: SINGLE PAGE LAYOUT (SEMUA DALAM 1 HALAMAN UTUH) */}
          {/* -------------------------------------------------------- */}
          {isSinglePage && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Bagian 1: Data Diri & Waktu */}
              <div className="space-y-4">
                <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest border-b border-zinc-800 pb-2">
                  1. Informasi Data Diri & Waktu
                </h2>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan nama kamu"
                    className={`w-full px-4.5 py-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                    value={formData.customer_name || ''}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nomor WhatsApp</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="Contoh: 081234567890"
                    className={`w-full px-4.5 py-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                    value={formData.whatsapp_number || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  />
                  <p className="text-[11px] text-zinc-300 italic leading-tight mt-1.5 font-medium">
                    Pastikan nomor WhatsApp aktif untuk menerima konfirmasi & pengingat jadwal.
                  </p>
                </div>

                {tenant?.enable_guest_count && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                      Jumlah Orang / Pasien
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: tenant.maxPersonPerBooking || 5 }, (_, i) => i + 1).map((num) => {
                        const isSelected = formData.person_count === num
                        return (
                          <button
                            type="button"
                            key={num}
                            onClick={() => setFormData((prev) => ({ ...prev, person_count: num }))}
                            className={`py-2.5 text-xs font-bold rounded-2xl border transition-all duration-300 ${
                              isSelected
                                ? 'border-transparent shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.5)] scale-[1.03]'
                                : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                            }`}
                            style={
                              isSelected
                                ? {
                                    ...(theme.inlineStyle || {}),
                                    color: '#000000',
                                  }
                                : undefined
                            }
                          >
                            {num}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isNotesEnabled && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Catatan Khusus (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Misal: Keluhan / Model request"
                      className={`w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.custom_notes || ''}
                      onChange={(e) => setFormData({ ...formData, custom_notes: e.target.value })}
                    />
                  </div>
                )}

                {tenant?.enable_multi_staff && staffList?.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                      {tenant.staffLabel || 'Pilih Staff / Terapis'}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {staffList.map((st) => {
                        const isSelected = formData.selected_staff === st.name
                        return (
                          <button
                            type="button"
                            key={st.id}
                            style={isSelected && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                            onClick={async () => {
                              setFormData(prev => ({ ...prev, selected_staff: st.name, booking_time: '' }))
                            }}
                            className={`py-3 px-3.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-left ${
                              isSelected 
                                ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.3)] scale-[1.01]` 
                                : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                            }`}
                          >
                            <p style={isSelected && theme.inlineText ? theme.inlineText : undefined} className={`text-sm font-bold ${isSelected ? theme.accentText : 'text-zinc-100'}`}>{st.name}</p>
                            <p className="text-[11px] text-zinc-300 font-medium mt-0.5">{st.role}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal Kedatangan</label>
                    <input
                      type="date"
                      required
                      className={`w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 text-xs outline-none transition-all duration-300 [color-scheme:dark] ${theme.accentRing}`}
                      value={formData.booking_date || ''}
                      onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Jam Kedatangan</label>
                      {loadingSlots && <span style={theme.inlineText ? theme.inlineText : undefined} className={`text-[10px] font-bold animate-pulse ${theme.accentText}`}>Memuat ketersediaan...</span>}
                    </div>
                    
                    {!formData.booking_date ? (
                      <p className="text-[11px] text-zinc-300 font-medium italic p-3.5 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl text-center">
                        Silakan pilih tanggal kedatangan terlebih dahulu.
                      </p>
                    ) : (
                      <TimePicker 
                        availableSlots={availableSlots}
                        blockedTimes={blockedTimes}
                        selectedTime={formData.booking_time}
                        onSelectTime={(time: string) => setFormData(prev => ({ ...prev, booking_time: time }))}
                        tenantData={tenant}
                        theme={theme}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Bagian 2: Pilih Layanan & Add-on */}
              <div className="space-y-4 pt-2">
                <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest border-b border-zinc-800 pb-2">
                  2. Pilih Layanan & Add-on
                </h2>

                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Layanan Utama</label>
                    {!tenant.enable_multi_service ? (
                      <span className="text-[10px] text-zinc-300 font-medium">*Pilih 1 layanan</span>
                    ) : (
                      <span style={theme.inlineText ? theme.inlineText : undefined} className={`text-[10px] ${theme.accentText} font-bold`}>*Bisa pilih lebih dari 1</span>
                    )}
                  </div>

                  {fetchingServices ? (
                    <p className="text-xs text-zinc-300 font-medium animate-pulse text-center py-6">Memuat layanan...</p>
                  ) : mainServices.length === 0 ? (
                    <p className="text-xs text-zinc-300 font-medium text-center py-6">Belum ada layanan tersedia.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {mainServices.map((item) => {
                        const active = formData.selected_services.includes(item.name)
                        return (
                          <div
                            key={item.id}
                            style={active && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                            onClick={() => handleServiceSelect(item.name)}
                            className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex flex-col group ${
                              active 
                                ? `${theme.accentBgLight}${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]` 
                                : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-3.5">
                                {tenant.enable_multi_service && (
                                  <div 
                                    style={active && theme.inlineStyle ? { background: tenant.themeColor } : undefined}
                                    className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                                      active ? `${theme.accentSolidBg} border-white shadow-[0_0_12px_currentColor]` : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                                    }`}
                                  >
                                    {active && (
                                      <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div>
                                  <p style={active && theme.inlineText ? theme.inlineText : undefined} className={`text-xs font-bold transition-colors ${active ? theme.accentText : 'text-zinc-100 group-hover:text-white'}`}>{item.name}</p>
                                  <p className="text-[11px] text-zinc-300 font-medium mt-0.5 leading-relaxed">{item.desc}</p>
                                </div>
                              </div>
                              <span className="text-xs font-extrabold text-white bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-inner whitespace-nowrap ml-2">
                                Rp {parsePrice(item.price).toLocaleString('id-ID')}
                              </span>
                            </div>

                            {(item.long_description || item.desc || item.image_url) && (
                              <button
                                type="button"
                                style={theme.inlineText ? theme.inlineText : undefined}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedServiceDetail(item)
                                }}
                                className={`mt-2.5 self-start inline-flex items-center space-x-1 text-[10px] font-bold ${theme.accentText} hover:underline`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Lihat Detail Paket</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {renderAddonsSection()}
              </div>

              {/* Bagian 3: Ringkasan & Pembayaran */}
              <div className="space-y-4 pt-2">
                <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest border-b border-zinc-800 pb-2">
                  3. Ringkasan & Pembayaran
                </h2>

                <div 
                  style={theme.inlineBorder ? theme.inlineBorder : undefined}
                  className={`p-4.5 bg-zinc-900/90 border ${theme.accentBorder} rounded-2xl space-y-3 text-xs shadow-2xl backdrop-blur-md`}
                >
                  <div className="flex justify-between text-zinc-300 font-medium">
                    <span>Layanan {formData.person_count > 1 ? `(${formData.person_count} Orang)` : ''}</span>
                    <span className="font-bold text-white">
                      Rp {((mainServices
                        .filter((s) => formData.selected_services.includes(s.name))
                        .reduce((sum, item) => sum + parsePrice(item.price), 0)) * formData.person_count).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {formData.selectedTenantAddons.map((ta, idx) => (
                    <div key={idx} className="flex justify-between text-zinc-300 text-xs font-medium">
                      <span>{ta.label}</span>
                      <span className="font-bold text-white">Rp {parsePrice(ta.price).toLocaleString('id-ID')}</span>
                    </div>
                  ))}

                  <div className="border-t border-zinc-800 pt-3 flex justify-between font-black text-white text-sm">
                    <span>Total Biaya Keseluruhan</span>
                    <span style={theme.inlineText ? theme.inlineText : undefined} className={`font-black ${theme.accentText} drop-shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.6)]`}>
                      Rp {grandTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Tipe Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {['DP', 'FULL'].map((t) => {
                      const isSelectedType = formData.payment_type === t;
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setFormData((prev) => ({ ...prev, payment_type: t }))}
                          className={`py-3 px-2.5 text-xs rounded-2xl border transition-all duration-300 text-center ${
                            isSelectedType 
                              ? 'border-transparent font-extrabold shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.4)] scale-[1.02]' 
                              : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                          }`}
                          style={
                            isSelectedType
                              ? {
                                  ...(theme.inlineStyle || {}),
                                  color: '#000000',
                                }
                              : undefined
                          }
                        >
                          <div className="font-extrabold text-sm" style={{ color: isSelectedType ? '#000000' : undefined }}>
                            {t === 'DP' 
                              ? `DP (${tenant.dpType === 'PERCENTAGE' ? `${tenant.dpValue}%` : 'Tetap'})` 
                              : 'Full Payment'}
                          </div>
                          <div className="text-[11px] font-bold mt-0.5" style={{ color: isSelectedType ? '#000000' : undefined }}>
                            Rp {(t === 'DP' ? dpAmount : grandTotal).toLocaleString('id-ID')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Metode Pembayaran</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availablePaymentMethods.map((m) => {
                      const isSelectedMethod = formData.payment_method === m.id;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          style={isSelectedMethod && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                          onClick={() => setFormData((prev) => ({ ...prev, payment_method: m.id }))}
                          className={`p-3.5 text-left rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                            isSelectedMethod 
                              ? `${theme.accentBgLight} ${theme.accentText}${theme.accentBorder} shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]` 
                              : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:text-white'
                          }`}
                        >
                          <span style={isSelectedMethod && theme.inlineText ? theme.inlineText : undefined} className="font-extrabold text-xs tracking-wide text-white">
                            {m.title}
                          </span>
                          {m.detail && (
                            <span className={`text-[11px] mt-1 font-medium ${isSelectedMethod ? 'opacity-90' : 'text-zinc-300'}`}>
                              {m.detail}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {formData.payment_method === 'QRIS' && renderQrisSection()}

                {tenant.requireConsent && (
                  <div className="mt-4 pt-2 border-t border-zinc-800/80">
                    <label className="flex items-start space-x-3 p-4 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl cursor-pointer">
                      <input 
                        type="checkbox" 
                        required
                        style={theme.inlineStyle ? { accentColor: tenant.themeColor } : undefined}
                        className={`w-4 h-4 rounded-md ${theme.checkbox} mt-0.5`}
                        checked={formData.has_consent}
                        onChange={(e) => setFormData((prev) => ({ ...prev, has_consent: e.target.checked }))}
                      />
                      <span className="text-xs text-zinc-200 leading-relaxed font-medium">
                        {tenant.custom_terms_text || "Saya menyetujui ketentuan layanan dan konfirmasi data yang diberikan sudah benar."}
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (tenant?.requireConsent && !formData?.has_consent)}
                  className={`w-full font-extrabold py-4 rounded-2xl transition-all duration-300 shadow-xl text-xs flex items-center justify-center space-x-2 tracking-wider uppercase transform active:scale-[0.99] mt-4 ${
                    tenant?.requireConsent && !formData?.has_consent
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : ''
                  }`}
                  style={
                    tenant?.requireConsent && !formData?.has_consent
                      ? undefined
                      : {
                          ...theme.inlineStyle,
                          color: '#000000',
                        }
                  }
                >
                  {loading ? 'Memproses...' : 'Kirim Konfirmasi via WhatsApp'}
                </button>
              </div>

            </div>
          )}

        </form>
      </div>

      {/* POPUP MODAL DETAIL LAYANAN */}
      {selectedServiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedServiceDetail(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-zinc-800/80 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {'name' in selectedServiceDetail ? (
              <h3 className="text-lg font-bold text-white">{selectedServiceDetail.name}</h3>
            ) : (
              <h3 className="text-lg font-bold text-white">{(selectedServiceDetail as TenantAddonItem).label}</h3>
            )}

            {selectedServiceDetail.image_url && (
              <img
                src={selectedServiceDetail.image_url}
                alt="Detail Layanan"
                className="w-full h-48 object-cover rounded-2xl border border-zinc-800"
              />
            )}

            <p className="text-xs text-zinc-300 leading-relaxed">
              {selectedServiceDetail.long_description || selectedServiceDetail.desc || 'Tidak ada deskripsi detail.'}
            </p>

            <div className="pt-2 flex justify-between items-center border-t border-zinc-800">
              <span className="text-xs font-bold text-zinc-400">Harga Layanan:</span>
              <span className="text-sm font-extrabold text-white">
                Rp {parsePrice('price' in selectedServiceDetail ? selectedServiceDetail.price : (selectedServiceDetail as any).price || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedServiceDetail(null)}
              className="w-full py-3 rounded-2xl font-bold text-xs bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

    </main>
  )
}

// ============================================================================
// 6. EXPORTS & SUSPENSE WRAPPER
// ============================================================================
export default function BookingForm({ initialTenant }: { initialTenant?: TenantData }) {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <p className="text-xs text-zinc-400 font-medium">Memuat Halaman Booking...</p>
      </main>
    }>
      <BookingFormContent initialTenant={initialTenant} />
    </Suspense>
  )
}