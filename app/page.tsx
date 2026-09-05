'use client'

export const dynamic = 'force-dynamic'

// ============================================================================
// 1. IMPORTS & DEPENDENCIES
// ============================================================================
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================================================
// 2. TYPE DEFINITIONS & INTERFACES
// ============================================================================
interface ServiceItem {
  id: number
  tenant_slug: string
  name: string
  price: string
  desc: string
  long_description?: string
  duration?: string
  image_url?: string
}

interface StaffItem {
  id: number
  tenant_slug: string
  name: string
  role: string
}

interface TenantData {
  clientCode: string
  tenantSlug: string
  name: string
  adminWa: string
  subscriptionPlan: 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
  category: string
  staffLabel: string
  layoutType: 'BASIC_SINGLE_PAGE' | 'STEP_WIZARD'
  themeColor: 'rose' | 'amber' | 'teal' | 'indigo' | 'emerald' | string
  requireConsent: boolean
  showExtraAddon: boolean
  addonLabel: string
  addonPrice: number
  dpType: 'FIXED' | 'PERCENTAGE'
  dpValue: number
  waGatewayUrl?: string
  waApiKey?: string
  qrisUrl?: string
  preventDoubleBooking: boolean
  hideBookedSlots: boolean
}

interface TimeSlot {
  time: string
  maxQuota: number
  bookedCount: number
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

// ============================================================================
// 4. MAIN BOOKING FORM COMPONENT
// ============================================================================
function BookingFormContent() {
  // --------------------------------------------------------------------------
  // 4.1 State Management (Steps & Tenant Configuration)
  // --------------------------------------------------------------------------
  const [step, setStep] = useState(1)

  const [tenant, setTenant] = useState<TenantData>({
    clientCode: '',
    tenantSlug: '',
    name: '',
    adminWa: '',
    subscriptionPlan: 'BASIC',
    category: '',
    staffLabel: 'Staff',
    layoutType: 'BASIC_SINGLE_PAGE',
    themeColor: 'rose',
    requireConsent: false,
    showExtraAddon: false,
    addonLabel: 'Perlu lepas eyelash lama (+Rp 30.000)',
    addonPrice: 30000,
    dpType: 'PERCENTAGE',
    dpValue: 50,
    waGatewayUrl: '',
    waApiKey: '',
    qrisUrl: '',
    preventDoubleBooking: true,
    hideBookedSlots: false
  })

  // --------------------------------------------------------------------------
  // 4.2 State Management (Services, Staff, Modal & Payments)
  // --------------------------------------------------------------------------
  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [fetchingServices, setFetchingServices] = useState(true)

  const [selectedServiceDetail, setSelectedServiceDetail] = useState<ServiceItem | null>(null)
  const [qrisData, setQrisData] = useState<{ qrUrl?: string; qrString?: string; snapToken?: string } | null>(null)
  const [loadingQris, setLoadingQris] = useState(false)

  // --------------------------------------------------------------------------
  // 4.3 State Management (Availability & Slots)
  // --------------------------------------------------------------------------
  const [blockedSlots, setBlockedSlots] = useState<{ block_date: string; block_time: string }[]>([])
  const [blockedTimes, setBlockedTimes] = useState<string[]>([])
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false)

  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([
    { time: '09:00', maxQuota: 1, bookedCount: 0 },
    { time: '10:00', maxQuota: 1, bookedCount: 0 },
    { time: '11:00', maxQuota: 1, bookedCount: 0 },
    { time: '13:00', maxQuota: 1, bookedCount: 0 },
    { time: '14:00', maxQuota: 1, bookedCount: 0 },
    { time: '15:00', maxQuota: 1, bookedCount: 0 },
    { time: '16:00', maxQuota: 1, bookedCount: 0 },
    { time: '17:00', maxQuota: 1, bookedCount: 0 },
    { time: '19:00', maxQuota: 1, bookedCount: 0 },
    { time: '20:00', maxQuota: 1, bookedCount: 0 }
  ])

  // --------------------------------------------------------------------------
  // 4.4 State Management (User Form Inputs)
  // --------------------------------------------------------------------------
  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    selected_services: [] as string[],
    selected_staff: '',
    payment_method: 'Cash / Bayar di Tempat',
    person_count: 1,
    payment_type: 'FULL',
    need_extra_addon: false,
    addon_person_count: 1,
    has_consent: false,
    custom_notes: ''
  })
  const [loading, setLoading] = useState(false)

  // --------------------------------------------------------------------------
  // 4.5 Derived Flags & Configurations
  // --------------------------------------------------------------------------
  const isWizard = tenant.layoutType === 'STEP_WIZARD'
  const isBasic = tenant.subscriptionPlan === 'BASIC'
  const isPremium = tenant.subscriptionPlan === 'PREMIUM'
  const isPro = tenant.subscriptionPlan === 'PROFESIONAL'

  // Dynamic Theme Styling Generator
  const getThemeClasses = (color: string) => {
    switch (color) {
      case 'rose':
        return {
          accentBg: 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-950/40',
          accentSolidBg: 'bg-rose-500',
          accentText: 'text-rose-400',
          accentBorder: 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
          accentBgLight: 'bg-rose-500/[0.08]',
          accentRing: 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20',
          iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
          checkbox: 'accent-rose-500'
        }
      case 'teal':
        return {
          accentBg: 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 shadow-teal-950/40',
          accentSolidBg: 'bg-teal-500',
          accentText: 'text-teal-400',
          accentBorder: 'border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]',
          accentBgLight: 'bg-teal-500/[0.08]',
          accentRing: 'focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20',
          iconBg: 'bg-teal-500/10 text-teal-400 border-teal-500/30 shadow-[0_0_20px_rgba(20,184,166,0.2)]',
          checkbox: 'accent-teal-500'
        }
      case 'indigo':
        return {
          accentBg: 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-indigo-950/40',
          accentSolidBg: 'bg-indigo-500',
          accentText: 'text-indigo-400',
          accentBorder: 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
          accentBgLight: 'bg-indigo-500/[0.08]',
          accentRing: 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
          iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]',
          checkbox: 'accent-indigo-500'
        }
      default:
        return {
          accentBg: 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 shadow-amber-950/40',
          accentSolidBg: 'bg-amber-500',
          accentText: 'text-amber-400',
          accentBorder: 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
          accentBgLight: 'bg-amber-500/[0.08]',
          accentRing: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
          iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
          checkbox: 'accent-amber-500'
        }
    }
  }

  const theme = getThemeClasses(tenant.themeColor)

  // --------------------------------------------------------------------------
  // 4.6 Calculations (Pricing, DP & Payment Methods)
  // --------------------------------------------------------------------------
  const parsePrice = (priceStr: string) => {
    const numeric = priceStr.replace(/[^0-9]/g, '')
    return numeric ? parseInt(numeric, 10) : 0
  }

  const calculateTotal = () => {
    let serviceTotal = services
      .filter((s) => formData.selected_services.includes(s.name))
      .reduce((sum, item) => sum + parsePrice(item.price), 0)

    if (!isBasic) {
      serviceTotal = serviceTotal * formData.person_count
    }

    const extraFee = (!isBasic && formData.need_extra_addon)
      ? tenant.addonPrice * formData.addon_person_count 
      : 0
    return serviceTotal + extraFee
  }

  const grandTotal = calculateTotal()

  const calculateDP = () => {
    if (isBasic) return grandTotal
    if (tenant.dpType === 'FIXED') {
      return tenant.dpValue > grandTotal ? grandTotal : tenant.dpValue
    }
    return Math.round(grandTotal * (tenant.dpValue / 100))
  }

  const dpAmount = calculateDP()
  const payableAmount = (!isBasic && formData.payment_type === 'DP') ? dpAmount : grandTotal
  const remainingAmount = grandTotal - payableAmount

  // Penyesuaian Metode Pembayaran Berdasarkan Tier Paket Langganan
  const getAvailablePaymentMethods = () => {
    if (isBasic) {
      return [
        { id: 'Cash / Bayar di Tempat', label: 'Cash / Bayar di Tempat' }
      ]
    }
    if (isPremium) {
      // Paket Premium: Dihapus opsi E-Wallet (hanya QRIS, Transfer BCA, dan Cash)
      return [
        { id: 'QRIS', label: 'QRIS Instan' },
        { id: 'Transfer BCA', label: 'Transfer BCA' },
        { id: 'Cash / Bayar di Tempat', label: 'Cash / Bayar di Tempat' }
      ]
    }
    // Paket Profesional: Lengkap dengan E-Wallet
    return [
      { id: 'QRIS', label: 'QRIS Instan' },
      { id: 'Transfer BCA', label: 'Transfer BCA' },
      { id: 'E-Wallet', label: 'E-Wallet' },
      { id: 'Cash / Bayar di Tempat', label: 'Cash / Bayar di Tempat' }
    ]
  }

  const availablePaymentMethods = getAvailablePaymentMethods()

  // --------------------------------------------------------------------------
  // 4.7 Effects: Load Tenant Data, Services, Staff & Initial Blocked Slots
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const searchParams = new URLSearchParams(window.location.search)
      const tenantQuery = searchParams.get('tenant')

      const rawSubdomain = hostname.split('.')[0].toLowerCase()
      const isLocal = rawSubdomain === 'localhost' || rawSubdomain.startsWith('127') || hostname.includes('localhost')

      let extractedSlug = rawSubdomain
      if (rawSubdomain.includes('fitrifeb')) {
        extractedSlug = 'fitrifeb-lashes'
      } else {
        extractedSlug = rawSubdomain.replace('-barbershop', '').replace('-dental', '').replace('-clinic', '')
      }

      const currentSlug = (tenantQuery || (isLocal ? 'fitrifeb-lashes' : extractedSlug)).trim().toLowerCase()

      const fetchTenantAndData = async () => {
        setFetchingServices(true)

        try {
          const { data: tenantData } = await supabase
            .from('Tenants')
            .select('*')
            .eq('tenant_slug', currentSlug)
            .maybeSingle()

          const dbPlan = ((tenantData?.subscription_plan || 'BASIC') as string).toUpperCase() as 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
          const rawCategory = tenantData?.category || 'Layanan'

          const defaultLayout = tenantData?.layout_type || (rawCategory.toLowerCase().includes('barber') ? 'BASIC_SINGLE_PAGE' : 'STEP_WIZARD')
          const defaultColor = tenantData?.theme_color || (rawCategory.toLowerCase().includes('barber') ? 'amber' : 'rose')

          const activeTenant: TenantData = {
            clientCode: tenantData?.client_code || currentSlug.toUpperCase(),
            tenantSlug: tenantData?.tenant_slug || currentSlug,
            name: tenantData?.business_name || tenantData?.name || currentSlug.toUpperCase(),
            adminWa: tenantData?.admin_wa || '',
            subscriptionPlan: dbPlan,
            category: rawCategory,
            staffLabel: tenantData?.staff_label || (rawCategory.toLowerCase().includes('barber') ? 'Capster' : 'Staff / Artist'),
            layoutType: defaultLayout,
            themeColor: defaultColor,
            requireConsent: tenantData?.require_consent ?? rawCategory.toLowerCase().includes('lash'),
            showExtraAddon: tenantData?.show_extra_addon ?? rawCategory.toLowerCase().includes('lash'),
            addonLabel: tenantData?.addon_label || 'Perlu lepas eyelash lama (+Rp 30.000)',
            addonPrice: tenantData?.addon_price || 30000,
            dpType: tenantData?.dp_type || 'PERCENTAGE',
            dpValue: tenantData?.dp_value ?? 50,
            waGatewayUrl: tenantData?.wa_gateway_url || '',
            waApiKey: tenantData?.wa_api_key || '',
            qrisUrl: tenantData?.qris_url || '',
            preventDoubleBooking: tenantData?.prevent_double_booking ?? true,
            hideBookedSlots: tenantData?.hide_booked_slots ?? false
          }

          setTenant(activeTenant)

          // Fetch Services
          const { data: serviceData } = await supabase
            .from('Services')
            .select('*')
            .eq('tenant_slug', activeTenant.tenantSlug)

          if (serviceData && serviceData.length > 0) {
            setServices(serviceData)
            setFormData((prev) => ({ ...prev, selected_services: [serviceData[0].name] }))
          } else {
            setServices([])
          }

          // Fetch Staff
          if (activeTenant.subscriptionPlan !== 'BASIC') {
            const { data: staffData } = await supabase
              .from('Staff')
              .select('*')
              .eq('tenant_slug', activeTenant.tenantSlug)
              .eq('is_active', true)

            if (staffData && staffData.length > 0) {
              setStaffList(staffData)
              setFormData((prev) => ({ ...prev, selected_staff: staffData[0].name }))
            } else {
              setStaffList([])
            }
          } else {
            // Paket BASIC: Dibatasi 1 Staff saja
            const { data: staffData } = await supabase
              .from('Staff')
              .select('*')
              .eq('tenant_slug', activeTenant.tenantSlug)
              .eq('is_active', true)
              .limit(1)

            if (staffData && staffData.length > 0) {
              setStaffList(staffData)
              setFormData((prev) => ({ ...prev, selected_staff: staffData[0].name }))
            } else {
              setStaffList([])
            }
          }

          // Fetch Blocked Slots
          const { data: blockedData, error: blockedErr } = await supabase
            .from('blocked_slots')
            .select('date, start_time')
            .eq('tenant_slug', activeTenant.tenantSlug)

          if (blockedErr) console.error("Error fetching blocked_slots:", blockedErr)

          const { data: confirmedReservations, error: resErr } = await supabase
            .from('Reservations')
            .select('booking_date, booking_time')
            .eq('tenant_slug', activeTenant.tenantSlug)
            .eq('status', 'confirmed')

          if (resErr) console.error("Error fetching Reservations:", resErr)

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
          console.error("Error fetching data:", err)
        } finally {
          setFetchingServices(false)
        }
      }

      fetchTenantAndData()
    }
  }, [])

  // --------------------------------------------------------------------------
  // 4.8 Effects: Dynamic Slot Availability Check
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!formData.booking_date || !tenant?.tenantSlug) return

    const fetchAvailability = async () => {
      setLoadingSlots(true)
      try {
        const res = await fetch(`/api/availability?date=${formData.booking_date}&tenant_slug=${tenant.tenantSlug}`)
        if (res.ok) {
          const data = await res.json()
          setBlockedTimes(data.blockedTimes || [])
          setBookedTimes(data.bookedTimes || [])
        } else {
          setBlockedTimes([])
          setBookedTimes([])
        }
      } catch (err) {
        console.error('Gagal memuat ketersediaan jam:', err)
        setBlockedTimes([])
        setBookedTimes([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchAvailability()
  }, [formData.booking_date, tenant?.tenantSlug])

  // --------------------------------------------------------------------------
  // 4.9 Effects: Generate Dynamic QRIS Payment (Khusus PREMIUM & PROFESIONAL)
  // --------------------------------------------------------------------------
  const generateDynamicQris = async () => {
    if (isBasic) return
    setLoadingQris(true)
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

      if (response.ok) {
        const resData = await response.json()
        setQrisData({ qrUrl: resData.qrUrl })
      } else {
        setQrisData(null)
      }
    } catch (err) {
      setQrisData(null)
    } finally {
      setLoadingQris(false)
    }
  }

  useEffect(() => {
    if (!isBasic && formData.payment_method === 'QRIS' && payableAmount > 0) {
      generateDynamicQris()
    }
  }, [formData.payment_method, payableAmount, tenant?.qrisUrl, isBasic])

  // --------------------------------------------------------------------------
  // 4.10 Form Handlers & Slot Logic
  // --------------------------------------------------------------------------
  const handleServiceSelect = (serviceName: string) => {
    if (isBasic) {
      // Paket BASIC: Hanya bisa 1 jenis layanan
      setFormData((prev) => ({ ...prev, selected_services: [serviceName] }))
    } else {
      // Paket PREMIUM & PROFESIONAL: Multi-services
      const exists = formData.selected_services.includes(serviceName)
      const updated = exists
        ? formData.selected_services.filter((s) => s !== serviceName)
        : [...formData.selected_services, serviceName]
      setFormData((prev) => ({ ...prev, selected_services: updated }))
    }
  }

  const isSlotBlocked = (date: string, time: string) => {
    // Paket Basic tidak menerapkan time-slot blocking
    if (isBasic) return false
    if (!date || !time) return false

    const isSupabaseBlocked = blockedSlots.some(
      (slot) => slot.block_date === date && slot.block_time === time
    )

    const isManualApiBlocked = blockedTimes.includes(time)

    return isSupabaseBlocked || isManualApiBlocked
  }

  const isTimeDisabled = (timeString: string, maxQuota: number, currentBookings: number) => {
    // Untuk Paket BASIC: Semua slot aktif/dapat dipilih (time-slot locking dimatikan)
    if (isBasic) return false

    if (isSlotBlocked(formData.booking_date, timeString)) return true

    if (tenant.preventDoubleBooking) {
      const isBooked = bookedTimes.includes(timeString)
      const isQuotaFull = currentBookings >= maxQuota
      if (isBooked || isQuotaFull) return true
    }

    if (formData.booking_date) {
      const selectedDate = new Date(formData.booking_date)
      const now = new Date()

      if (
        selectedDate.getFullYear() === now.getFullYear() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getDate() === now.getDate()
      ) {
        const [hours, minutes] = timeString.split(':').map(Number)
        const slotTime = new Date()
        slotTime.setHours(hours, minutes, 0, 0)

        if (slotTime < now) return true
      }
    }

    return false
  }

  // --------------------------------------------------------------------------
  // 4.11 Sub-component: TimePicker
  // --------------------------------------------------------------------------
  const TimePicker = ({
    availableSlots,
    selectedTime,
    onSelectTime
  }: {
    availableSlots: TimeSlot[]
    selectedTime: string
    onSelectTime: (time: string) => void
  }) => {
    const filteredSlots = availableSlots.filter((slot) => {
      if (isBasic) return true
      if (!tenant.hideBookedSlots) return true

      const isBooked = bookedTimes.includes(slot.time) || slot.bookedCount >= slot.maxQuota
      return !isBooked
    })

    return (
      <div className="grid grid-cols-3 gap-2 mt-2">
        {filteredSlots.map((slot) => {
          const disabled = isTimeDisabled(slot.time, slot.maxQuota, slot.bookedCount)
          const isSelected = selectedTime === slot.time
          const isBooked = !isBasic && (bookedTimes.includes(slot.time) || slot.bookedCount >= slot.maxQuota)

          return (
            <button
              key={slot.time}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTime(slot.time)}
              className={`py-2 px-3 rounded-2xl text-xs font-bold transition-all duration-300 border relative ${
                disabled
                  ? 'bg-zinc-950/40 text-zinc-600 border-zinc-800/50 cursor-not-allowed opacity-50'
                  : isSelected
                  ? `${theme.accentBg} text-white border-transparent shadow-md scale-105`
                  : 'bg-zinc-950/80 text-zinc-300 border-zinc-800/80 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <span>{slot.time}</span>
              {/* Teks pemberitahuan "Penuh" hanya tampil pada paket Premium & Profesional */}
              {isBooked && (
                <span className="block text-[9px] text-rose-400 font-normal">Penuh</span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Step Wizard Controls
  const handleNextStep = () => {
    if (step === 1) {
      if (!formData.customer_name || !formData.whatsapp_number) {
        alert('Mohon isi nama dan nomor WhatsApp!')
        return
      }
      if (tenant.requireConsent && !formData.has_consent) {
        alert('Mohon centang persetujuan terlebih dahulu.')
        return
      }
    }
    if (step === 2) {
      if (formData.selected_services.length === 0) {
        alert('Pilih minimal 1 layanan!')
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
    }
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handlePrevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  // --------------------------------------------------------------------------
  // 4.12 Submit Handler (Create Reservation & Trigger WhatsApp)
  // --------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (formData.selected_services.length === 0) {
      alert('Mohon pilih minimal 1 layanan!')
      setLoading(false)
      return
    }

    if (isSlotBlocked(formData.booking_date, formData.booking_time)) {
      alert('Maaf, slot waktu ini sudah dipesan. Silakan pilih jam atau tanggal lain.')
      setLoading(false)
      return
    }

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
      tenant_slug: tenant.tenantSlug
    }

    if (isWizard) {
      insertPayload.person_count = isBasic ? 1 : formData.person_count
      insertPayload.payment_type = isBasic ? 'FULL' : formData.payment_type
      insertPayload.need_remove_lash = !isBasic && formData.need_extra_addon
      insertPayload.addon_person_count = (!isBasic && formData.need_extra_addon) ? formData.addon_person_count : 0
      insertPayload.has_eye_allergy_consent = formData.has_consent
      insertPayload.eye_shape_notes = formData.custom_notes
    } else {
      insertPayload.payment_type = isBasic ? 'FULL' : formData.payment_type
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
        `• Layanan: ${formattedServicesText}\n`

      if (!isBasic) {
        messageText += `• Jumlah Orang: ${formData.person_count} Orang\n`
      }

      if (!isBasic && formData.need_extra_addon) {
        messageText += `• Tambahan: ${tenant.addonLabel.replace(/\s*\(\+Rp\s*[\d.]+\)/gi, '')} (${formData.addon_person_count} Orang)\n`
      }

      if (formData.selected_staff) {
        messageText += `• ${tenant.staffLabel}: ${formData.selected_staff}\n`
      }

      if (formData.custom_notes) {
        messageText += `• Catatan Khusus: ${formData.custom_notes}\n`
      }

      messageText += `\n💳 *RINCIAN PEMBAYARAN*\n` +
        `• Metode Bayar: ${formData.payment_method}\n` +
        `• Total Biaya: Rp ${grandTotal.toLocaleString('id-ID')}\n`

      if (!isBasic) {
        messageText += `• Nominal Dibayar (${formData.payment_type}): Rp ${payableAmount.toLocaleString('id-ID')}\n`
        if (formData.payment_type === 'DP') {
          messageText += `• Sisa Pelunasan: Rp ${remainingAmount.toLocaleString('id-ID')} (Dibayar di Lokasi)\n`
        }
      } else {
        messageText += `• Status Pembayaran: Menunggu Konfirmasi\n`
      }

      if (isPro) {
        messageText += `\n🧾 *LINK INVOICE & REKAP:* \n${invoiceUrl}\n`
      }

      messageText += `\n----------------------------------\nBerikut saya lampirkan bukti transfernya. Mohon dikonfirmasi ya, terima kasih!`

      if (isPro && tenant.waGatewayUrl) {
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

      const adminPhone = tenant.adminWa || '085899997828'
      const formattedPhone = formatWaNumber(adminPhone)

      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`
      window.open(waUrl, '_blank')
    } catch (err) {
      console.error("Error submitting reservation:", err)
      alert("Terjadi kesalahan saat memproses reservasi.")
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // 4.13 Sub-component: QRIS Section
  // --------------------------------------------------------------------------
  const renderQrisSection = () => {
    if (isBasic) return null

    const qrisSrc = qrisData?.qrUrl || tenant?.qrisUrl

    return (
      <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-center space-y-3 shadow-inner">
        <p className={`text-xs font-bold ${theme.accentText} tracking-wide`}>
          Scan QRIS Pembayaran (Rp {payableAmount.toLocaleString('id-ID')})
        </p>

        {loadingQris ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] text-zinc-500">Memuat Kode QRIS...</span>
          </div>
        ) : qrisSrc ? (
          <div className="p-1 bg-white rounded-2xl inline-block shadow-xl border border-zinc-200 overflow-hidden w-full max-w-[280px]">
            <img
              src={qrisSrc}
              onError={(e) => { 
                e.currentTarget.onerror = null
                console.error('Gagal memuat gambar dari URL:', qrisSrc)
              }}
              alt={`QRIS ${tenant?.name || 'Tenant'}`}
              className="w-full h-auto object-cover rounded-xl mx-auto"
            />
          </div>
        ) : (
          <div className="py-6 px-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-[11px] text-zinc-400">
            Gambar QRIS belum dikonfigurasi.
          </div>
        )}
        <p className="text-[10px] text-zinc-500">Dapat di-scan menggunakan BCA, GoPay, OVO, Dana, LinkAja, dll.</p>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // 4.14 Loading View
  // --------------------------------------------------------------------------
  if (fetchingServices) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">Memuat Halaman Reservasi...</p>
        </div>
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // 4.15 Main JSX Render Area
  // --------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#09090b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-zinc-100 flex items-center justify-center p-3 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl">
        
        {/* HEADER SECTION */}
        <div className="relative p-6 text-center bg-gradient-to-b from-zinc-800/40 via-zinc-900/60 to-zinc-900 border-b border-zinc-800/60">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 border ${theme.iconBg} backdrop-blur-md shadow-lg transform transition-transform hover:scale-105 duration-300`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-sm">{tenant.name}</h1>
          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] mt-1 ${theme.accentText}`}>{tenant.category}</p>

          {/* Step Indicator */}
          {isWizard && (
            <div className="flex items-center justify-center space-x-2 mt-5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                    step === s ? `w-10 ${theme.accentSolidBg} shadow-[0_0_12px_currentColor]` : 'w-2.5 bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* LAYOUT A: BASIC SINGLE PAGE */}
          {!isWizard && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama kamu"
                  className={`w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-100 placeholder-zinc-600 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nomor WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="08123456789"
                  className={`w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-100 placeholder-zinc-600 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Layanan</label>
                  {isBasic ? (
                    <span className="text-[10px] text-zinc-500">*Pilih 1 layanan</span>
                  ) : (
                    <span className={`text-[10px] ${theme.accentText} font-semibold`}>*Bisa pilih lebih dari 1</span>
                  )}
                </div>

                {fetchingServices ? (
                  <p className="text-xs text-zinc-500 animate-pulse text-center py-4">Memuat layanan...</p>
                ) : services.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Belum ada layanan tersedia.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {services.map((item) => {
                      const active = formData.selected_services.includes(item.name)
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleServiceSelect(item.name)}
                          className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex flex-col group ${
                            active 
                              ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-md` 
                              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-3">
                              {!isBasic && (
                                <div className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                                  active ? `${theme.accentSolidBg} border-white shadow-sm` : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                                }`}>
                                  {active && (
                                    <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              )}
                              <div>
                                <p className={`text-xs font-bold transition-colors ${active ? theme.accentText : 'text-zinc-200 group-hover:text-white'}`}>{item.name}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                              </div>
                            </div>
                            <span className="text-xs font-extrabold text-zinc-200 bg-zinc-900/90 px-2.5 py-1 rounded-xl border border-zinc-800 shadow-inner">
                              {item.price}
                            </span>
                          </div>

                          {isPro && (item.long_description || item.image_url) && (
                            <button
                              type="button"
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

              {staffList.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    {tenant.staffLabel} {isBasic ? '(Sesuai Ketersediaan)' : ''}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {staffList.map((st) => (
                      <button
                        type="button"
                        key={st.id}
                        disabled={isBasic}
                        onClick={() => setFormData({ ...formData, selected_staff: st.name })}
                        className={`py-2.5 px-3.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-left ${
                          formData.selected_staff === st.name 
                            ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder} shadow-sm` 
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                        }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal Kedatangan</label>
                  <input
                    type="date"
                    required
                    style={{ colorScheme: 'dark' }}
                    className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 [color-scheme:dark] ${theme.accentRing}`}
                    value={formData.booking_date}
                    onChange={(e) => setFormData({ ...formData, booking_date: e.target.value, booking_time: '' })}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Jam Kedatangan</label>
                    {loadingSlots && <span className="text-[10px] text-zinc-500 animate-pulse">Memuat ketersediaan...</span>}
                  </div>
                  
                  {!formData.booking_date ? (
                    <p className="text-[11px] text-zinc-500 italic p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl text-center">
                      Silakan pilih tanggal kedatangan terlebih dahulu.
                    </p>
                  ) : (
                    <TimePicker
                      availableSlots={availableSlots}
                      selectedTime={formData.booking_time}
                      onSelectTime={(time) => setFormData({ ...formData, booking_time: time })}
                    />
                  )}
                </div>
              </div>

              {!isBasic && (
                <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium">Total Estimasi</span>
                    <span className={`font-bold ${theme.accentText}`}>Rp {grandTotal.toLocaleString('id-ID')}</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Tipe Pembayaran</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['DP', 'FULL'].map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setFormData({ ...formData, payment_type: t })}
                          className={`py-2 px-2 text-xs rounded-2xl border transition-all duration-300 text-center ${
                            formData.payment_type === t 
                              ? `${theme.accentBg} text-white border-transparent font-bold shadow-md scale-[1.02]` 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-bold">
                            {t === 'DP' 
                              ? `DP (${tenant.dpType === 'PERCENTAGE' ? `${tenant.dpValue}%` : 'Tetap'})` 
                              : 'Full Payment'}
                          </div>
                          <div className="text-[10px] opacity-90 font-medium mt-0.5">
                            Rp {(t === 'DP' ? dpAmount : grandTotal).toLocaleString('id-ID')}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Metode Pembayaran</label>
                <div className={`grid ${isBasic ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                  {availablePaymentMethods.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setFormData({ ...formData, payment_method: m.id })}
                      className={`py-2.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-center ${
                        formData.payment_method === m.id 
                          ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder} shadow-sm` 
                          : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {!isBasic && formData.payment_method === 'QRIS' && renderQrisSection()}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 shadow-xl shadow-emerald-950/50 text-xs mt-4 tracking-wider uppercase transform active:scale-[0.99]"
              >
                {loading ? 'Memproses...' : 'Kirim Konfirmasi via WhatsApp'}
              </button>
            </div>
          )}

          {/* LAYOUT B: STEP WIZARD */}
          {isWizard && (
            <>
              {/* STEP 1: USER DATA */}
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Langkah 1 dari 3: Data Diri</h2>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama kamu"
                      className={`w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-100 placeholder-zinc-600 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Nomor WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="08123456789"
                      className={`w-full px-4 py-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-100 placeholder-zinc-600 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    />
                  </div>

                  {!isBasic && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Jumlah Orang / Pasien</label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            type="button"
                            key={num}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                person_count: num,
                                addon_person_count: prev.addon_person_count > num ? num : prev.addon_person_count
                              }))
                            }}
                            className={`py-2.5 text-xs font-bold rounded-2xl border transition-all duration-300 ${
                              formData.person_count === num
                                ? `${theme.accentBg} text-white border-transparent shadow-md scale-105`
                                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isBasic && tenant.showExtraAddon && (
                    <div className="space-y-2">
                      <label className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 ${
                        formData.need_extra_addon ? `${theme.accentBgLight} ${theme.accentBorder}` : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            className={`w-4.5 h-4.5 rounded-md ${theme.checkbox}`}
                            checked={formData.need_extra_addon}
                            onChange={(e) => setFormData({ ...formData, need_extra_addon: e.target.checked })}
                          />
                          <span className="text-xs text-zinc-200 font-medium">
                            {tenant.addonLabel.replace(/\s*\(\+Rp\s*[\d.]+\)/gi, '')}
                          </span>
                        </div>

                        {formData.need_extra_addon && (
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${theme.accentSolidBg} text-white shadow-sm transition-all animate-fadeIn`}>
                            +Rp {(tenant.addonPrice * formData.addon_person_count).toLocaleString('id-ID')}
                          </span>
                        )}
                      </label>

                      {formData.need_extra_addon && formData.person_count > 1 && (
                        <div className="p-3 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl space-y-2 animate-fadeIn">
                          <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Berapa orang yang memerlukan tambahan ini?
                          </label>
                          <div className="flex space-x-2">
                            {Array.from({ length: formData.person_count }, (_, i) => i + 1).map((cnt) => (
                              <button
                                type="button"
                                key={cnt}
                                onClick={() => setFormData({ ...formData, addon_person_count: cnt })}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all duration-300 ${
                                  formData.addon_person_count === cnt
                                    ? `${theme.accentBg} text-white border-transparent shadow-sm`
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                              >
                                {cnt} Orang
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Catatan Khusus (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Misal: Keluhan / Model request"
                      className={`w-full px-4 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                      value={formData.custom_notes}
                      onChange={(e) => setFormData({ ...formData, custom_notes: e.target.value })}
                    />
                  </div>

                  {tenant.requireConsent && (
                    <label className="flex items-start space-x-3 p-3.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl cursor-pointer">
                      <input 
                        type="checkbox" 
                        required
                        className={`w-4 h-4 rounded-md ${theme.checkbox} mt-0.5`}
                        checked={formData.has_consent}
                        onChange={(e) => setFormData({...formData, has_consent: e.target.checked})}
                      />
                      <span className="text-xs text-zinc-400 leading-relaxed font-medium">Saya menyetujui ketentuan dan konfirmasi tidak ada riwayat alergi medis terkait.</span>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white ${theme.accentBg} transition-all duration-300 shadow-lg mt-2 tracking-wider uppercase transform active:scale-[0.99]`}
                  >
                    Lanjut Pilih Layanan &rarr;
                  </button>
                </div>
              )}

              {/* STEP 2: SERVICES & SCHEDULE */}
              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Langkah 2 dari 3: Layanan & Jadwal</h2>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Layanan</label>
                      {isBasic ? (
                        <span className="text-[10px] text-zinc-500">*Pilih 1 layanan</span>
                      ) : (
                        <span className={`text-[10px] ${theme.accentText} font-semibold`}>*Bisa pilih lebih dari 1</span>
                      )}
                    </div>

                    {fetchingServices ? (
                      <p className="text-xs text-zinc-500 animate-pulse text-center py-4">Memuat layanan...</p>
                    ) : services.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">Belum ada layanan tersedia.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {services.map((item) => {
                          const active = formData.selected_services.includes(item.name)
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleServiceSelect(item.name)}
                              className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex flex-col group ${
                                active 
                                  ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-md` 
                                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-3">
                                  {!isBasic && (
                                    <div className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all duration-300 ${
                                      active ? `${theme.accentSolidBg} border-white shadow-sm` : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                                    }`}>
                                      {active && (
                                        <svg className="w-3 h-3 text-zinc-950 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div>
                                    <p className={`text-xs font-bold transition-colors ${active ? theme.accentText : 'text-zinc-200 group-hover:text-white'}`}>{item.name}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-extrabold text-zinc-200 bg-zinc-900/90 px-2.5 py-1 rounded-xl border border-zinc-800 shadow-inner">
                                  {item.price}
                                </span>
                              </div>

                              {isPro && (item.long_description || item.image_url) && (
                                <button
                                  type="button"
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

                  {staffList.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                        {tenant.staffLabel} {isBasic ? '(Sesuai Ketersediaan)' : ''}
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {staffList.map((st) => (
                          <button
                            type="button"
                            key={st.id}
                            disabled={isBasic}
                            onClick={() => setFormData({ ...formData, selected_staff: st.name })}
                            className={`py-2.5 px-3.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-left ${
                              formData.selected_staff === st.name 
                                ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder} shadow-sm` 
                                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                            }`}
                          >
                            {st.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal Kedatangan</label>
                      <input
                        type="date"
                        required
                        style={{ colorScheme: 'dark' }}
                        className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 [color-scheme:dark] ${theme.accentRing}`}
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value, booking_time: '' })}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Pilih Jam Kedatangan</label>
                        {loadingSlots && <span className="text-[10px] text-zinc-500 animate-pulse">Memuat ketersediaan...</span>}
                      </div>
                      
                      {!formData.booking_date ? (
                        <p className="text-[11px] text-zinc-500 italic p-3 bg-zinc-950/40 border border-zinc-800/50 rounded-2xl text-center">
                          Silakan pilih tanggal kedatangan terlebih dahulu.
                        </p>
                      ) : (
                        <TimePicker
                          availableSlots={availableSlots}
                          selectedTime={formData.booking_time}
                          onSelectTime={(time) => setFormData({ ...formData, booking_time: time })}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-all duration-300 shadow-sm"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className={`w-2/3 py-3.5 rounded-2xl font-bold text-xs text-white ${theme.accentBg} transition-all duration-300 shadow-lg tracking-wider uppercase`}
                    >
                      Lanjut Pembayaran &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT SUMMARY & SELECTION */}
              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Langkah 3 dari 3: Pembayaran</h2>

                  <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl space-y-2.5 text-xs shadow-inner">
                    <div className="flex justify-between text-zinc-400">
                      <span>Layanan {(!isBasic && formData.person_count > 1) ? `(${formData.person_count} Orang)` : ''}</span>
                      <span className="font-semibold text-zinc-200">Rp {(grandTotal - (!isBasic && formData.need_extra_addon ? tenant.addonPrice * formData.addon_person_count : 0)).toLocaleString('id-ID')}</span>
                    </div>

                    {!isBasic && formData.need_extra_addon && (
                      <div className="flex justify-between text-zinc-400">
                        <span>{tenant.addonLabel.replace(/\s*\(\+Rp\s*[\d.]+\)/gi, '')} ({formData.addon_person_count} Orang)</span>
                        <span className="font-semibold text-zinc-200">Rp {(tenant.addonPrice * formData.addon_person_count).toLocaleString('id-ID')}</span>
                      </div>
                    )}

                    <div className="border-t border-zinc-800/80 pt-2.5 flex justify-between font-bold text-white text-sm">
                      <span>Total Biaya</span>
                      <span className={theme.accentText}>Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {!isBasic && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {['DP', 'FULL'].map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setFormData({ ...formData, payment_type: t })}
                          className={`py-2.5 px-2 text-xs rounded-2xl border transition-all duration-300 text-center ${
                            formData.payment_type === t 
                              ? `${theme.accentBg} text-white border-transparent font-bold shadow-md scale-[1.02]` 
                              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-bold">
                            {t === 'DP' 
                              ? `DP (${tenant.dpType === 'PERCENTAGE' ? `${tenant.dpValue}%` : 'Tetap'})` 
                              : 'Full Payment'}
                          </div>
                          <div className="text-[10px] opacity-90 mt-0.5 font-medium">
                            Rp {(t === 'DP' ? dpAmount : grandTotal).toLocaleString('id-ID')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`grid ${isBasic ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                    {availablePaymentMethods.map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setFormData({ ...formData, payment_method: m.id })}
                        className={`py-2.5 text-xs font-semibold rounded-2xl border transition-all duration-300 text-center ${
                          formData.payment_method === m.id 
                            ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder} shadow-sm` 
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {!isBasic && formData.payment_method === 'QRIS' && renderQrisSection()}

                  <div className="flex space-x-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3.5 rounded-2xl font-bold text-xs bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 transition-all duration-300 shadow-sm"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 shadow-xl shadow-emerald-950/50 text-xs flex items-center justify-center space-x-2 tracking-wider uppercase transform active:scale-[0.99]"
                    >
                      {loading ? 'Memproses...' : 'Kirim Konfirmasi via WhatsApp'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </form>
      </div>

      {/* SERVICE DETAIL MODAL (KHUSUS PAKET PROFESIONAL) */}
      {isPro && selectedServiceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl relative">
            
            {selectedServiceDetail.image_url && (
              <div className="relative w-full h-48 bg-zinc-950">
                <img
                  src={selectedServiceDetail.image_url}
                  alt={selectedServiceDetail.name}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setSelectedServiceDetail(null)}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="p-5 space-y-3">
              {!selectedServiceDetail.image_url && (
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-bold text-white">{selectedServiceDetail.name}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceDetail(null)}
                    className="text-zinc-400 hover:text-white text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {selectedServiceDetail.image_url && (
                <h3 className="text-base font-bold text-white">{selectedServiceDetail.name}</h3>
              )}

              <div className="flex items-center space-x-2 text-xs">
                <span className={`font-extrabold ${theme.accentText}`}>
                  {selectedServiceDetail.price}
                </span>
                {selectedServiceDetail.duration && (
                  <span className="text-zinc-500">• Estimasi {selectedServiceDetail.duration}</span>
                )}
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                  {selectedServiceDetail.long_description || selectedServiceDetail.desc || 'Tidak ada deskripsi rinci.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedServiceDetail(null)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold text-white ${theme.accentBg} transition-all duration-300 mt-2`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ============================================================================
// 5. ROOT COMPONENT WITH SUSPENSE BOUNDARY
// ============================================================================
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">Loading...</div>}>
      <BookingFormContent />
    </Suspense>
  )
}