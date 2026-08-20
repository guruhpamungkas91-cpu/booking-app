'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Service {
  id: string
  name: string
  price: number
  duration: string
  description: string
  popular?: boolean
}

const SERVICES: Service[] = [
  {
    id: 'haircut',
    name: 'Gentleman Haircut',
    price: 50000,
    duration: '30 mnt',
    description: 'Potong rambut + Styling Pomade + Pijat Ringan',
    popular: true,
  },
  {
    id: 'beard',
    name: 'Haircut & Beard Trim',
    price: 75000,
    duration: '45 mnt',
    description: 'Potong rambut + Cukur kumis & jenggot rapi + Handuk Hangat',
  },
  {
    id: 'coloring',
    name: 'Hair Coloring / Hair Dye',
    price: 120000,
    duration: '90 mnt',
    description: 'Pewarnaan rambut profesional (Hitam/Fashion Color)',
  },
  {
    id: 'kids',
    name: 'Junior Cut (Anak-anak)',
    price: 40000,
    duration: '20 mnt',
    description: 'Potong rambut ramah anak',
  },
]

const TIME_SLOTS = [
  '10:00', '11:00', '13:00', '14:00', 
  '15:00', '16:00', '17:00', '19:00', '20:00'
]

export default function BookingPage() {
  const [selectedService, setSelectedService] = useState<Service>(SERVICES[0])
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'Cash / Tunai'>('QRIS')
  const [loading, setLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Format ke Rupiah
  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(number)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingDate || !bookingTime || !customerName || !whatsappNumber) {
      alert('Mohon lengkapi semua data reservasi!')
      return
    }

    setLoading(true)

    // Simpan ke Supabase Database
    const { error } = await supabase.from('Reservations').insert([
      {
        customer_name: customerName,
        whatsapp_number: whatsappNumber,
        service_name: selectedService.name,
        booking_date: bookingDate,
        booking_time: bookingTime,
        payment_method: paymentMethod,
        status: 'pending',
      },
    ])

    setLoading(false)

    if (error) {
      alert('Gagal membuat reservasi: ' + error.message)
    } else {
      setIsSuccess(true)
      
      // Auto Redirect / Link WhatsApp Notifikasi
      const waAdminNumber = '6285899997828' // 👈 Ganti nomor WA Barbershop kamu
      const textMessage = `Halo Admin M CUT BARBERSHOP! ✂️%0A%0ASaya ingin konfirmasi reservasi:%0A👤 *Nama:* ${customerName}%0A📱 *WA:* ${whatsappNumber}%0A💈 *Layanan:* ${selectedService.name}%0A📅 *Tanggal:* ${bookingDate}%0A⏰ *Jam:* ${bookingTime}%0A💳 *Metode Bayar:* ${paymentMethod}%0A💰 *Total:* ${formatRupiah(selectedService.price)}%0A%0AMohon konfirmasinya ya bro, terima kasih!`
      
      setTimeout(() => {
        window.open(`https://wa.me/${waAdminNumber}?text=${textMessage}`, '_blank')
      }, 1500)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl border border-emerald-500/20">
            ✓
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Reservasi Berhasil!</h2>
            <p className="text-sm text-neutral-400">
              Data kamu sudah terdaftar. Kamu akan dihubungkan ke WhatsApp Admin untuk konfirmasi akhir.
            </p>
          </div>
          <div className="bg-neutral-800/50 p-4 rounded-xl text-left space-y-2 text-xs border border-neutral-800">
            <p><span className="text-neutral-500">Nama:</span> <strong className="text-white">{customerName}</strong></p>
            <p><span className="text-neutral-500">Layanan:</span> <strong className="text-white">{selectedService.name}</strong></p>
            <p><span className="text-neutral-500">Jadwal:</span> <strong className="text-white">{bookingDate} @ {bookingTime} WIB</strong></p>
            <p><span className="text-neutral-500">Metode Bayar:</span> <strong className="text-white">{paymentMethod}</strong></p>
          </div>
          <button
            onClick={() => setIsSuccess(false)}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-3 rounded-xl text-sm transition"
          >
            Buat Reservasi Baru
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans pb-32">
      {/* 1. HERO HEADER BRANDING */}
      <div className="bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 border-b border-neutral-800 pt-8 pb-10 px-4">
        <div className="max-w-lg mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-400 text-xs font-semibold">
            💈 Premium Barbershop & Grooming
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            M CUT BARBERSHOP
          </h1>
          <p className="text-xs text-neutral-400 flex items-center justify-center gap-1">
            📍 Jl. Raya Jakarta No. 12 • <span className="text-emerald-400 font-medium">● Buka (10:00 - 21:00)</span>
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-8">
        
        {/* 2. PILIH LAYANAN (INTERACTIVE CARDS) */}
        <section className="space-y-3">
          <div className="flex justify-between items-end">
            <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">
              1. Pilih Layanan
            </h2>
            <span className="text-xs text-neutral-500">Wajib pilih 1</span>
          </div>

          <div className="grid gap-3">
            {SERVICES.map((service) => {
              const isSelected = selectedService.id === service.id
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-900 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-500/5'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {service.popular && (
                    <span className="absolute -top-2.5 right-4 bg-amber-500 text-neutral-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                      Paling Laris
                    </span>
                  )}
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-white text-base">{service.name}</h3>
                    <span className="font-bold text-amber-400 text-sm">
                      {formatRupiah(service.price)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-2 leading-relaxed">
                    {service.description}
                  </p>
                  <span className="inline-block text-[11px] bg-neutral-800 text-neutral-400 px-2.5 py-0.5 rounded-md font-medium">
                    ⏱️ {service.duration}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* 3. TANGGAL & JAM BOOKING */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">
            2. Tanggal & Jam Kedatangan
          </h2>

          <div>
            <label className="block text-xs text-neutral-400 mb-1.5 font-medium">Pilih Tanggal</label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 color-scheme-dark"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-2 font-medium">Pilih Jam Tersedia</label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((time) => {
                const isSelected = bookingTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setBookingTime(time)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 border-amber-500'
                        : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    ⏰ {time}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* 4. DATA DIRI PELANGGAN */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">
            3. Informasi Kontak
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-medium">Nama Lengkap</label>
              <input
                type="text"
                placeholder="Contoh: Bro Alex"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-400 mb-1 font-medium">Nomor WhatsApp</label>
              <input
                type="tel"
                placeholder="Contoh: 08123456789"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </section>

        {/* 5. METODE PEMBAYARAN & DISPLAY QRIS */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-neutral-300 uppercase tracking-wider">
            4. Metode Pembayaran
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setPaymentMethod('QRIS')}
              className={`p-3 rounded-xl border text-center cursor-pointer transition ${
                paymentMethod === 'QRIS'
                  ? 'bg-neutral-900 border-amber-500 ring-1 ring-amber-500 text-amber-400'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
              }`}
            >
              <div className="text-lg mb-1">📱</div>
              <p className="text-xs font-bold">QRIS (Transfer)</p>
            </div>

            <div
              onClick={() => setPaymentMethod('Cash / Tunai')}
              className={`p-3 rounded-xl border text-center cursor-pointer transition ${
                paymentMethod === 'Cash / Tunai'
                  ? 'bg-neutral-900 border-amber-500 ring-1 ring-amber-500 text-amber-400'
                  : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
              }`}
            >
              <div className="text-lg mb-1">💵</div>
              <p className="text-xs font-bold">Bayar di Tempat</p>
            </div>
          </div>

          {/* DISPLAY TAMPILAN QRIS JIKA METODE QRIS DIPILIH */}
          {paymentMethod === 'QRIS' && (
            <div className="mt-4 p-5 bg-neutral-900 border border-neutral-800 rounded-2xl text-center space-y-4">
              <div className="inline-block bg-white p-3 rounded-2xl shadow-lg border border-neutral-200">
                <img
                  src="/MCUT.png"
                  alt="QRIS M CUT BARBERSHOP"
                  className="w-48 h-48 object-contain mx-auto rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">M CUT BARBERSHOP</p>
                <p className="text-[11px] text-neutral-400">
                  Scan QRIS di atas menggunakan GoPay, OVO, Dana, ShopeePay, atau m-Banking.
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                <p className="text-xs text-amber-400 font-semibold">
                  Total Bayar: {formatRupiah(selectedService.price)}
                </p>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* 6. STICKY BOTTOM BAR (MOBILE FIRST) */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/90 backdrop-blur-md border-t border-neutral-800 p-4 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Total Estimasi</p>
            <p className="text-lg font-black text-amber-400">
              {formatRupiah(selectedService.price)}
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold py-3.5 rounded-xl transition text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Konfirmasi Reservasi 🚀'}
          </button>
        </div>
      </div>
    </div>
  )
}