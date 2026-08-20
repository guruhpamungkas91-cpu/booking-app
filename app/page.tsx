'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Home() {
  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    service_name: 'Potong Rambut',
    payment_method: 'QRIS',
  })
  const [loading, setLoading] = useState(false)

  // Ganti dengan nomor WhatsApp Admin Bisnis (format 62)
  const ADMIN_WA_NUMBER = '6285899997828'

  const services = [
    { name: 'Potong Rambut', price: 'Rp 50.000', desc: 'Gunting + Styling + Washing' },
    { name: 'Coloring', price: 'Rp 120.000+', desc: 'Pewarnaan Rambut Premium' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Simpan data reservasi + metode pembayaran ke Supabase
    const { error } = await supabase.from('Reservations').insert([formData])

    if (error) {
      alert('Gagal membuat reservasi: ' + error.message)
      setLoading(false)
      return
    }

    // 2. Format Pesan WhatsApp dengan Branding M - CUT Barbershop
    const message = encodeURIComponent(
      `Halo Admin *M CUT Barbershop*, saya mau konfirmasi reservasi:\n\n` +
        `📌 *Nama:* ${formData.customer_name}\n` +
        `📞 *WA:* ${formData.whatsapp_number}\n` +
        `✂️ *Layanan:* ${formData.service_name}\n` +
        `📅 *Tanggal:* ${formData.booking_date}\n` +
        `⏰ *Jam:* ${formData.booking_time}\n` +
        `💳 *Metode Bayar:* ${formData.payment_method}\n\n` +
        `Mohon diproses ya, terima kasih!`
    )

    // 3. Redirect ke WA
    const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${message}`
    window.location.href = waUrl
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
        
        {/* BRANDING HEADER */}
        <div className="relative p-6 sm:p-8 text-center bg-gradient-to-b from-zinc-800/80 to-zinc-900 border-b border-zinc-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-3 border border-amber-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 0L4 4m5.121 5.121L4 14.121 border-amber-400" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-wider text-white uppercase">
            M CUT
          </h1>
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mt-0.5">
            Barbershop
          </p>
          <p className="text-xs text-zinc-400 mt-2">
            Pesan jadwal potong rambut kamu secara instan
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* INFORMASI DIRI */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              1. Data Diri
            </h2>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                placeholder="Masukkan nama kamu"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nomor WhatsApp
              </label>
              <input
                type="tel"
                required
                placeholder="08123456789"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
            </div>
          </div>

          {/* PILIH LAYANAN */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              2. Pilih Layanan
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              {services.map((item) => {
                const active = formData.service_name === item.name
                return (
                  <div
                    key={item.name}
                    onClick={() => setFormData({ ...formData, service_name: item.name })}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      active
                        ? 'bg-amber-500/10 border-amber-500/60 text-white'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${active ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                    </div>
                    <span className="text-xs font-bold text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/50">
                      {item.price}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* TANGGAL & JAM */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              3. Jadwal Kedatangan
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-xs"
                  value={formData.booking_date}
                  onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Jam
                </label>
                <input
                  type="time"
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-xs"
                  value={formData.booking_time}
                  onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* METODE PEMBAYARAN */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              4. Metode Pembayaran
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
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    {method.label}
                  </button>
                )
              })}
            </div>

            {/* DISPLAY QRIS - PERBAIKAN UKURAN & KEJELASAN */}
            {formData.payment_method === 'QRIS' && (
              <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl text-center space-y-4 mt-3 transition-all">
                <div>
                  <p className="text-sm font-semibold text-amber-400">
                    Scan QRIS untuk Pembayaran
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Bisa scan pakai GoPay, OVO, Dana, ShopeePay, atau Mobile Banking.
                  </p>
                </div>

                {/* CONTAINER QRIS DIPERBESAR */}
                <div className="p-4 bg-white rounded-2xl inline-block shadow-2xl border border-zinc-300">
                  <img
                    src="/MCUT.png"
                    alt="QRIS Code M-CUT Barbershop"
                    className="w-64 h-64 sm:w-72 sm:h-72 mx-auto object-contain image-render-crisp"
                  />
                </div>

                {/* CTA / INFO TAMBAHAN */}
                <div className="pt-1 flex flex-col items-center gap-2">
                  <a
                    href="/MCUT.png"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-amber-500 hover:text-amber-400 font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Klik untuk lihat ukuran penuh</span>
                  </a>

                  <p className="text-[11px] text-zinc-500">
                    *Silakan screenshot atau simpan bukti bayar untuk dikirim via WA.
                  </p>
                </div>
              </div>
)}

            {/* DISPLAY BCA */}
            {formData.payment_method === 'Transfer BCA' && (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-2 mt-3">
                <p className="text-xs text-zinc-400">Silakan Transfer ke Rekening BCA:</p>
                <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-mono font-bold text-amber-400 tracking-wider">123-456-7890</p>
                    <p className="text-xs text-zinc-400 mt-0.5">a.n. M CUT Barbershop</p>
                  </div>
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