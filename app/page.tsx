'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from './lib/supabase'

interface ServiceItem {
  id: number
  tenant_slug: string
  name: string
  price: string
  desc: string
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
}

function BookingFormContent() {
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
    themeColor: 'amber',
    requireConsent: false,
    showExtraAddon: false,
    addonLabel: 'Perlu lepas eyelash lama (+Rp 30.000)',
    addonPrice: 30000
  })

  const [services, setServices] = useState<ServiceItem[]>([])
  const [staffList, setStaffList] = useState<StaffItem[]>([])
  const [fetchingServices, setFetchingServices] = useState(true)

  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    selected_services: [] as string[],
    selected_staff: '',
    payment_method: 'QRIS',
    person_count: 1,
    payment_type: 'DP',
    need_extra_addon: false,
    addon_person_count: 1,
    has_consent: false,
    custom_notes: ''
  })
  const [loading, setLoading] = useState(false)

  const isWizard = tenant.layoutType === 'STEP_WIZARD'
  const isBasic = tenant.subscriptionPlan === 'BASIC'

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

  const parsePrice = (priceStr: string) => {
    const numeric = priceStr.replace(/[^0-9]/g, '')
    return numeric ? parseInt(numeric, 10) : 0
  }

  const calculateTotal = () => {
    let serviceTotal = services
      .filter((s) => formData.selected_services.includes(s.name))
      .reduce((sum, item) => sum + parsePrice(item.price), 0)

    if (isWizard && !isBasic) {
      serviceTotal = serviceTotal * formData.person_count
    }

    const extraFee = isWizard && formData.need_extra_addon 
      ? tenant.addonPrice * formData.addon_person_count 
      : 0
    return serviceTotal + extraFee
  }

  const grandTotal = calculateTotal()
  const dpAmount = Math.round(grandTotal * 0.5)
  const payableAmount = formData.payment_type === 'DP' ? dpAmount : grandTotal

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const searchParams = new URLSearchParams(window.location.search)
      const tenantQuery = searchParams.get('tenant')

      const rawSubdomain = hostname.split('.')[0]
      const extractedSlug = rawSubdomain.replace('-barbershop', '').replace('-lashes', '').replace('-dental', '')
      const currentSlug = tenantQuery || (rawSubdomain === 'localhost' ? '' : extractedSlug)

      if (!currentSlug && !rawSubdomain) {
        setFetchingServices(false)
        return
      }

      const fetchTenantAndData = async () => {
        setFetchingServices(true)
        
        const { data: tenantData } = await supabase
          .from('Tenants')
          .select('*')
          .or(`tenant_slug.eq.${currentSlug},tenant_slug.eq.${rawSubdomain},domain.ilike.%${hostname}%`)
          .maybeSingle()

        const dbPlan = ((tenantData?.subscription_plan || 'BASIC') as string).toUpperCase() as 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
        const rawCategory = tenantData?.category || 'Layanan'

        const defaultLayout = tenantData?.layout_type || (rawCategory.toLowerCase().includes('lash') ? 'STEP_WIZARD' : 'BASIC_SINGLE_PAGE')
        const defaultColor = tenantData?.theme_color || (rawCategory.toLowerCase().includes('lash') ? 'rose' : 'amber')
        const defaultConsent = tenantData?.require_consent ?? rawCategory.toLowerCase().includes('lash')
        const defaultShowAddon = tenantData?.show_extra_addon ?? rawCategory.toLowerCase().includes('lash')

        const activeTenant: TenantData = {
          clientCode: tenantData?.client_code || currentSlug.toUpperCase(),
          tenantSlug: tenantData?.tenant_slug || rawSubdomain || currentSlug,
          name: tenantData?.business_name || tenantData?.name || currentSlug.toUpperCase(),
          adminWa: tenantData?.admin_wa || '',
          subscriptionPlan: dbPlan,
          category: rawCategory,
          staffLabel: tenantData?.staff_label || 'Staff / Spesialis',
          layoutType: defaultLayout,
          themeColor: defaultColor,
          requireConsent: defaultConsent,
          showExtraAddon: defaultShowAddon,
          addonLabel: tenantData?.addon_label || 'Perlu lepas eyelash lama (+Rp 30.000)',
          addonPrice: tenantData?.addon_price || 30000
        }

        setTenant(activeTenant)

        const { data: serviceData } = await supabase
          .from('Services')
          .select('*')
          .or(`tenant_slug.eq.${activeTenant.tenantSlug},tenant_slug.eq.${rawSubdomain},tenant_slug.eq.${currentSlug}`)

        if (serviceData && serviceData.length > 0) {
          setServices(serviceData)
          setFormData((prev) => ({ ...prev, selected_services: [serviceData[0].name] }))
        } else {
          setServices([])
        }

        if (activeTenant.subscriptionPlan !== 'BASIC') {
          const { data: staffData } = await supabase
            .from('Staff')
            .select('*')
            .or(`tenant_slug.eq.${activeTenant.tenantSlug},tenant_slug.eq.${rawSubdomain},tenant_slug.eq.${currentSlug}`)
            .eq('is_active', true)

          if (staffData && staffData.length > 0) {
            setStaffList(staffData)
            setFormData((prev) => ({ ...prev, selected_staff: staffData[0].name }))
          } else {
            setStaffList([])
          }
        } else {
          setStaffList([])
          setFormData((prev) => ({ ...prev, selected_staff: '' }))
        }

        setFetchingServices(false)
      }

      fetchTenantAndData()
    }
  }, [])

  const handleServiceSelect = (serviceName: string) => {
    if (isBasic) {
      setFormData((prev) => ({ ...prev, selected_services: [serviceName] }))
    } else {
      const exists = formData.selected_services.includes(serviceName)
      const updated = exists
        ? formData.selected_services.filter((s) => s !== serviceName)
        : [...formData.selected_services, serviceName]
      setFormData((prev) => ({ ...prev, selected_services: updated }))
    }
  }

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
    }
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const handlePrevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const formattedServicesText = formData.selected_services.join(', ')

    const insertPayload: any = {
      customer_name: formData.customer_name,
      whatsapp_number: formData.whatsapp_number,
      booking_date: formData.booking_date,
      booking_time: formData.booking_time,
      service_name: formattedServicesText,
      staff_name: !isBasic ? formData.selected_staff : null,
      payment_method: formData.payment_method,
      status: 'pending',
      client_code: tenant.clientCode,
      tenant_slug: tenant.tenantSlug
    }

    if (isWizard) {
      insertPayload.person_count = formData.person_count
      insertPayload.payment_type = formData.payment_type
      insertPayload.need_remove_lash = formData.need_extra_addon
      insertPayload.addon_person_count = formData.need_extra_addon ? formData.addon_person_count : 0
      insertPayload.has_eye_allergy_consent = formData.has_consent
      insertPayload.eye_shape_notes = formData.custom_notes
    }

    const { error } = await supabase.from('Reservations').insert([insertPayload])

    if (error) {
      alert('Gagal membuat reservasi: ' + error.message)
      setLoading(false)
      return
    }

    let messageText =
      `Halo Admin *${tenant.name}*, saya mau konfirmasi reservasi:\n\n` +
      `📌 *Nama:* ${formData.customer_name}\n` +
      `📞 *WA:* ${formData.whatsapp_number}\n`

    if (isWizard && !isBasic) messageText += `👥 *Jumlah Orang/Pasien:* ${formData.person_count} Orang\n`
    messageText += `✨ *Layanan:* ${formattedServicesText}\n`
    
    if (formData.need_extra_addon) {
      messageText += `✨ *Tambahan:* ${tenant.addonLabel.replace(/\s*\(\+Rp\s*[\d.]+\)/gi, '')} (${formData.addon_person_count} Orang)\n`
    }

    if (!isBasic && formData.selected_staff) {
      messageText += `👤 *${tenant.staffLabel}:* ${formData.selected_staff}\n`
    }
    messageText += `📅 *Tanggal:* ${formData.booking_date}\n⏰ *Jam:* ${formData.booking_time}\n`

    if (isWizard) {
      if (formData.custom_notes) messageText += `📝 *Catatan Khusus:* ${formData.custom_notes}\n`
      messageText += `💵 *Opsi Bayar:* ${formData.payment_type === 'DP' ? 'Down Payment (DP 50%)' : 'Pelunasan Full'}\n`
      messageText += `💰 *Total Bayar:* Rp ${payableAmount.toLocaleString('id-ID')} (${formData.payment_type})\n`
    }
    messageText += `💳 *Metode Bayar:* ${formData.payment_method}\n\nMohon diproses ya, terima kasih 😊`

    window.location.href = `https://wa.me/${tenant.adminWa}?text=${encodeURIComponent(messageText)}`
  }

  if (fetchingServices && !tenant.category) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">Memuat Halaman Reservasi...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#09090b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] text-zinc-100 flex items-center justify-center p-3 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800/80 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl">
        
        {/* HEADER */}
        <div className="relative p-6 text-center bg-gradient-to-b from-zinc-800/40 via-zinc-900/60 to-zinc-900 border-b border-zinc-800/60">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 border ${theme.iconBg} backdrop-blur-md shadow-lg transform transition-transform hover:scale-105 duration-300`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase drop-shadow-sm">{tenant.name}</h1>
          <p className={`text-[11px] font-bold uppercase tracking-[0.2em] mt-1 ${theme.accentText}`}>{tenant.category}</p>

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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* LAYOUT 1: SINGLE PAGE */}
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
                  <p className="text-xs text-zinc-500 animate-pulse text-center py-4">Memuat layanan profesional...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {services.map((item) => {
                      const active = formData.selected_services.includes(item.name)
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleServiceSelect(item.name)}
                          className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                            active 
                              ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-md` 
                              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                          }`}
                        >
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
                      )
                    })}
                  </div>
                )}
              </div>

              {!isBasic && staffList.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Pilih {tenant.staffLabel}</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {staffList.map((st) => (
                      <button
                        type="button"
                        key={st.id}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    required
                    className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                    value={formData.booking_date}
                    onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Jam</label>
                  <input
                    type="time"
                    required
                    className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                    value={formData.booking_time}
                    onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'QRIS', label: 'QRIS' },
                  { id: 'Transfer BCA', label: 'BCA' },
                  { id: 'Bayar di Tempat', label: 'Cash' },
                ].map((m) => (
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

              {formData.payment_method === 'QRIS' && (
                <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-center space-y-3 shadow-inner">
                  <p className={`text-xs font-bold ${theme.accentText} tracking-wide`}>Scan QRIS Pembayaran</p>
                  <div className="p-3 bg-white rounded-2xl inline-block shadow-xl border border-zinc-200">
                    <img
                      src={`/${tenant.tenantSlug}.png`}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                      alt="QRIS Code"
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 shadow-xl shadow-emerald-950/50 text-xs mt-4 tracking-wider uppercase transform active:scale-[0.99]"
              >
                {loading ? 'Memproses...' : 'Konfirmasi via WA'}
              </button>
            </div>
          )}

          {/* LAYOUT 2: STEP WIZARD */}
          {isWizard && (
            <>
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

                  {tenant.showExtraAddon && (
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

                      {/* OPSI JUMLAH ORANG LEPAS EYELASH */}
                      {formData.need_extra_addon && formData.person_count > 1 && (
                        <div className="p-3 bg-zinc-950/90 border border-zinc-800/80 rounded-2xl space-y-2 animate-fadeIn">
                          <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Berapa orang yang perlu lepas eyelash?
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
                      <p className="text-xs text-zinc-500 animate-pulse text-center py-4">Memuat layanan profesional...</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {services.map((item) => {
                          const active = formData.selected_services.includes(item.name)
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleServiceSelect(item.name)}
                              className={`cursor-pointer p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                                active 
                                  ? `${theme.accentBgLight} ${theme.accentBorder} text-white shadow-md` 
                                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-950'
                              }`}
                            >
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
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {!isBasic && staffList.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Pilih {tenant.staffLabel}</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {staffList.map((st) => (
                          <button
                            type="button"
                            key={st.id}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Tanggal</label>
                      <input
                        type="date"
                        required
                        className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Jam</label>
                      <input
                        type="time"
                        required
                        className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-zinc-200 text-xs outline-none transition-all duration-300 ${theme.accentRing}`}
                        value={formData.booking_time}
                        onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                      />
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

              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Langkah 3 dari 3: Pembayaran</h2>

                  <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl space-y-2.5 text-xs shadow-inner">
                    <div className="flex justify-between text-zinc-400">
                      <span>Layanan {(!isBasic && formData.person_count > 1) ? `(${formData.person_count} Orang)` : ''}</span>
                      <span className="font-semibold text-zinc-200">Rp {(grandTotal - (formData.need_extra_addon ? tenant.addonPrice * formData.addon_person_count : 0)).toLocaleString('id-ID')}</span>
                    </div>

                    {formData.need_extra_addon && (
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
                        <div className="font-bold">{t === 'DP' ? 'DP (50%)' : 'Full Payment'}</div>
                        <div className="text-[10px] opacity-90 mt-0.5 font-medium">
                          Rp {(t === 'DP' ? dpAmount : grandTotal).toLocaleString('id-ID')}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'QRIS', label: 'QRIS' },
                      { id: 'Transfer BCA', label: 'BCA' },
                      { id: 'Bayar di Tempat', label: 'Cash' },
                    ].map((m) => (
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

                  {formData.payment_method === 'QRIS' && (
                    <div className="p-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl text-center space-y-3 shadow-inner">
                      <p className={`text-xs font-bold ${theme.accentText} tracking-wide`}>
                        Scan QRIS (Rp {payableAmount.toLocaleString('id-ID')})
                      </p>
                      <div className="p-3 bg-white rounded-2xl inline-block shadow-xl border border-zinc-200">
                        <img
                          src={`/${tenant.tenantSlug}.png`}
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                          alt="QRIS Code"
                          className="w-44 h-44 object-contain mx-auto"
                        />
                      </div>
                    </div>
                  )}

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
                      {loading ? 'Memproses...' : 'Konfirmasi via WA'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </form>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">Loading...</div>}>
      <BookingFormContent />
    </Suspense>
  )
}