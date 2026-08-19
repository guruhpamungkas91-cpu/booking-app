'use client'

'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from './lib/supabase' // Sesuaikan path jika menggunakan src/lib/supabase

export default function Home() {
  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    booking_date: '',
    booking_time: '',
    service_name: 'Potong Rambut',
  })
  const [loading, setLoading] = useState(false)

  // Ganti dengan nomor WhatsApp Admin Bisnis (pake format 62)
  const ADMIN_WA_NUMBER = '6281234567890' 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Simpan ke Database Supabase
    const { error } = await supabase.from('Reservations').insert([formData])

    if (error) {
      alert('Gagal membuat reservasi: ' + error.message)
      setLoading(false)
      return
    }

    // 2. Buat Format Pesan WhatsApp
    const message = `Halo Admin, saya mau konfirmasi reservasi:%0A` +
      `- *Nama:* ${formData.customer_name}%0A` +
      `- *Layanan:* ${formData.service_name}%0A` +
      `- *Tanggal:* ${formData.booking_date}%0A` +
      `- *Jam:* ${formData.booking_time}`

    // 3. Redirect Otomatis ke WhatsApp Admin
    const waUrl = `https://wa.me/${ADMIN_WA_NUMBER}?text=${message}`
    window.location.href = waUrl
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 text-center">
          Form Reservasi Online
        </h1>

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
              <option value="Hair Spa">Hair Spa</option>
              <option value="Coloring">Coloring</option>
            </select>
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition"
          >
            {loading ? 'Memproses...' : 'Kirim & Lanjut ke WA'}
          </button>
        </form>
      </div>
    </main>
  )
}