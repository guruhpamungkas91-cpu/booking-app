'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Tenant {
  id: string
  business_name: string
  tenant_slug: string
  prevent_double_booking: boolean
  enable_slot_blocking: boolean
  enable_auto_disable_time_slots: boolean
  hide_booked_slots: boolean
  auto_wa_reminder: boolean
  require_consent: boolean
  show_extra_addon: boolean
  is_system_maintenance?: boolean
  is_maintenance_mode?: boolean
  force_otp_verification?: boolean
  auto_lunch_break?: boolean
  custom_payment_dp?: boolean
  public_reviews?: boolean
  enable_multi_staff?: boolean
  enable_multi_service?: boolean
  financial_reports?: boolean
  custom_dashboard_theme?: boolean
  staff_performance?: boolean
  business_performance?: boolean // <-- 1. Tambahkan properti di sini
  layout_type?: string
  enable_guest_count?: boolean
}

interface FeatureToggleModalProps {
  tenant: Tenant
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedFeatures: any) => void
}

export default function FeatureToggleModal({ tenant, isOpen, onClose, onSuccess }: FeatureToggleModalProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const getInitialFeatures = () => ({
    is_system_maintenance: tenant.is_system_maintenance ?? false,
    is_maintenance_mode: tenant.is_maintenance_mode ?? false,
    force_otp_verification: tenant.force_otp_verification ?? false,
    auto_lunch_break: tenant.auto_lunch_break ?? false,
    custom_payment_dp: tenant.custom_payment_dp ?? false,
    public_reviews: tenant.public_reviews ?? false,
    enable_multi_staff: tenant.enable_multi_staff ?? false,
    enable_multi_service: tenant.enable_multi_service ?? false,
    financial_reports: tenant.financial_reports ?? false,
    custom_dashboard_theme: tenant.custom_dashboard_theme ?? false,
    prevent_double_booking: tenant.prevent_double_booking ?? true,
    enable_slot_blocking: tenant.enable_slot_blocking ?? false,
    enable_auto_disable_time_slots: tenant.enable_auto_disable_time_slots ?? false,
    hide_booked_slots: tenant.hide_booked_slots ?? false,
    auto_wa_reminder: tenant.auto_wa_reminder ?? false,
    require_consent: tenant.require_consent ?? false,
    show_extra_addon: tenant.show_extra_addon ?? false,
    staff_performance: tenant.staff_performance ?? true,
    business_performance: tenant.business_performance ?? true, // <-- 2. Set default value inisialisasi
    layout_type: tenant.layout_type || 'STEP_WIZARD',
    enable_guest_count: tenant.enable_guest_count ?? false,
  })

  const [initialFeatures, setInitialFeatures] = useState(getInitialFeatures)
  const [features, setFeatures] = useState(getInitialFeatures)

  if (!isOpen) return null

  const hasChanges = JSON.stringify(features) !== JSON.stringify(initialFeatures)

  const handleToggle = (key: keyof typeof features) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleCloseAttempt = () => {
    if (hasChanges) {
      setShowConfirmClose(true)
    } else {
      onClose()
    }
  }

  const handleSave = async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('tenants')
      .update(features)
      .eq('id', tenant.id)
      .select()

    setLoading(false)

    if (error) {
      console.error('DETAIL ERROR SUPABASE:', error)
      alert('Gagal menyimpan perubahan: ' + error.message)
    } else {
      onSuccess(data && data.length > 0 ? data[0] : features) 
      onClose()   
    }
  }

  // 3. Masukkan ke dalam daftar list fitur agar muncul di modal
  const allFeaturesList = [
    { key: 'custom_dashboard_theme', icon: '🎨', title: 'Tema Dashboard Admin Kustom', desc: 'Izinkan admin klien mengubah tema warna antarmuka dashboard mereka sendiri.' },
    { key: 'enable_multi_staff', icon: '👥', title: 'Multi-Staff / Staff Selection', desc: 'Izinkan customer memilih terapis/staff favorit saat melakukan booking.' },
    { key: 'enable_multi_service', icon: '🛒', title: 'Multi-Layanan (Pilih Lebih dari 1)', desc: 'Izinkan customer memilih beberapa layanan sekaligus dalam satu kali booking.' },
    { key: 'enable_guest_count', icon: '👥', title: 'Opsi Jumlah Orang / Pasien', desc: 'Tampilkan pilihan jumlah orang atau pasien pada form pemesanan customer.' },
    { key: 'require_consent', icon: '📝', title: 'Require Consent', desc: 'Wajibkan persetujuan syarat & ketentuan sebelum booking.' },
    { key: 'show_extra_addon', icon: '🎁', title: 'Show Extra Add-on', desc: 'Menampilkan opsi tambahan layanan ekstra saat pemesanan.' },
    { key: 'prevent_double_booking', icon: '🛡️', title: 'Prevent Double Booking', desc: 'Mencegah bentrok jadwal booking pada waktu yang sama.' },
    { key: 'enable_slot_blocking', icon: '🛑', title: 'Enable Slot Blocking', desc: 'Mengizinkan pemblokiran slot waktu tertentu secara manual.' },
    { key: 'enable_auto_disable_time_slots', icon: '⏳', title: 'Auto Disable Time Slots', desc: 'Menutup slot waktu otomatis jika sudah terisi penuh atau terlewat.' },
    { key: 'hide_booked_slots', icon: '👁️‍🗨️', title: 'Hide Booked Slots', desc: 'Menyembunyikan slot waktu yang sudah dibooking dari pandangan customer.' },
    { key: 'custom_payment_dp', icon: '💳', title: 'Custom Payment / DP Gateway', desc: 'Wajibkan pembayaran muka (DP) atau pelunasan online saat booking.' },
    { key: 'financial_reports', icon: '📊', title: 'Laporan Keuangan & Omzet (Bruto/Netto)', desc: 'Tampilkan modul laporan keuangan, omzet, dan export Excel/PDF di dashboard klien.' },
    { key: 'business_performance', icon: '📈', title: 'Business Performance / Grafik Omzet Bisnis', desc: 'Menampilkan modul grafik performa bisnis dan analitik omzet secara keseluruhan di dashboard.' }, // <-- Tambahan Fitur Baru
    { key: 'staff_performance', icon: '👑', title: 'Performa Staff & Grafik Transaksi', desc: 'Menampilkan modul grafik transaksi dan performa kerja staff di dashboard.' },
    { key: 'is_system_maintenance', icon: '⚠️', title: 'Maintenance Mode / Toko Tutup Sementara', desc: 'Jika diaktifkan, menu/toggle kontrol maintenance akan dimunculkan di dashboard admin tenant.' },
    { key: 'auto_lunch_break', icon: '🍱', title: 'Jam Istirahat Otomatis (Auto Lunch Break)', desc: 'Menutup slot waktu otomatis di jam istirahat staf/klinik.' },
    { key: 'auto_wa_reminder', icon: '💬', title: 'Auto WhatsApp Reminder', desc: 'Mengirim pengingat otomatis ke WhatsApp customer sebelum jadwal.' },
    { key: 'public_reviews', icon: '⭐', title: 'Review & Rating Publik', desc: 'Aktifkan ulasan dan rating kepuasan customer di halaman booking.' },
    { key: 'force_otp_verification', icon: '🔒', title: 'Force OTP Verification (WhatsApp)', desc: 'Wajibkan verifikasi nomor WhatsApp via OTP sebelum booking tersimpan.' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-black border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent z-10"></div>

        <div className="flex justify-between items-center p-6 border-b border-cyan-500/20 bg-black shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></span>
              Kelola Fitur & Layout Tenant
            </h3>
            <p className="text-xs text-cyan-300/80 font-mono mt-1">
              {tenant.business_name} <span className="text-slate-500">({tenant.tenant_slug})</span>
            </p>
          </div>
          <button type="button" onClick={handleCloseAttempt} className="text-slate-400 hover:text-cyan-300 transition-colors p-1.5 rounded-lg hover:bg-cyan-950/40 cursor-pointer">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto bg-black flex-1 divide-y divide-cyan-500/10">
          <div className="pb-4">
            <div className="bg-black border border-cyan-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(6,182,212,0.08)]">
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                Layout Halaman Booking Publik
              </label>
              <p className="text-xs text-slate-400 mb-3">Pilih tampilan antarmuka form pemesanan untuk customer.</p>
              <select
              value={features.layout_type}
              onChange={(e) => setFeatures({ ...features, layout_type: e.target.value })}
              className="w-full bg-black border border-cyan-500/40 rounded-xl px-4 py-2.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)] cursor-pointer"
            >
              <option value="STEP_WIZARD" className="bg-black text-white">Step Wizard (Bertahap per Langkah)</option>
              <option value="SINGLE_PAGE" className="bg-black text-white">Single Page (Satu Halaman Sekaligus)</option>
            </select>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            {allFeaturesList.map((item) => {
              const isActive = features[item.key as keyof typeof features] as boolean
              return (
                <div key={item.key} className="flex items-center justify-between p-3.5 rounded-xl bg-black border border-cyan-500/30 hover:border-cyan-500/60 transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <div>
                    <span className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                      <span>{item.icon}</span> {item.title}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5 block">{item.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(item.key as keyof typeof features)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer shrink-0 ml-3 ${
                      isActive ? 'bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                      isActive ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end items-center gap-3 p-6 border-t border-cyan-500/20 bg-black shrink-0">
          <button type="button" onClick={handleCloseAttempt} className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-black text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-500 transition-all cursor-pointer">
            Batal
          </button>
          <button type="button" disabled={loading} onClick={handleSave} className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-300 cursor-pointer transform hover:scale-105 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>

      {showConfirmClose && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-black border border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-[0_0_40px_rgba(6,182,212,0.2)] text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto text-lg font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              i
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Buang Perubahan?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Ada konfigurasi fitur yang belum tersimpan. Yakin ingin keluar tanpa menyimpan?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowConfirmClose(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-black text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                Lanjut Edit
              </button>
              <button type="button" onClick={() => { setShowConfirmClose(false); onClose(); }} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer">
                Ya, Buang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}