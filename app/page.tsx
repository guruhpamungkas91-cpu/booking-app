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
}

function BookingFormContent() {
  const [step, setStep] = useState(1)

  // FIX: Default diubah ke BASIC agar render awal langsung menyesuaikan paket BASIC
  const [tenant, setTenant] = useState<TenantData>({
    clientCode: 'MCUT',
    tenantSlug: 'mcut',
    name: 'MCUT',
    adminWa: '6285899997828',
    subscriptionPlan: 'BASIC',
    category: 'barbershop',
    staffLabel: 'Capster'
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
    need_remove_lash: false,
    has_eye_allergy_consent: false,
    eye_shape_notes: ''
  })
  const [loading, setLoading] = useState(false)

  const categoryLower = tenant.category.toLowerCase()
  const isBeauty = categoryLower.includes('eyelash') || categoryLower.includes('beauty') || categoryLower.includes('salon')
  const isBasic = tenant.subscriptionPlan === 'BASIC'

  const theme = {
    accentBg: isBeauty ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600',
    accentText: isBeauty ? 'text-rose-400' : 'text-amber-500',
    accentBorder: isBeauty ? 'border-rose-500/60' : 'border-amber-500/60',
    accentBgLight: isBeauty ? 'bg-rose-500/10' : 'bg-amber-500/10',
    accentRing: isBeauty ? 'focus:border-rose-500 focus:ring-rose-500' : 'focus:border-amber-500 focus:ring-amber-500',
    iconBg: isBeauty ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  }

  useEffect(() => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const searchParams = new URLSearchParams(window.location.search)
    const tenantQuery = searchParams.get('tenant')

    const rawSubdomain = hostname.split('.')[0]
    
    // Normalisasi slug: jika 'fitrifeb-lashes' atau 'mcut-barbershop', ambil kata utamanya 'fitrifeb' / 'mcut'
    const extractedSlug = rawSubdomain
      .replace('-barbershop', '')
      .replace('-lashes', '')

    const currentSlug = tenantQuery || (rawSubdomain === 'localhost' ? 'mcut' : extractedSlug)

    const fetchTenantAndData = async () => {
      setFetchingServices(true)
      
      // 1. Ambil data tenant dari Supabase
      const { data: tenantData } = await supabase
        .from('Tenants')
        .select('*')
        .eq('tenant_slug', currentSlug)
        .single()

      // 2. Format Plan & Default Data
      const dbPlan = (tenantData?.subscription_plan || 'BASIC').toUpperCase() as 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
      
      // Cek apakah ini Eyelash berdasarkan slug atau category DB
      const isEyelashSlug = currentSlug.includes('fitri')
      
      const activeTenant: TenantData = {
        clientCode: tenantData?.client_code || (isEyelashSlug ? 'FITRI' : 'MCUT'),
        tenantSlug: tenantData?.tenant_slug || currentSlug,
        name: tenantData?.business_name || tenantData?.name || (isEyelashSlug ? 'Fitri Lash Studio' : 'MCUT Barber'),
        adminWa: tenantData?.admin_wa || '6285899997828',
        subscriptionPlan: dbPlan,
        category: tenantData?.category || (isEyelashSlug ? 'eyelash' : 'barbershop'),
        staffLabel: tenantData?.staff_label || (isEyelashSlug ? 'Lash Artist' : 'Capster')
      }

      // Update state Tenant
      setTenant(activeTenant)

      // 3. Fetch Services
      const { data: serviceData } = await supabase
        .from('Services')
        .select('*')
        .eq('tenant_slug', activeTenant.tenantSlug)

      if (serviceData && serviceData.length > 0) {
        setServices(serviceData)
        setFormData((prev) => ({ ...prev, selected_services: [serviceData[0].name] }))
      }

      // 4. Fetch Staff jika paket NON-BASIC
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
        setStaffList([])
        setFormData((prev) => ({ ...prev, selected_staff: '' }))
      }

      setFetchingServices(false)
    }

    fetchTenantAndData()
  }
}, [])

  const handleServiceSelect = (serviceName: string) => {
    // FIX: Jika BASIC, selalu override menjadi 1 item saja (tidak bisa multi-select / toggle kosong)
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
      if (isBeauty && !formData.has_eye_allergy_consent) {
        alert('Mohon centang persetujuan bebas alergi mata.')
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
      client_code: tenant.clientCode
    }

    if (isBeauty) {
      insertPayload.person_count = formData.person_count
      insertPayload.payment_type = formData.payment_type
      insertPayload.need_remove_lash = formData.need_remove_lash
      insertPayload.has_eye_allergy_consent = formData.has_eye_allergy_consent
      insertPayload.eye_shape_notes = formData.eye_shape_notes
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

    if (isBeauty) messageText += `👥 *Jumlah Orang:* ${formData.person_count} Orang\n`
    messageText += `✨ *Layanan:* ${formattedServicesText}\n`
    if (!isBasic && formData.selected_staff) {
      messageText += `👤 *${tenant.staffLabel}:* ${formData.selected_staff}\n`
    }
    messageText += `📅 *Tanggal:* ${formData.booking_date}\n⏰ *Jam:* ${formData.booking_time}\n`

    if (isBeauty) {
      messageText += `👁️ *Lepas Eyelash Lama:* ${formData.need_remove_lash ? 'Ya' : 'Tidak'}\n`
      if (formData.eye_shape_notes) messageText += `📝 *Catatan Model:* ${formData.eye_shape_notes}\n`
      messageText += `💵 *Opsi Bayar:* ${formData.payment_type === 'DP' ? 'Down Payment (DP)' : 'Pelunasan Full'}\n`
    }
    messageText += `💳 *Metode Bayar:* ${formData.payment_method}\n\nMohon diproses ya, terima kasih!`

    window.location.href = `https://wa.me/${tenant.adminWa}?text=${encodeURIComponent(messageText)}`
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-3 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* BRANDING HEADER */}
        <div className="relative p-5 text-center bg-gradient-to-b from-zinc-800/80 to-zinc-900 border-b border-zinc-800">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 border ${theme.iconBg}`}>
            {isBeauty ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 0L5 5m4.121 4.121L5 19" />
                <circle cx="6" cy="6" r="2" strokeWidth={2} />
                <circle cx="6" cy="18" r="2" strokeWidth={2} />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-wider text-white uppercase">{tenant.name}</h1>
          <p className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 ${theme.accentText}`}>{tenant.category}</p>

          {isBeauty && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step === s ? `w-8 ${theme.accentBg}` : 'w-3 bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* ==================== TAMPILAN 1: BARBER (SINGLE PAGE UTUH) ==================== */}
          {!isBeauty && (
            <div className="space-y-4">
              {/* DATA DIRI */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama kamu"
                  className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 text-xs outline-none ${theme.accentRing}`}
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="08123456789"
                  className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 text-xs outline-none ${theme.accentRing}`}
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>

              {/* LAYANAN */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-zinc-300">Pilih Layanan</label>
                  {isBasic ? (
                    <span className="text-[10px] text-zinc-500">*Pilih 1 layanan</span>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-medium">*Bisa pilih lebih dari 1</span>
                  )}
                </div>

                {fetchingServices ? (
                  <p className="text-xs text-zinc-500 animate-pulse">Memuat layanan...</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {services.map((item) => {
                      const active = formData.selected_services.includes(item.name)
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleServiceSelect(item.name)}
                          className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                            active ? `${theme.accentBgLight} ${theme.accentBorder} text-white` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            {!isBasic && (
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                active ? `${theme.accentBg} border-white` : 'border-zinc-700 bg-zinc-900'
                              }`}>
                                {active && (
                                  <svg className="w-3 h-3 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div>
                              <p className={`text-xs font-semibold ${active ? theme.accentText : 'text-zinc-200'}`}>{item.name}</p>
                              <p className="text-[10px] text-zinc-500">{item.desc}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">{item.price}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* STAFF (KHUSUS PAKET NON-BASIC) */}
              {!isBasic && staffList.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Pilih {tenant.staffLabel}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {staffList.map((st) => (
                      <button
                        type="button"
                        key={st.id}
                        onClick={() => setFormData({ ...formData, selected_staff: st.name })}
                        className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-left ${
                          formData.selected_staff === st.name ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder}` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* JADWAL */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    className={`w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs outline-none ${theme.accentRing}`}
                    value={formData.booking_date}
                    onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Jam</label>
                  <input
                    type="time"
                    required
                    className={`w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs outline-none ${theme.accentRing}`}
                    value={formData.booking_time}
                    onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                  />
                </div>
              </div>

              {/* METODE PEMBAYARAN */}
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                {[
                  { id: 'QRIS', label: 'QRIS' },
                  { id: 'Transfer BCA', label: 'BCA' },
                  { id: 'Bayar di Tempat', label: 'Cash' },
                ].map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setFormData({ ...formData, payment_method: m.id })}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                      formData.payment_method === m.id ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder}` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {formData.payment_method === 'QRIS' && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center space-y-2">
                  <p className={`text-xs font-semibold ${theme.accentText}`}>Scan QRIS Pembayaran</p>
                  <div className="p-2 bg-white rounded-xl inline-block shadow-md">
                    <img
                      src={`/${tenant.tenantSlug}.png`}
                      onError={(e) => { e.currentTarget.src = '/fitrifeb.png' }}
                      alt="QRIS Code"
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-xs mt-4"
              >
                {loading ? 'Memproses...' : 'Konfirmasi via WA'}
              </button>
            </div>
          )}

          {/* ==================== TAMPILAN 2: EYELASH / BEAUTY (3-STEP WIZARD) ==================== */}
          {isBeauty && (
            <>
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Langkah 1 dari 3: Data Diri</h2>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama kamu"
                      className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 text-xs outline-none ${theme.accentRing}`}
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Nomor WhatsApp</label>
                    <input
                      type="tel"
                      required
                      placeholder="08123456789"
                      className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 text-xs outline-none ${theme.accentRing}`}
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Jumlah Orang</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          type="button"
                          key={num}
                          onClick={() => setFormData({ ...formData, person_count: num })}
                          className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                            formData.person_count === num
                              ? `${theme.accentBg} text-zinc-950 border-white font-bold`
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Catatan Style (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Misal: Cat-Eye / Natural"
                      className={`w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs outline-none ${theme.accentRing}`}
                      value={formData.eye_shape_notes}
                      onChange={(e) => setFormData({ ...formData, eye_shape_notes: e.target.value })}
                    />
                  </div>

                  <label className="flex items-center space-x-2.5 p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded accent-rose-500"
                      checked={formData.need_remove_lash}
                      onChange={(e) => setFormData({...formData, need_remove_lash: e.target.checked})}
                    />
                    <span className="text-xs text-zinc-300">Perlu lepas eyelash lama dulu</span>
                  </label>

                  <label className="flex items-start space-x-2.5 p-3 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer">
                    <input 
                      type="checkbox" 
                      required
                      className="w-4 h-4 rounded accent-rose-500 mt-0.5"
                      checked={formData.has_eye_allergy_consent}
                      onChange={(e) => setFormData({...formData, has_eye_allergy_consent: e.target.checked})}
                    />
                    <span className="text-xs text-zinc-400 leading-tight">Saya konfirmasi tidak ada alergi mata/sensitivitas lem.</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs text-zinc-950 ${theme.accentBg} transition-all mt-2`}
                  >
                    Lanjut Pilih Layanan &rarr;
                  </button>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Langkah 2 dari 3: Layanan & Jadwal</h2>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-medium text-zinc-300">Pilih Layanan</label>
                      {isBasic ? (
                        <span className="text-[10px] text-zinc-500">*Pilih 1 layanan</span>
                      ) : (
                        <span className="text-[10px] text-rose-400 font-medium">*Bisa pilih lebih dari 1</span>
                      )}
                    </div>

                    {fetchingServices ? (
                      <p className="text-xs text-zinc-500 animate-pulse">Memuat layanan...</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {services.map((item) => {
                          const active = formData.selected_services.includes(item.name)
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleServiceSelect(item.name)}
                              className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                                active ? `${theme.accentBgLight} ${theme.accentBorder} text-white` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                {!isBasic && (
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    active ? `${theme.accentBg} border-white` : 'border-zinc-700 bg-zinc-900'
                                  }`}>
                                    {active && (
                                      <svg className="w-3 h-3 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div>
                                  <p className={`text-xs font-semibold ${active ? theme.accentText : 'text-zinc-200'}`}>{item.name}</p>
                                  <p className="text-[10px] text-zinc-500">{item.desc}</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">{item.price}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* STAFF (KHUSUS PAKET NON-BASIC) */}
                  {!isBasic && staffList.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Pilih {tenant.staffLabel}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {staffList.map((st) => (
                          <button
                            type="button"
                            key={st.id}
                            onClick={() => setFormData({ ...formData, selected_staff: st.name })}
                            className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-left ${
                              formData.selected_staff === st.name ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder}` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                            }`}
                          >
                            {st.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Tanggal</label>
                      <input
                        type="date"
                        required
                        className={`w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs outline-none ${theme.accentRing}`}
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Jam</label>
                      <input
                        type="time"
                        required
                        className={`w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs outline-none ${theme.accentRing}`}
                        value={formData.booking_time}
                        onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3 rounded-xl font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className={`w-2/3 py-3 rounded-xl font-bold text-xs text-zinc-950 ${theme.accentBg} transition-all`}
                    >
                      Lanjut Pembayaran &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Langkah 3 dari 3: Pembayaran</h2>

                  <div className="grid grid-cols-2 gap-2">
                    {['DP', 'FULL'].map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setFormData({ ...formData, payment_type: t })}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                          formData.payment_type === t ? `${theme.accentBg} text-zinc-950 border-white font-bold` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {t === 'DP' ? 'DP (Uang Muka)' : 'Full Payment'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'QRIS', label: 'QRIS' },
                      { id: 'Transfer BCA', label: 'BCA' },
                      { id: 'Bayar di Tempat', label: 'Cash' },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setFormData({ ...formData, payment_method: m.id })}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                          formData.payment_method === m.id ? `${theme.accentBgLight} ${theme.accentText} ${theme.accentBorder}` : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {formData.payment_method === 'QRIS' && (
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center space-y-2">
                      <p className={`text-xs font-semibold ${theme.accentText}`}>Scan QRIS Pembayaran</p>
                      <div className="p-2 bg-white rounded-xl inline-block shadow-md">
                        <img
                          src={`/${tenant.tenantSlug}.png`}
                          onError={(e) => { e.currentTarget.src = '/fitrifeb.png' }}
                          alt="QRIS Code"
                          className="w-44 h-44 object-contain mx-auto"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="w-1/3 py-3 rounded-xl font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
                    >
                      &larr; Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg text-xs flex items-center justify-center space-x-1.5"
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
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Loading...</div>}>
      <BookingFormContent />
    </Suspense>
  )
}