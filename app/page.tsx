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
  duration?: number
  is_addon?: boolean
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
}

function BookingFormContent() {
  // Default Tenant Config (Fallback)
  const [tenant, setTenant] = useState<TenantData>({
    clientCode: 'MCUT',
    tenantSlug: 'mcut',
    name: 'MCUT Barbershop',
    adminWa: '6285899997828',
    subscriptionPlan: 'PREMIUM',
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
    // Opsi Tambahan Dinamis (Eyelash / Beauty)
    need_remove_lash: false,
    has_eye_allergy_consent: false,
    eye_shape_notes: ''
  })
  const [loading, setLoading] = useState(false)

  // 1. DENEFINISIKAN TEMA UTAMA BERDASARKAN KATEGORI USAHA
  const categoryLower = tenant.category.toLowerCase()
  const isBeauty = categoryLower.includes('eyelash') || categoryLower.includes('beauty') || categoryLower.includes('salon')

  const theme = {
    accentBg: isBeauty ? 'bg-rose-500' : 'bg-amber-500',
    accentText: isBeauty ? 'text-rose-400' : 'text-amber-500',
    accentBorder: isBeauty ? 'border-rose-500/60' : 'border-amber-500/60',
    accentBgLight: isBeauty ? 'bg-rose-500/10' : 'bg-amber-500/10',
    accentRing: isBeauty ? 'focus:border-rose-500 focus:ring-rose-500' : 'focus:border-amber-500 focus:ring-amber-500',
    iconBg: isBeauty ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      // Mengambil slug dari subdomain/host (misal: lash.domain.com atau mcut.domain.com)
      const currentSlug = hostname.split('.')[0] === 'localhost' ? 'mcut' : hostname.split('.')[0]

      const fetchTenantAndData = async () => {
        setFetchingServices(true)

        // Fetch Data Tenant
        const { data: tenantData } = await supabase
          .from('Tenants')
          .select('*')
          .eq('tenant_slug', currentSlug)
          .single()

        let activeTenant = tenant
        if (tenantData) {
          activeTenant = {
            clientCode: tenantData.client_code || 'FITRI',
            tenantSlug: tenantData.tenant_slug || currentSlug,
            name: tenantData.business_name || 'fitrifeb.eyelash', // <-- DIPERBAIKI: ganti tenantData.name jadi tenantData.business_name
            adminWa: tenantData.admin_wa || '6281234567890',
            subscriptionPlan: tenantData.subscription_plan || 'BASIC',
            category: tenantData.category || 'eyelash',
            staffLabel: tenantData.staff_label || 'Lash Artist'
        }
          setTenant(activeTenant)
      }

        // Fetch Layanan
        const { data: serviceData } = await supabase
          .from('Services')
          .select('*')
          .eq('tenant_slug', activeTenant.tenantSlug)

        if (serviceData && serviceData.length > 0) {
          setServices(serviceData)
          setFormData((prev) => ({ ...prev, selected_services: [serviceData[0].name] }))
        }

        // Fetch Staff (Jika Premium/Profesional)
        if (activeTenant.subscriptionPlan !== 'BASIC') {
          const { data: staffData } = await supabase
            .from('Staff')
            .select('*')
            .eq('tenant_slug', activeTenant.tenantSlug)
            .eq('is_active', true)

          if (staffData && staffData.length > 0) {
            setStaffList(staffData)
            setFormData((prev) => ({ ...prev, selected_staff: staffData[0].name }))
          }
        }

        setFetchingServices(false)
      }

      fetchTenantAndData()
    }
  }, [])

  const handleServiceSelect = (serviceName: string) => {
    if (tenant.subscriptionPlan === 'BASIC') {
      setFormData({ ...formData, selected_services: [serviceName] })
      return
    }

    setFormData((prev) => {
      const exists = prev.selected_services.includes(serviceName)
      if (exists) {
        if (prev.selected_services.length === 1) return prev
        return {
          ...prev,
          selected_services: prev.selected_services.filter((name) => name !== serviceName)
        }
      } else {
        return {
          ...prev,
          selected_services: [...prev.selected_services, serviceName]
        }
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.selected_services.length === 0) {
      alert('Pilih minimal 1 layanan!')
      return
    }

    setLoading(true)

    const formattedServicesText = formData.selected_services.join(', ')

    // Payload Insert ke Supabase Reservations
    const insertPayload: any = {
      customer_name: formData.customer_name,
      whatsapp_number: formData.whatsapp_number,
      booking_date: formData.booking_date,
      booking_time: formData.booking_time,
      service_name: formattedServicesText,
      staff_name: tenant.subscriptionPlan !== 'BASIC' ? formData.selected_staff : null,
      payment_method: formData.payment_method,
      status: 'pending',
      client_code: tenant.clientCode
    }

    // Jika usaha kategori beauty/eyelash, tambahkan field khusus
    if (isBeauty) {
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

    // Format Pesan WhatsApp
    let messageText =
      `Halo Admin *${tenant.name}*, saya mau konfirmasi reservasi:\n\n` +
      `📌 *Nama:* ${formData.customer_name}\n` +
      `📞 *WA:* ${formData.whatsapp_number}\n` +
      `✨ *Layanan:* ${formattedServicesText}\n`

    if (tenant.subscriptionPlan !== 'BASIC' && formData.selected_staff) {
      messageText += `👤 *${tenant.staffLabel}:* ${formData.selected_staff}\n`
    }

    messageText +=
      `📅 *Tanggal:* ${formData.booking_date}\n` +
      `⏰ *Jam:* ${formData.booking_time}\n`

    if (isBeauty) {
      messageText += `👁️ *Lepas Eyelash Lama:* ${formData.need_remove_lash ? 'Ya' : 'Tidak'}\n`
      if (formData.eye_shape_notes) {
        messageText += `📝 *Catatan Model:* ${formData.eye_shape_notes}\n`
      }
    }

    messageText += `💳 *Metode Bayar:* ${formData.payment_method}\n\nMohon diproses ya, terima kasih!`

    const waUrl = `https://wa.me/${tenant.adminWa}?text=${encodeURIComponent(messageText)}`
    window.location.href = waUrl
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* BRANDING HEADER */}
        <div className="relative p-6 sm:p-8 text-center bg-gradient-to-b from-zinc-800/80 to-zinc-900 border-b border-zinc-800">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 border ${theme.iconBg}`}>
            {isBeauty ? (
              // Icon Eyelash / Sparkle
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ) : (
              // Icon Gunting Barber
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 0L4 4m5.121 5.121L4 14.121" />
              </svg>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-wider text-white uppercase">
            {tenant.clientCode}
          </h1>
          <p className={`text-xs font-semibold uppercase tracking-widest mt-0.5 ${theme.accentText}`}>
            {tenant.category}
          </p>
          <p className="text-xs text-zinc-400 mt-2">
            Pesan jadwal secara instan
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* 1. DATA DIRI */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              1. Data Diri
            </h2>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nama Lengkap</label>
              <input
                type="text"
                required
                placeholder="Masukkan nama kamu"
                className={`w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all text-sm ${theme.accentRing}`}
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Nomor WhatsApp</label>
              <input
                type="tel"
                required
                placeholder="08123456789"
                className={`w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all text-sm ${theme.accentRing}`}
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
            </div>
          </div>

          {/* 2. PILIH LAYANAN */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                2. Pilih Layanan
              </h2>
              {tenant.subscriptionPlan !== 'BASIC' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${theme.accentBgLight} ${theme.accentText} border-zinc-700/50`}>
                  Bisa pilih lebih dari 1
                </span>
              )}
            </div>
            
            {fetchingServices ? (
              <p className="text-xs text-zinc-500 animate-pulse">Memuat layanan...</p>
            ) : services.length === 0 ? (
              <p className="text-xs text-zinc-500">Belum ada layanan tersedia.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {services.map((item) => {
                  const active = formData.selected_services.includes(item.name)
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleServiceSelect(item.name)}
                      className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        active
                          ? `${theme.accentBgLight} ${theme.accentBorder} text-white`
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          active ? `${theme.accentBg} border-white text-zinc-950` : 'border-zinc-700 bg-zinc-900'
                        }`}>
                          {active && (
                            <svg className="w-3.5 h-3.5 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        <div>
                          <p className={`text-sm font-semibold ${active ? theme.accentText : 'text-zinc-200'}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/50">
                        {item.price}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* OPSI TAMBAHAN KHUSUS EYELASH / BEAUTY */}
          {isBeauty && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Opsi Khusus Eyelash
              </h2>
              
              {/* Checkbox Lepas Eyelash */}
              <label className="flex items-center space-x-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded accent-rose-500"
                  checked={formData.need_remove_lash}
                  onChange={(e) => setFormData({...formData, need_remove_lash: e.target.checked})}
                />
                <span className="text-xs text-zinc-300">Perlu lepas eyelash lama dulu</span>
              </label>

              {/* Input Catatan Model Eye Shape */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Catatan Style (Opsional)</label>
                <input
                  type="text"
                  placeholder="Misal: Mau model Cat-Eye / Natural"
                  className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none text-xs ${theme.accentRing}`}
                  value={formData.eye_shape_notes}
                  onChange={(e) => setFormData({...formData, eye_shape_notes: e.target.value})}
                />
              </div>

              {/* Checkbox Consent Alergi (Wajib untuk Eyelash) */}
              <label className="flex items-start space-x-3 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl cursor-pointer">
                <input 
                  type="checkbox" 
                  required
                  className="w-4 h-4 rounded accent-rose-500 mt-0.5"
                  checked={formData.has_eye_allergy_consent}
                  onChange={(e) => setFormData({...formData, has_eye_allergy_consent: e.target.checked})}
                />
                <span className="text-xs text-zinc-400 leading-relaxed">
                  Saya mengonfirmasi tidak memiliki riwayat alergi mata / sensitivitas lem.
                </span>
              </label>
            </div>
          )}

          {/* 3. PILIH STAFF */}
          {tenant.subscriptionPlan !== 'BASIC' && staffList.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                3. Pilih {tenant.staffLabel}
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {staffList.map((staff) => {
                  const active = formData.selected_staff === staff.name
                  return (
                    <button
                      type="button"
                      key={staff.id}
                      onClick={() => setFormData({ ...formData, selected_staff: staff.name })}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        active
                          ? `${theme.accentBgLight} ${theme.accentBorder} text-white`
                          : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <p className={`text-xs font-semibold ${active ? theme.accentText : 'text-zinc-200'}`}>
                        {staff.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{staff.role}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. JADWAL KEDATANGAN */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {tenant.subscriptionPlan !== 'BASIC' ? '4.' : '3.'} Jadwal Kedatangan
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  required
                  className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none text-xs ${theme.accentRing}`}
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Jam</label>
                <input
                  type="time"
                  required
                  className={`w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none text-xs ${theme.accentRing}`}
                  value={formData.booking_time}
                  onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* 5. METODE PEMBAYARAN */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {tenant.subscriptionPlan !== 'BASIC' ? '5.' : '4.'} Metode Pembayaran
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'QRIS', label: 'QRIS All Pay' },
                { id: 'Transfer BCA', label: 'Bank BCA' },
                { id: 'Bayar di Tempat', label: 'Cash (Lokasi)' },
              ].map((method) => {
                const active = formData.payment_method === method.id
                return (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setFormData({ ...formData, payment_method: method.id })}
                    className={`py-2.5 px-2 text-xs font-semibold rounded-xl border transition-all text-center ${
                      active
                        ? `${theme.accentBg} text-zinc-950 border-white font-bold shadow-lg`
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {method.label}
                  </button>
                )
              })}
            </div>

            {/* QRIS DISPLAY */}
            {formData.payment_method === 'QRIS' && (
              <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl text-center space-y-4 mt-3">
                <div>
                  <p className={`text-sm font-semibold ${theme.accentText}`}>Scan QRIS untuk Pembayaran</p>
                  <p className="text-xs text-zinc-400 mt-1">Bisa scan pakai GoPay, OVO, Dana, ShopeePay, atau Bank.</p>
                </div>
                <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border border-zinc-300">
                  <img
                    src={`/${tenant.clientCode}.png`}
                    onError={(e) => { e.currentTarget.src = '/MCUT.png' }}
                    alt="QRIS Code"
                    className="w-64 h-64 sm:w-72 sm:h-72 mx-auto object-contain image-render-crisp"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 text-sm disabled:opacity-50 mt-4"
          >
            {loading ? (
              <span>Memproses...</span>
            ) : (
              <>
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                </svg>
                <span>Konfirmasi via WhatsApp</span>
              </>
            )}
          </button>

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