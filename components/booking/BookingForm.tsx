'use client'

export const dynamic = 'force-dynamic'

// ============================================================================
// 1. IMPORTS & DEPENDENCIES
// ============================================================================
import React, { useState, useEffect, type CSSProperties } from 'react'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { 
  BankAccount, 
  EWalletAccount, 
  TenantAddonItem, 
  ServiceItem, 
  AddonService, 
  StaffItem, 
  Tenant, 
  TimeSlot,
  BookedReservation,
  AvailabilityApiResponse
} from '@/types'

// ============================================================================
// 2. TYPE DEFINITIONS & INTERFACES (LOCAL EXTENSIONS)
// ============================================================================

interface ExtendedTimeSlot extends TimeSlot {
  time_slot?: string
}

interface ThemeConfig {
  accentBg?: string
  accentSolidBg?: string
  accentText?: string
  accentBorder?: string
  accentBgLight?: string
  accentRing?: string
  iconBg?: string
  checkbox?: string
  inlineStyle?: CSSProperties
  inlineText?: CSSProperties
  inlineBorder?: CSSProperties
  inlineBgLight?: CSSProperties
  inlineShadow?: CSSProperties
  [key: string]: unknown
}

interface TimePickerProps {
  availableSlots: TimeSlot[]
  blockedTimes: string[]
  blockedDetails?: Record<string, string>
  selectedTime: string
  onSelectTime: (time: string) => void
  // Update tipe tenantData agar TypeScript mengenali properti di dalamnya
  tenantData?: {
    hide_booked_slots?: boolean | null
    hideBookedSlots?: boolean | null
    enable_auto_disable_time_slots?: boolean | null
    enableAutoDisableTimeSlots?: boolean | null
    [key: string]: unknown // opsional: agar fleksibel jika ada properti lain
  } | null
  theme?: {
    accentBg?: string
    inlineStyle?: React.CSSProperties
    [key: string]: unknown
  }
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

// 🟢 TARO HELPER DENGAN PENYESUAIAN TIPE DI SINI:
const getServiceDisplayLabel = (
  detail?: ServiceItem | TenantAddonItem | null
): string => {
  if (!detail) return '-'
  
  const addonLabel = 'addon_label' in detail ? detail.addon_label : undefined
  return detail.name ?? addonLabel ?? detail.label ?? '-'
}

// ============================================================================
// 4. SUB-COMPONENTS
// ============================================================================

function TimePicker({
  availableSlots,
  blockedTimes = [],
  blockedDetails = {},
  selectedTime,
  onSelectTime,
  tenantData,
  theme
}: TimePickerProps) {
  // Ambil setting hide_booked_slots dengan aman
  const shouldHideBooked = Boolean(tenantData?.hide_booked_slots || tenantData?.hideBookedSlots)
  const shouldAutoDisable = tenantData?.enable_auto_disable_time_slots ?? tenantData?.enableAutoDisableTimeSlots ?? true

  const displayedSlots = (availableSlots || [])
    .map((slot: TimeSlot | string) => {
      // 1. Dapatkan string waktu (contoh: "09:00")
      const rawTime = typeof slot === 'string' ? slot : (slot.time || slot.time_slot || '')
      const timeStr = typeof rawTime === 'string' ? rawTime.trim().substring(0, 5) : ''

      if (!timeStr) return null

      // 2. Cek apakah slot ada di daftar blockedTimes
      const isBlockedByApi = Array.isArray(blockedTimes) && blockedTimes.some((b) => {
        if (!b) return false
        const bStr = typeof b === 'string' ? b.trim().substring(0, 5) : ''
        return bStr === timeStr
      })
      
      const isObjectSlot = typeof slot === 'object' && slot !== null
      const isSlotDisabled =
        (isObjectSlot && (slot.disabled === true || slot.is_available === false)) || isBlockedByApi

      // 3. Ambil alasan kenapa slot di-block (Jam Istirahat / Penuh / Tutup)
      const apiReason = blockedDetails?.[timeStr] || (isObjectSlot ? slot.reason : '') || (isBlockedByApi ? 'Penuh' : '')

      // 4. Tentukan apakah slot disembunyikan
      // Jangan sembunyikan jika alasannya adalah 'Jam Istirahat' (agar user tahu clinic sedang break)
      const isRestTime = apiReason === 'Jam Istirahat' || apiReason === 'Istirahat'
      const isHidden = shouldHideBooked && isSlotDisabled && !isRestTime

      return {
        ...(isObjectSlot ? slot : {}),
        time: timeStr,
        isDisabled: shouldAutoDisable ? isSlotDisabled : false,
        isHidden: isHidden,
        reason: apiReason,
      }
    })
    .filter((slot): slot is NonNullable<typeof slot> => slot !== null && !slot.isHidden && Boolean(slot.time))

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
            style={isSelected && theme?.inlineStyle ? theme.inlineStyle : undefined}
            onClick={() => {
              if (!slot.isDisabled) {
                onSelectTime(slot.time)
              }
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition-all duration-300 border relative overflow-hidden group ${
              slot.isDisabled
                ? 'bg-zinc-950/60 text-zinc-600 border-zinc-800/50 cursor-not-allowed opacity-50'
                : isSelected
                ? `${theme?.accentBg || 'bg-rose-500'} !text-black border-white/25 scale-[1.04] z-10 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.6)] ring-2 ring-white/40`
                : 'bg-zinc-950/90 text-zinc-300 border-zinc-800/80 hover:border-zinc-700 hover:text-white hover:bg-zinc-900/80 hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]'
            }`}
          >
            <span className="relative z-10">{slot.time}</span>
            {slot.isDisabled && (
              <span className="block text-[9px] text-rose-500 font-semibold tracking-wide mt-0.5">
                {slot.reason === 'Jam Istirahat' || slot.reason === 'Istirahat' ? 'Istirahat' : 'Penuh'}
              </span>
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
export default function BookingFormContent({ initialTenant }: { initialTenant?: Tenant }) {
  const params = useParams()
  const routerSlug = (params?.tenant_slug as string) || ''

  // --------------------------------------------------------------------------
  // 5.1 State Management
  // --------------------------------------------------------------------------
  const [step, setStep] = useState<number>(1)
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant || null)

  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [fetchingServices, setFetchingServices] = useState<boolean>(true)

  const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceItem | TenantAddonItem | null>(null)
  const [qrisData, setQrisData] = useState<{ qrUrl?: string; qrString?: string; snapToken?: string } | null>(null)
  const [loadingQris, setLoadingQris] = useState<boolean>(false)

  const [isAddonExpanded, setIsAddonExpanded] = useState<boolean>(false)

  const [, setBlockedSlots] = useState<{ block_date: string; block_time: string }[]>([])
  const [blockedTimes, setBlockedTimes] = useState<string[]>([])
  const [blockedDetails, setBlockedDetails] = useState<Record<string, string>>({})
  const [bookedReservations, setBookedReservations] = useState<BookedReservation[]>([])
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])

  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    selected_services: [] as string[],
    selectedAddonIds: [] as (number | string)[],
    selectedTenantAddons: [] as { label: string; price: number }[],
    selected_staff: '',
    selected_staff_id: '',
    payment_method: 'Cash / Bayar di Tempat',
    person_count: 1,
    payment_type: 'FULL',
    has_consent: false,
    custom_notes: ''
  })
  
  const [addonQuantities] = useState<{ [key: string | number]: number }>({})
  const [loading, setLoading] = useState<boolean>(false)
  
  // --------------------------------------------------------------------------
  // 5.2 Side Effects
  // --------------------------------------------------------------------------
  
  // Effect 1: Fetch Tenant & Initial Data
  useEffect(() => {
    if (typeof window === 'undefined') return

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
          .or(`domain_url.eq.${hostname},tenant_slug.eq.${keywordQuery},client_code.ilike.${keywordQuery}`)
          .maybeSingle()

        if (tenantErr || !tenantData) {
          console.error('Tenant tidak ditemukan:', tenantErr)
          return
        }

        const uniqueTenantId = tenantData.id || tenantData.tenant_id
        const dbClientCode = tenantData.client_code
        const dbSlug = tenantData.tenant_slug

        if (!uniqueTenantId || !dbClientCode || !dbSlug) {
          return
        }

        const dbPlan = ((tenantData?.subscription_plan || 'PROFESIONAL') as string).toUpperCase()
        const rawCategory = tenantData?.category || 'Layanan'

        const activeTenant: Tenant = {
          id: uniqueTenantId,
          client_code: dbClientCode,
          tenant_slug: dbSlug,
          name: tenantData?.business_name || tenantData?.name || dbClientCode,
          business_name: tenantData?.business_name || tenantData?.name || dbClientCode,
          admin_wa: tenantData?.admin_wa || '',
          subscription_plan: dbPlan,
          category: rawCategory,
          staff_label: tenantData?.staff_label || 'Staff',
          layout_type: 'STEP_WIZARD',
          theme_color: tenantData?.theme_color || 'rose',
          require_consent: tenantData?.require_consent ?? false,
          custom_terms_text: tenantData?.custom_terms_text || '',
          show_extra_addon: tenantData?.show_extra_addon ?? true,
          custom_payment_dp: tenantData?.custom_payment_dp ?? false,
          dp_type: tenantData?.dp_type || 'PERCENTAGE',
          dp_value: tenantData?.dp_value ?? 50,
          qris_url: tenantData?.qris_url || '',
          is_system_maintenance: tenantData?.is_system_maintenance ?? false,
          is_maintenance_mode: tenantData?.is_maintenance_mode ?? false,
          maintenance_message:
            tenantData?.maintenance_message ||
            'Mohon maaf, halaman pemesanan layanan saat ini sedang ditutup sementara.',
          bank_accounts: Array.isArray(tenantData?.bank_accounts) ? tenantData.bank_accounts : [],
          ewallet_accounts: Array.isArray(tenantData?.ewallet_accounts) ? tenantData.ewallet_accounts : [],
          prevent_double_booking: tenantData?.prevent_double_booking ?? true,
          hide_booked_slots: tenantData?.hide_booked_slots ?? false,
          enable_auto_disable_time_slots: tenantData?.enable_auto_disable_time_slots ?? true,
          enable_slot_blocking: tenantData?.enable_slot_blocking ?? true,
          enable_multi_staff: tenantData?.enable_multi_staff ?? false,
          enable_multi_service: tenantData?.enable_multi_service ?? true,
          enable_notes: tenantData?.enable_notes ?? true,
          addons: Array.isArray(tenantData?.addons) ? tenantData.addons : [],
        }

        setTenant(activeTenant)

        // 1. Fetch Services
        const { data: serviceData } = await supabase
          .from('services')
          .select('*')
          .eq('tenant_id', uniqueTenantId)

        if (serviceData && serviceData.length > 0) {
          setServices(serviceData)
          const firstMain = serviceData.filter((s: ServiceItem) => !s.is_addon)
          if (firstMain.length > 0 && firstMain[0].name) {
            setFormData((prev) => ({ ...prev, selected_services: [firstMain[0].name!] }))
          }
        } else {
          setServices([])
        }

        // 2. Fetch Staff
        const { data: staffData } = await supabase
          .from('staff')
          .select('*')
          .eq('tenant_id', uniqueTenantId)
          .eq('is_active', true)

        if (staffData && staffData.length > 0) {
          setStaffList(staffData)
          if (staffData[0].name) {
            setFormData((prev) => ({
              ...prev,
              selected_staff: staffData[0].name!,
              selected_staff_id: String(staffData[0].id),
            }))
          }
        } else {
          setStaffList([])
        }

        // 3. Fetch Blocked Slots Initial
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
          })) || []),
        ]

        setBlockedSlots(combinedBlockedSlots)
      } catch {
        console.error('Fetch tenant error:')
      } finally {
        setFetchingServices(false)
      }
    }

    fetchTenantAndData()
  }, [routerSlug])

  // Effect 2: Fetch Availability secara Dinamis
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!tenant?.tenant_slug || !formData.booking_date) {
        return
      }

      setLoadingSlots(true)
      try {
        // 1. Susun parameter Staff
        const isSpecificStaff =
          formData.selected_staff &&
          formData.selected_staff !== 'all' &&
          formData.selected_staff !== 'any'

        const staffParam = isSpecificStaff
          ? `&staff=${encodeURIComponent(formData.selected_staff)}`
          : ''

        // 2. Susun Layanan & Addons
        const selectedServiceList: string[] = (formData.selected_services || []).map(
          (item) => String(item)
        )

        let selectedAddonList: string[] = []
        if (formData.selectedAddonIds && formData.selectedAddonIds.length > 0) {
          selectedAddonList = formData.selectedAddonIds.map((id) => String(id))
        } else if (
          formData.selectedTenantAddons &&
          formData.selectedTenantAddons.length > 0
        ) {
          selectedAddonList = formData.selectedTenantAddons
            .map((addon: TenantAddonItem) => {
              const item = addon as { id?: string | number; name?: string; label?: string }
              return item.label || item.name || (item.id ? String(item.id) : '')
            })
            .filter((val: string) => val.trim().length > 0)
        }

        const allSelectedItems: string[] = [
          ...selectedServiceList,
          ...selectedAddonList,
        ]

        // 3. Hitung Total Durasi
        let totalDuration = 0
        if (allSelectedItems.length > 0 && services && services.length > 0) {
          allSelectedItems.forEach((itemIdOrName) => {
            const foundItem = services.find(
              (s: ServiceItem) => String(s.id) === itemIdOrName || s.name === itemIdOrName
            )
            if (foundItem && foundItem.duration) {
              totalDuration += Number(foundItem.duration)
            }
          })
        }

        const durationParam = totalDuration > 0 ? `&duration=${totalDuration}` : ''
        const servicesParam =
          selectedServiceList.length > 0
            ? `&services=${encodeURIComponent(JSON.stringify(selectedServiceList))}`
            : ''
        const addonsParam =
          selectedAddonList.length > 0
            ? `&addons=${encodeURIComponent(JSON.stringify(selectedAddonList))}`
            : ''

        // 4. Panggil API (Hanya 1x Fetch dengan Query Lengkap)
        const apiUrl = `/api/availability?date=${formData.booking_date}&tenant_slug=${tenant.tenant_slug}${staffParam}${durationParam}${servicesParam}${addonsParam}`
        const res = await fetch(apiUrl)

        if (!res.ok) {
          throw new Error(`API Error: Status ${res.status}`)
        }

        // BACA JSON CUKUP 1 KALI DENGAN PENETAPAN TIPE
        const data: AvailabilityApiResponse = await res.json()

        if (data.success) {
          // Format slot agar kompatibel dengan TimePicker (Format String & Object)
          const formattedSlots: TimeSlot[] = (data.slots || []).map((slotStr: string) => ({
            time: slotStr.substring(0, 5),
            time_slot: slotStr.substring(0, 5),
            is_available: true,
            disabled: false,
          }))

          // Simpan ke State tanpa tumpang tindih
          setAvailableSlots(formattedSlots)
          setBlockedTimes((data.blockedTimes || []).map((t) => String(t).substring(0, 5)))
          setBlockedDetails(data.blockedDetails || {})
          
          const activeBookings: BookedReservation[] = (data.bookedReservations || []).filter(
            (b: BookedReservation) =>
              b.status !== 'cancelled' &&
              b.status !== 'refunded' &&
              b.status !== 'rejected'
          )
          setBookedReservations(activeBookings)

          if (data.tenantSettings) {
            setTenant((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                hide_booked_slots:
                  data.tenantSettings?.hide_booked_slots ?? prev.hide_booked_slots ?? false,
                enable_auto_disable_time_slots:
                  data.tenantSettings?.enable_auto_disable_time_slots ??
                  prev.enable_auto_disable_time_slots ??
                  true,
              }
            })
          }
        } else {
          setAvailableSlots([])
          setBlockedTimes([])
          setBlockedDetails({})
          setBookedReservations([])
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Fetch availability error'
        console.error('Fetch availability error:', errorMsg, err)
        setAvailableSlots([])
        setBlockedTimes([])
        setBlockedDetails({})
        setBookedReservations([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchAvailability()
  }, [
    formData.booking_date,
    formData.selected_staff,
    formData.selected_staff_id,
    formData.selected_services,
    formData.selectedAddonIds,
    formData.selectedTenantAddons,
    tenant?.tenant_slug,
    services,
  ])

  // Effect 3: Auto-Reset Jam Kedatangan Saat Pilihan Tanggal/Staff/Layanan Berubah
  useEffect(() => {
    setFormData((prev) => {
      if (prev.booking_time) {
        return { ...prev, booking_time: '' }
      }
      return prev
    })
  }, [
    formData.booking_date, 
    formData.selected_staff, 
    formData.selected_services, 
    formData.selectedAddonIds,
    formData.selectedTenantAddons
  ])

  // Effect 4: Dynamic QRIS Generation
  useEffect(() => {
    let isMounted = true

    const calcPrice = (priceVal?: string | number) => {
      if (typeof priceVal === 'number') return isNaN(priceVal) ? 0 : priceVal
      if (!priceVal) return 0
      const numeric = priceVal.toString().replace(/[^0-9]/g, '')
      return numeric ? parseInt(numeric, 10) : 0
    }

    const mainServs = services.filter((s) => !s.is_addon)
    const sTotal = mainServs
      .filter((s) => s.name && formData.selected_services.includes(s.name))
      .reduce((sum, item) => sum + calcPrice(item.price), 0) * formData.person_count

    const addServs = services.filter((s) => s.is_addon)
    const extraFeeOld = addServs
      .filter((addon) => addon.id !== undefined && formData.selectedAddonIds.includes(addon.id))
      .reduce((sum, addon) => {
        const addonKey = addon.id ?? ''
        const qty = addonQuantities[addonKey] || 1
        return sum + (calcPrice(addon.price) * qty)
      }, 0)

    const extraFeeNew = formData.selectedTenantAddons
      .reduce((sum, addon) => sum + calcPrice(addon.price), 0)

    const gTotal = sTotal + extraFeeOld + extraFeeNew

    let pAmount = gTotal
    if (tenant && formData.payment_type === 'DP') {
      const rawDpValue = tenant.dp_value ?? 50
      const dpVal = typeof rawDpValue === 'number' ? rawDpValue : Number(rawDpValue || 50)
      const dpType = tenant.dp_type || 'PERCENTAGE'

      if (dpType === 'FIXED') {
        pAmount = dpVal > gTotal ? gTotal : dpVal
      } else {
        pAmount = Math.round(gTotal * (dpVal / 100))
      }
    }

    const generateDynamicQris = async () => {
      if (isMounted) setLoadingQris(true)
      
      try {
        const response = await fetch('/api/qris/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: pAmount,
            tenantSlug: tenant?.tenant_slug || '',
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
      } catch {
        if (isMounted) setQrisData(null)
      } finally {
        if (isMounted) setLoadingQris(false)
      }
    }

    if (formData.payment_method === 'QRIS' && pAmount > 0 && tenant?.tenant_slug) {
      generateDynamicQris()
    }

    return () => {
      isMounted = false
    }
  }, [formData.payment_method, formData.payment_type, formData.selected_services, formData.selectedAddonIds, formData.selectedTenantAddons, formData.person_count, addonQuantities, services, tenant, formData.customer_name])

  // --------------------------------------------------------------------------
  // 🛡️ GUARD CLAUSES
  // --------------------------------------------------------------------------
  
  if (fetchingServices) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            Memuat data reservasi...
          </p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-3 shadow-xl">
          <h2 className="text-base font-semibold text-white">Tenant Tidak Ditemukan</h2>
          <p className="text-xs text-zinc-400">
            Halaman reservasi yang Anda tuju tidak tersedia atau tautan tidak valid.
          </p>
        </div>
      </div>
    )
  }

  if (tenant?.is_maintenance_mode) {
    return (
      <main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900/90 border border-amber-500/30 rounded-3xl p-8 text-center space-y-5 backdrop-blur-xl shadow-2xl">
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
  // 5.3 Derived States & Calculations
  // --------------------------------------------------------------------------
  const mainServices = services.filter((s) => !s.is_addon)

  const addonServices: AddonService[] = services
  .filter((s) => s.is_addon)
  .map((s) => {
    const parsedPrice = typeof s.price === 'number' ? s.price : Number(s.price || 0)
    return {
      id: s.id,
      tenant_slug: s.tenant_slug || '',
      name: s.name || '',
      price: parsedPrice,
      addon_label: s.name || '',
      addon_price: parsedPrice,
      desc: s.desc || '',
      long_description: s.long_description || '',
      image_url: s.image_url || '',
      duration: s.duration || 0,
      is_active: s.is_active ?? true
    }
  })

  const isNotesEnabled = tenant.enable_notes ?? true

  const parsePrice = (priceVal?: string | number) => {
    if (typeof priceVal === 'number') return isNaN(priceVal) ? 0 : priceVal
    if (!priceVal) return 0
    const numeric = priceVal.toString().replace(/[^0-9]/g, '')
    return numeric ? parseInt(numeric, 10) : 0
  }

  const getEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return ''
    const [hours, minutes] = startTime.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return ''

    const date = new Date()
    date.setHours(hours, minutes + durationMinutes, 0)

    const endHours = String(date.getHours()).padStart(2, '0')
    const endMinutes = String(date.getMinutes()).padStart(2, '0')
    return `${endHours}:${endMinutes}`
  }

  const calculateTotalDuration = (): number => {
    let totalMinutes = 0

    const selectedServices = formData.selected_services || []
    if (selectedServices.length > 0 && services && services.length > 0) {
      selectedServices.forEach((serviceIdentifier) => {
        const found = services.find(
          (s) =>
            !s.is_addon &&
            (String(s.id) === String(serviceIdentifier) || s.name === serviceIdentifier)
        )
        if (found && found.duration) {
          totalMinutes += Number(found.duration)
        }
      })
    }

    if (formData.selectedTenantAddons && formData.selectedTenantAddons.length > 0) {
      formData.selectedTenantAddons.forEach((addonObj) => {
        const foundAddon = services?.find(
          (s) =>
            s.is_addon &&
            (s.name === addonObj.label ||
              s.name === (addonObj as unknown as { name?: string }).name ||
              String(s.id) === String((addonObj as unknown as { id?: string | number }).id))
        )
        if (foundAddon && foundAddon.duration) {
          totalMinutes += Number(foundAddon.duration)
        }
      })
    } else if (formData.selectedAddonIds && formData.selectedAddonIds.length > 0) {
      formData.selectedAddonIds.forEach((addonIdentifier) => {
        const foundAddon = services?.find(
          (s) =>
            s.is_addon &&
            (String(s.id) === String(addonIdentifier) || s.name === addonIdentifier)
        )
        if (foundAddon && foundAddon.duration) {
          totalMinutes += Number(foundAddon.duration)
        }
      })
    }

    return totalMinutes > 0 ? totalMinutes : 45
  }

  const totalDuration = calculateTotalDuration()

  const calculateTotal = () => {
    const selectedServices = formData?.selected_services || []
    const mainServicesList = mainServices || []

    let serviceTotal = mainServicesList
      .filter((s) => s.name && (selectedServices.includes(s.name) || (s.id && selectedServices.includes(String(s.id)))))
      .reduce((sum, item) => sum + (typeof parsePrice === 'function' ? parsePrice(item.price) : Number(item.price) || 0), 0)

    const personCount = Number(formData?.person_count) || 1
    serviceTotal = serviceTotal * personCount

    let extraFee = 0

    if (formData?.selectedTenantAddons && formData.selectedTenantAddons.length > 0) {
      extraFee = formData.selectedTenantAddons.reduce((sum, addon) => {
        const price = typeof parsePrice === 'function' ? parsePrice(addon.price) : Number(addon.price) || 0
        return sum + price
      }, 0)
    } else if (formData?.selectedAddonIds && formData.selectedAddonIds.length > 0 && addonServices) {
      extraFee = addonServices
        .filter((addon) => addon.id !== undefined && formData.selectedAddonIds.includes(addon.id))
        .reduce((sum, addon) => {
          const addonKey = addon.id ?? ''
          const qty = addonQuantities[addonKey] || 1
          const price = typeof parsePrice === 'function' ? parsePrice(addon.addon_price ?? addon.price) : Number(addon.price) || 0
          return sum + (price * qty)
        }, 0)
    }

    return serviceTotal + extraFee
  }

  const grandTotal = calculateTotal()

  const calculateDP = () => {
    const rawDpValue = tenant?.dp_value ?? 50
    const dpVal = typeof rawDpValue === 'number' ? rawDpValue : Number(rawDpValue || 50)
    const dpType = tenant?.dp_type || 'PERCENTAGE'

    if (dpType === 'FIXED') {
      return dpVal > grandTotal ? grandTotal : dpVal
    }
    return Math.round(grandTotal * (dpVal / 100))
  }

  const dpAmount = calculateDP()
  const payableAmount = formData?.payment_type === 'DP' ? dpAmount : grandTotal
  const remainingAmount = grandTotal - payableAmount

  const getAvailablePaymentMethods = () => {
    const methods: { id: string; title: string; detail?: string }[] = []
    const isPayingDp = formData?.payment_type === 'DP'

    const qris = String(tenant?.qris_url || '')
    if (qris && qris.trim() !== '') {
      methods.push({ id: 'QRIS', title: 'QRIS Instan', detail: 'Scan QR langsung dari HP' })
    }

    if (Array.isArray(tenant?.bank_accounts) && tenant.bank_accounts.length > 0) {
      tenant.bank_accounts.forEach((bank: BankAccount) => {
        methods.push({
          id: `Transfer ${bank.bank_name}`,
          title: `Transfer ${bank.bank_name}`,
          detail: `${bank.account_number} (a.n ${bank.holder_name})`,
        })
      })
    }

    if (Array.isArray(tenant?.ewallet_accounts) && tenant.ewallet_accounts.length > 0) {
      tenant.ewallet_accounts.forEach((wallet: EWalletAccount) => {
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
  // 5.4 Theme Configuration Helper
  // --------------------------------------------------------------------------
  const getThemeClasses = (color?: string): ThemeConfig => {
    const trimmedColor = (color || 'rose').trim()

    const createHexTheme = (hex: string): ThemeConfig => ({
      accentBg: 'bg-gradient-to-r opacity-95 hover:opacity-100 shadow-[0_0_25px_rgba(0,0,0,0.4)]',
      accentSolidBg: '',
      accentText: '',
      accentBorder: 'shadow-[0_0_25px_rgba(0,0,0,0.25)]',
      accentBgLight: 'backdrop-blur-md',
      accentRing: 'focus:ring-2 shadow-[0_0_20px_rgba(0,0,0,0.15)]',
      iconBg: 'backdrop-blur-md shadow-[0_0_35px_rgba(0,0,0,0.35)]',
      checkbox: 'text-current',
      inlineStyle: {
        background: `linear-gradient(to right, ${hex}, ${hex}dd)`,
        borderColor: hex,
        color: hex
      },
      inlineText: { color: hex },
      inlineBorder: { borderColor: hex },
      inlineBgLight: { backgroundColor: `${hex}22` },
      inlineShadow: { boxShadow: `0 0 30px ${hex}66` }
    })

    if (trimmedColor.startsWith('#')) {
      return createHexTheme(trimmedColor)
    }

    const presetThemes: Record<string, ThemeConfig> = {
      rose: {
        accentBg: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-600 hover:to-pink-700 shadow-[0_0_30px_rgba(244,63,94,0.45)]',
        accentSolidBg: 'bg-rose-500',
        accentText: 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]',
        accentBorder: 'border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.25)]',
        accentBgLight: 'bg-rose-500/[0.12] backdrop-blur-md',
        accentRing: 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
        iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.4)]',
        checkbox: 'accent-rose-500 text-rose-500'
      },
      teal: {
        accentBg: 'bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-600 hover:from-teal-600 hover:to-emerald-700 shadow-[0_0_30px_rgba(20,184,166,0.45)]',
        accentSolidBg: 'bg-teal-500',
        accentText: 'text-teal-400 drop-shadow-[0_0_12px_rgba(20,184,166,0.6)]',
        accentBorder: 'border-teal-500/50 shadow-[0_0_25px_rgba(20,184,166,0.25)]',
        accentBgLight: 'bg-teal-500/[0.12] backdrop-blur-md',
        accentRing: 'focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]',
        iconBg: 'bg-teal-500/15 text-teal-400 border-teal-500/40 shadow-[0_0_35px_rgba(20,184,166,0.4)]',
        checkbox: 'accent-teal-500 text-teal-500'
      },
      indigo: {
        accentBg: 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-700 shadow-[0_0_30px_rgba(99,102,241,0.45)]',
        accentSolidBg: 'bg-indigo-500',
        accentText: 'text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]',
        accentBorder: 'border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.25)]',
        accentBgLight: 'bg-indigo-500/[0.12] backdrop-blur-md',
        accentRing: 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]',
        iconBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40 shadow-[0_0_35px_rgba(99,102,241,0.4)]',
        checkbox: 'accent-indigo-500 text-indigo-500'
      },
      purple: {
        accentBg: 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-600 hover:from-purple-600 hover:to-fuchsia-700 shadow-[0_0_30px_rgba(168,85,247,0.45)]',
        accentSolidBg: 'bg-purple-500',
        accentText: 'text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]',
        accentBorder: 'border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.25)]',
        accentBgLight: 'bg-purple-500/[0.12] backdrop-blur-md',
        accentRing: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
        iconBg: 'bg-purple-500/15 text-purple-400 border-purple-500/40 shadow-[0_0_35px_rgba(168,85,247,0.4)]',
        checkbox: 'accent-purple-500 text-purple-500'
      },
      red: {
        accentBg: 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 hover:from-red-600 hover:to-rose-700 shadow-[0_0_30px_rgba(239,68,68,0.45)]',
        accentSolidBg: 'bg-red-500',
        accentText: 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]',
        accentBorder: 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.25)]',
        accentBgLight: 'bg-red-500/[0.12] backdrop-blur-md',
        accentRing: 'focus:border-red-500 focus:ring-2 focus:ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
        iconBg: 'bg-red-500/15 text-red-400 border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.4)]',
        checkbox: 'accent-red-500 text-red-500'
      },
      amber: {
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

    const key = trimmedColor.toLowerCase()
    return presetThemes[key] || presetThemes['rose']
  }

  const themeColorValue = String(tenant.theme_color || 'rose')
  const theme = getThemeClasses(themeColorValue)

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
      if (!formData.selected_services || formData.selected_services.length === 0) {
        alert('Mohon pilih minimal 1 layanan utama!')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      if (!formData.booking_date || !formData.booking_time) {
        alert('Mohon tentukan tanggal dan jam kedatangan!')
        return
      }

      if (isSlotBlocked(formData.booking_date, formData.booking_time)) {
        alert('Maaf, tanggal/jam yang Anda pilih sedang tidak tersedia. Silakan pilih jam lain.')
        return
      }

      if (formData.selected_staff && (tenant?.preventDoubleBooking || tenant?.prevent_double_booking)) {
        const activeBookings = (bookedReservations || []).filter(
          (b: BookedReservation) => (b.time || b.booking_time) === formData.booking_time && b.status !== 'cancelled' && b.status !== 'refunded'
        )
        const currentStaffObj = (staffList || []).find(
          s => s.name === formData.selected_staff || (s.id && s.id.toString() === formData.selected_staff)
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

      setStep(3)
      return
    }
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

    const insertPayload: Record<string, unknown> = {
      customer_name: formData.customer_name,
      whatsapp_number: formData.whatsapp_number,
      booking_date: formData.booking_date,
      booking_time: formData.booking_time,
      selected_services: formData.selected_services,
      service_name: formattedServicesText,
      selected_addons: formData.selectedAddonIds,
      selected_addon_ids: formData.selectedAddonIds,
      
      staff_name: formData.selected_staff || null,
      staff_id: formData.selected_staff_id || null,
      client_code: tenant.clientCode,
      tenant_slug: tenant.tenantSlug,
      tenant_id: tenant.id || null,

      total_price: grandTotal,
      person_count: formData.person_count,
      payment_type: formData.payment_type,
      payment_method: formData.payment_method,
      status: 'pending',
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
        if (
          response.status === 409 || 
          result.error?.toLowerCase().includes('terisi') || 
          result.error?.toLowerCase().includes('bentrok')
        ) {
          alert('⚠️ Maaf, slot waktu ini baru saja dipesan oleh pelanggan lain. Halaman akan diperbarui.')
          setFormData((prev) => ({ ...prev, booking_time: '' }))
        } else {
          alert(result.error || 'Gagal membuat reservasi!')
        }
        
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

      const selectedAddonsForWa = addonServices.filter((addon) => addon.id !== undefined && formData.selectedAddonIds.includes(addon.id))
      if (selectedAddonsForWa.length > 0) {
        const addonNamesStr = selectedAddonsForWa.map((a) => {
          const addonKey = a.id ?? ''
          const qty = addonQuantities[addonKey] || 1
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

      if (tenant?.waGatewayUrl) {
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
        } catch {
          console.error('Gagal memicu WA Gateway:')
        }
      }

      const adminPhone = tenant.adminWa || ''
      const formattedPhone = formatWaNumber(adminPhone)

      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`
      window.open(waUrl, '_blank')
    } catch {
      alert('Terjadi kesalahan koneksi ke server.')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // 5.6 Render Helper Methods
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
            <div style={theme.inlineStyle ? { background: tenant?.themeColor } : undefined} className={`w-6 h-6 border-2 ${theme.accentSolidBg} border-t-transparent rounded-full animate-spin`}></div>
            <span className="text-[11px] font-medium text-zinc-300">Memuat Kode QRIS dari Storage...</span>
          </div>
        ) : qrisSrc ? (
          <div className="p-2 bg-white rounded-2xl inline-block shadow-2xl border border-zinc-200 overflow-hidden w-full max-w-[260px]">
            <Image
              src={qrisSrc}
              alt={`QRIS ${tenant?.name || 'Tenant'}`}
              width={400}
              height={400}
              className="w-full h-auto object-cover rounded-xl mx-auto"
              unoptimized={qrisSrc.startsWith('data:')}
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
    if (!tenant?.addons || tenant.addons.length === 0) return null

    const selectedAddons = formData.selectedTenantAddons || []
    const selectedIds = formData.selectedAddonIds || []
    const hasAnyChecked = selectedAddons.length > 0

    const getAddonName = (addon: { name?: string; label?: string; addon_label?: string }) => {
      return addon?.name || addon?.label || addon?.addon_label || 'Addon'
    }

    const getAddonPrice = (price: number | string | null | undefined): number => {
      if (price === null || price === undefined) return 0
      if (typeof parsePrice === 'function') {
        return parsePrice(price)
      }
      const numericValue = typeof price === 'number' ? price : Number(price)
      return isNaN(numericValue) ? 0 : numericValue
    }

    return (
      <div 
        style={hasAnyChecked && theme?.inlineBorder ? theme.inlineBorder : undefined}
        className={`mt-4 border ${
          hasAnyChecked 
            ? `${theme?.accentBorder || 'border-purple-500'} shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)]` 
            : 'border-zinc-800/80'
        } rounded-2xl bg-zinc-950/70 overflow-hidden transition-all duration-300 shadow-2xl`}
      >
        <div
          onClick={() => setIsAddonExpanded(!isAddonExpanded)}
          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
        >
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              style={theme?.inlineStyle ? { accentColor: tenant.themeColor } : undefined}
              className={`w-4 h-4 rounded-md ${theme?.checkbox || ''} cursor-pointer`}
              checked={hasAnyChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (!e.target.checked) {
                  setFormData((prev) => ({ 
                    ...prev, 
                    selectedTenantAddons: [], 
                    selectedAddonIds: [] 
                  }))
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
                style={theme?.inlineBgLight && theme?.inlineText ? { ...theme.inlineBgLight, ...theme.inlineText } : undefined}
                className={`text-[10px] px-2.5 py-0.5 rounded-full ${theme?.accentBgLight || 'bg-purple-900/40'} ${theme?.accentText || 'text-purple-300'} font-bold border border-current/20`}
              >
                {selectedAddons.length} Dipilih
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
              const addonName = getAddonName(addon)
              const addonPrice = getAddonPrice(addon.price)
              const addonId = addon.id || index

              const isChecked = selectedAddons.some(
                (item) => item.label === addonName
              ) || selectedIds.includes(addonId)

              return (
                <div
                  key={addonId}
                  style={isChecked && theme?.inlineBgLight && theme?.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                  onClick={() => {
                    setFormData((prev) => {
                      const currentAddons = prev.selectedTenantAddons || []
                      const currentIds = prev.selectedAddonIds || []

                      if (isChecked) {
                        return {
                          ...prev,
                          selectedTenantAddons: currentAddons.filter((item) => item.label !== addonName),
                          selectedAddonIds: currentIds.filter((id) => id !== addonId)
                        }
                      } else {
                        return {
                          ...prev,
                          selectedTenantAddons: [
                            ...currentAddons, 
                            { label: addonName, name: addonName, price: addonPrice }
                          ],
                          selectedAddonIds: [...currentIds, addonId]
                        }
                      }
                    })
                  }}
                  className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex flex-col group ${
                    isChecked
                      ? `${theme.accentBgLight}${theme?.accentBorder || 'border-purple-500'} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]`
                      : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div 
                        style={isChecked && theme?.inlineStyle ? { background: tenant.themeColor } : undefined}
                        className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                          isChecked 
                            ? `${theme?.accentSolidBg || 'bg-purple-600'} border-white shadow-[0_0_12px_currentColor]` 
                            : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p 
                          style={isChecked && theme?.inlineText ? theme.inlineText : undefined} 
                          className={`text-xs font-bold transition-colors ${isChecked ? (theme?.accentText || 'text-purple-300') : 'text-zinc-200 group-hover:text-white'}`}
                        >
                          {addonName}
                        </p>
                        {(addon.desc || addon.description) && (
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                            {addon.desc || addon.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-zinc-200 bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-inner whitespace-nowrap ml-2">
                      +Rp {addonPrice.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {(addon.long_description || addon.desc || addon.image_url) && (
                    <button
                      type="button"
                      style={theme?.inlineText ? theme.inlineText : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (typeof setSelectedServiceDetail === 'function') {
                          setSelectedServiceDetail(addon)
                        }
                      }}
                      className={`mt-2.5 self-start inline-flex items-center space-x-1 text-[10px] font-bold ${theme?.accentText || 'text-purple-400'} hover:underline`}
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
  // 5.7 Main JSX Render
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

          {/* INDIKATOR STEP WIZARD */}
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
        </div>

        {/* FORM CONTENT */}
        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' && step < 3) {
              e.preventDefault()
            }
          }}
          className="p-6 space-y-5"
        >
          {/* STEP 1: PILIH LAYANAN & TERAPIS */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">
                  Langkah 1 dari 3: Pilih Layanan & Terapis
                </h2>
              </div>

              {/* PILIH STAFF / TERAPIS */}
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
                            const staffIdValue = String(st.id)
                            setFormData(prev => ({ 
                              ...prev, 
                              selected_staff: st.name || '', 
                              selected_staff_id: staffIdValue,
                              booking_time: '' 
                            }))
                          }}
                          className={`py-3 px-3.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-left ${
                            isSelected 
                              ? `${theme.accentBgLight}${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.3)] scale-[1.01]` 
                              : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          <p style={isSelected && theme.inlineText ? theme.inlineText : undefined} className={`text-sm font-bold ${isSelected ? theme.accentText : 'text-zinc-100'}`}>
                            {st.name}
                          </p>
                          <p className="text-[11px] text-zinc-300 font-medium mt-0.5">{st.role}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PILIH LAYANAN UTAMA */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Pilih Layanan Utama
                  </label>
                  {!tenant.enable_multi_service ? (
                    <span className="text-[10px] text-zinc-300 font-medium">*Pilih 1 layanan</span>
                  ) : (
                    <span style={theme.inlineText ? theme.inlineText : undefined} className={`text-[10px] ${theme.accentText} font-bold`}>
                      *Bisa pilih lebih dari 1
                    </span>
                  )}
                </div>

                {fetchingServices ? (
                  <p className="text-xs text-zinc-300 font-medium animate-pulse text-center py-6">Memuat layanan...</p>
                ) : mainServices.length === 0 ? (
                  <p className="text-xs text-zinc-300 font-medium text-center py-6">Belum ada layanan tersedia.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {mainServices.map((item) => {
                      const active = item.name ? formData.selected_services.includes(item.name) : false
                      return (
                        <div
                          key={item.id}
                          style={active && theme.inlineBgLight && theme.inlineBorder ? { ...theme.inlineBgLight, ...theme.inlineBorder } : undefined}
                          onClick={() => item.name && handleServiceSelect(item.name)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex flex-col group ${
                            active 
                              ? `${theme.accentBgLight}${theme.accentBorder} text-white shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.25)] scale-[1.01]` 
                              : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-3.5 pr-2">
                              <div 
                                style={active && theme.inlineStyle ? { borderColor: tenant.themeColor, backgroundColor: tenant.themeColor } : undefined}
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                                  active ? 'border-purple-500 bg-purple-500' : 'border-zinc-600 bg-transparent group-hover:border-zinc-500'
                                }`}
                              >
                                {active && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                              </div>

                              <div>
                                <p style={active && theme.inlineText ? theme.inlineText : undefined} className={`text-xs font-bold transition-colors ${active ? theme.accentText : 'text-zinc-100 group-hover:text-white'}`}>
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-zinc-300 font-medium mt-0.5 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs font-extrabold text-white bg-zinc-900/90 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-inner whitespace-nowrap shrink-0 ml-2">
                              Rp {parsePrice(item.price).toLocaleString('id-ID')}
                            </span>
                          </div>

                          {/* 🌟 DETAIL LAYANAN UTAMA */}
                          {(item.long_description || item.desc || item.image_url) && (
                            <button
                              type="button"
                              style={theme?.inlineText ? theme.inlineText : undefined}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedServiceDetail(item)
                              }}
                              className={`mt-2.5 self-start inline-flex items-center space-x-1 text-[10px] font-bold ${theme?.accentText || 'text-rose-400'} hover:underline`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Lihat Detail Layanan</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RENDER ADDONS */}
              {typeof renderAddonsSection === 'function' && renderAddonsSection()}

              {/* TOMBOL LANJUT STEP 2 */}
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-4 px-4 rounded-2xl font-extrabold text-xs text-black transition-all duration-300 mt-3 tracking-wider uppercase transform active:scale-[0.99] shadow-[0_4px_30px_rgba(var(--color-primary-rgb),0.5)]"
                style={{
                  ...(theme.inlineStyle || {}),
                  color: '#000000',
                }}
              >
                Lanjut Pilih Tanggal & Jam &rarr;
              </button>
            </div>
          )}

          {/* STEP 2: TANGGAL & JAM KEDATANGAN */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">
                Langkah 2 dari 3: Pilih Waktu Kedatangan
              </h2>

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
                      blockedDetails={blockedDetails} // PASS PROP INI
                      selectedTime={formData.booking_time}
                      onSelectTime={(time) => setFormData(prev => ({ ...prev, booking_time: time }))}
                      tenantData={tenant}
                      theme={theme}
                    />
                  )}
                </div>
              </div>

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
                  Lanjut Isi Data Diri &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DATA DIRI & KONFIRMASI PEMBAYARAN */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h2 className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-widest">
                Langkah 3 dari 3: Data Diri & Konfirmasi
              </h2>

              {/* INPUT NAMA LENGKAP */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama kamu"
                  className={`w-full px-4.5 py-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>

              {/* INPUT NOMOR WHATSAPP */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp
                </label>
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

              {/* JUMLAH ORANG / PASIEN */}
              {tenant?.enable_guest_count && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Jumlah Orang / Pasien
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: Number(tenant?.maxPersonPerBooking || 5) }, (_, i) => i + 1).map((num: number) => {
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

              {/* CATATAN KHUSUS */}
              {isNotesEnabled && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Catatan Khusus (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Keluhan / Model request"
                    className={`w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800/90 rounded-2xl text-zinc-100 placeholder-zinc-500 text-sm outline-none transition-all duration-300 ${theme.accentRing}`}
                    value={formData.custom_notes || ''}
                    onChange={(e) => setFormData({ ...formData, custom_notes: e.target.value })}
                  />
                </div>
              )}

              {/* TIPE PEMBAYARAN */}
              {tenant?.custom_payment_dp && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Tipe Pembayaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, payment_type: 'DP' }))}
                      style={formData.payment_type === 'DP' && theme?.inlineStyle ? theme.inlineStyle : undefined}
                      className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all duration-300 ${
                        formData.payment_type === 'DP'
                          ? `${theme?.accentBg || 'bg-rose-500'} !text-black border-white/30 shadow-lg scale-[1.02]`
                          : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      Uang Muka (DP)
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, payment_type: 'FULL' }))}
                      style={formData.payment_type === 'FULL' && theme?.inlineStyle ? theme.inlineStyle : undefined}
                      className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all duration-300 ${
                        formData.payment_type === 'FULL'
                          ? `${theme?.accentBg || 'bg-rose-500'} !text-black border-white/30 shadow-lg scale-[1.02]`
                          : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      Bayar Penuh (Lunas)
                    </button>
                  </div>
                </div>
              )}

              {/* PILIHAN OPSI PEMBAYARAN */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Pilih Opsi / Rekening Pembayaran
                </label>

                {availablePaymentMethods.length > 0 ? (
                  <div className="space-y-2">
                    {availablePaymentMethods.map((method) => {
                      const isSelected = formData.payment_method === method.id
                      return (
                        <div
                          key={method.id}
                          onClick={() => setFormData((prev) => ({ ...prev, payment_method: method.id }))}
                          style={isSelected && theme?.inlineStyle ? theme.inlineStyle : undefined}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 flex items-center justify-between ${
                            isSelected
                              ? `${theme?.accentBg || 'bg-rose-500'} !text-black border-white/30 shadow-lg`
                              : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className={`text-xs font-bold ${isSelected ? '!text-black' : 'text-zinc-200'}`}>
                              {method.title}
                            </p>

                            {method.detail && (
                              <p className={`text-[11px] font-mono ${isSelected ? 'text-black/80 font-semibold' : 'text-zinc-400'}`}>
                                {method.detail}
                              </p>
                            )}
                          </div>

                          {/* Indikator Radio */}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-black bg-black' : 'border-zinc-600'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center text-xs text-zinc-400">
                    Belum ada metode pembayaran yang dikonfigurasi.
                  </div>
                )}
              </div>

              {/* QRIS SECTION */}
              {formData.payment_method === 'QRIS' && renderQrisSection()}

              {/* RINGKASAN RESERVASI */}
              <div className="bg-zinc-950/70 border border-zinc-800/90 rounded-2xl p-4 space-y-3 shadow-2xl mt-3">
                <h3 className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-wider border-b border-zinc-800/80 pb-2.5">
                  Rincian Reservasi & Biaya
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Jadwal Kedatangan:</span>
                    <span className="text-zinc-100 font-semibold">
                      {formData.booking_date || '-'} ({formData.booking_time || '-'})
                    </span>
                  </div>

                  {formData.booking_date && formData.booking_time && (
                    <div className="flex justify-between items-center text-cyan-300 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/20">
                      <span>Estimasi Selesai:</span>
                      <span className="font-bold">
                        {getEndTime(formData.booking_time, totalDuration)} WIB ({totalDuration} menit)
                      </span>
                    </div>
                  )}

                  {formData.selected_staff && (
                    <div className="flex justify-between items-center text-zinc-400">
                      <span>Staff / Terapis:</span>
                      <span className="text-zinc-100 font-semibold">{formData.selected_staff}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start text-zinc-400">
                    <span>Layanan Utama:</span>
                    <span className="text-zinc-100 font-semibold text-right max-w-[60%]">
                      {Array.isArray(formData.selected_services) && formData.selected_services.length > 0
                        ? formData.selected_services.join(', ')
                        : '-'}
                    </span>
                  </div>

                  {formData.selectedTenantAddons && formData.selectedTenantAddons.length > 0 && (
                    <div className="flex justify-between items-start text-zinc-400">
                      <span>Add-ons:</span>
                      <span className="text-purple-300 font-semibold text-right max-w-[60%]">
                        {formData.selectedTenantAddons.map((a) => a.label).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-800/80 pt-2.5 space-y-1.5 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Total Biaya:</span>
                    <span className="text-sm font-extrabold text-purple-400">
                      Rp {typeof calculateTotal === 'function' ? calculateTotal().toLocaleString('id-ID') : '0'}
                    </span>
                  </div>

                  {formData.payment_type === 'DP' && (
                    <>
                      <div className="flex justify-between items-center text-xs text-amber-400">
                        <span>Wajib Bayar DP Sekarang:</span>
                        <span className="font-bold">Rp {dpAmount.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-zinc-400">
                        <span>Sisa Pelunasan di Lokasi:</span>
                        <span>Rp {remainingAmount.toLocaleString('id-ID')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* CHECKBOX PERSETUJUAN */}
              {(tenant?.custom_terms_text || tenant?.requireConsent) && (
                <div className="flex items-start space-x-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="has_consent"
                    checked={!!formData?.has_consent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, has_consent: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="has_consent" className="text-[11px] text-zinc-300 cursor-pointer select-none leading-tight">
                    {tenant?.custom_terms_text || 'Saya menyetujui syarat & ketentuan reservasi'}
                  </label>
                </div>
              )}

              {/* NAVIGASI & SUBMIT */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-zinc-900/90 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all duration-300 shadow-sm"
                >
                  &larr; Kembali
                </button>

                {(() => {
                  const isConsentMissing = Boolean(tenant?.custom_terms_text || tenant?.requireConsent) && !formData?.has_consent
                  const isDisabled = Boolean(loading || !formData?.payment_method || isConsentMissing)

                  return (
                    <button
                      type="submit"
                      disabled={isDisabled}
                      className={`w-2/3 font-extrabold py-3.5 rounded-2xl transition-all duration-300 shadow-xl text-xs flex items-center justify-center space-x-2 tracking-wider uppercase transform active:scale-[0.99] ${
                        isDisabled
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                          : ''
                      }`}
                      style={
                        isDisabled
                          ? undefined
                          : {
                              ...theme.inlineStyle,
                              color: '#000000',
                            }
                      }
                    >
                      {loading ? 'Memproses...' : 'Kirim Konfirmasi via WhatsApp'}
                    </button>
                  )
                })()}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* 🌟 MODAL POPUP DETAIL LAYANAN & ADD-ON */}
      {selectedServiceDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSelectedServiceDetail(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedServiceDetail(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs"
            >
              ✕
            </button>

            {'image_url' in selectedServiceDetail && selectedServiceDetail.image_url && (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-zinc-800">
                <Image
                  src={selectedServiceDetail.image_url}
                  alt={selectedServiceDetail.name || 'Detail Layanan'}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div>
              <h3 className="text-base font-bold text-white">
                {getServiceDisplayLabel(selectedServiceDetail)}
              </h3>
              <p className="text-xs font-extrabold text-rose-400 mt-1">
                Rp {parsePrice(selectedServiceDetail.price).toLocaleString('id-ID')}
                {'duration' in selectedServiceDetail && selectedServiceDetail.duration ? ` • ${selectedServiceDetail.duration} Menit` : ''}
              </p>
            </div>

            <div className="text-xs text-zinc-300 space-y-2 max-h-48 overflow-y-auto leading-relaxed pr-1">
              <p>{selectedServiceDetail.long_description || selectedServiceDetail.desc || selectedServiceDetail.description || 'Tidak ada deskripsi tambahan.'}</p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedServiceDetail(null)}
              className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </main>
  )
}