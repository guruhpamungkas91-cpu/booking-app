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
    payment_method: 'QRIS', // Default pembayaran
  })
  const [loading, setLoading] = useState(false)

  // Ganti dengan nomor WhatsApp Admin Bisnis (format 62)
  const ADMIN_WA_NUMBER = '6285899997828'

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

    // 2. Format Pesan WhatsApp dengan Branding M CUT Barbershop
    const message = encodeURIComponent(
      `Halo Admin *M CUT Barbershop*, saya mau konfirmasi reservasi:\n\n` +
      `📌 *Nama:* ${formData.customer_name}\n` +
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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-6">
        
        {/* HEADER BRANDING NAMA USAHA */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            M CUT
          </h1>
          <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">
            Barbershop
          </p>
          <p className="text-xs text-gray-500 pt-1">
            Form Reservasi Jadwal Potong
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
            <input
              type="text"
              required
              className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nomor WhatsApp</label>
            <input
              type="tel"
              required
              placeholder="08123456789"
              className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Pilih Layanan</label>
            <select
              className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
            >
              <option value="Potong Rambut">Potong Rambut</option>
              <option value="Coloring">Coloring</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal</label>
              <input
                type="date"
                required
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
                value={formData.booking_date}
                onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Jam</label>
              <input
                type="time"
                required
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
                value={formData.booking_time}
                onChange={(e) => setFormData({ ...formData, booking_time: e.target.value })}
              />
            </div>
          </div>

          {/* OPSI PEMBAYARAN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
            <select
              className="w-full p-2 border border-gray-300 rounded-md text-gray-800"
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            >
              <option value="QRIS">QRIS All Payment (GoPay/OVO/Dana/BCA/dll)</option>
              <option value="Transfer BCA">Transfer Bank BCA</option>
              <option value="Bayar di Tempat">Bayar di Tempat (Cash)</option>
            </select>
          </div>

          {/* DISPLAY TAMPILAN QRIS / NO REK */}
          {formData.payment_method === 'QRIS' && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center space-y-2">
              <p className="text-xs font-semibold text-gray-600">Scan QRIS di bawah ini untuk membayar:</p>
              <img
                src="/MCUT.png"
                alt="QRIS Code"
                className="w-full max-w-[240px] h-auto mx-auto border p-2 bg-white rounded-md shadow-sm object-contain"
              />
              <p className="text-xs text-gray-500">Silakan SS bukti bayar untuk dikirim ke WA Admin.</p>
            </div>
          )}

          {formData.payment_method === 'Transfer BCA' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-blue-900">Info Rekening BCA:</p>
              <p className="font-mono text-base font-bold text-gray-900">123-456-7890</p>
              <p className="text-xs text-gray-600">a.n. M CUT Barbershop</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition shadow-md"
          >
            {loading ? 'Memproses...' : 'Kirim & Lanjut Kirim Bukti WA'}
          </button>
        </form>
      </div>
    </main>
  )
}