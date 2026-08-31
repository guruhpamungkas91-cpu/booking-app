'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function InvoicePage() {
  const params = useParams()
  const bookingIdParam = params?.id as string
  const rawId = bookingIdParam ? bookingIdParam.replace('BK-', '') : ''

  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rawId) return
    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from('Reservations')
        .select('*')
        .eq('id', rawId)
        .single()

      if (!error && data) {
        setBooking(data)
      }
      setLoading(false)
    }
    fetchBooking()
  }, [rawId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <p className="text-xs text-zinc-400">Memuat Invoice...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center font-sans">
        <p className="text-xs text-rose-400">Invoice tidak ditemukan atau data salah.</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-2xl">
        <div className="text-center border-b border-zinc-800 pb-4">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            INVOICE DIGITAL
          </span>
          <h1 className="text-xl font-black text-white mt-3">#{bookingIdParam}</h1>
          <p className="text-xs text-zinc-400 mt-1">Status: <span className="text-amber-400 uppercase font-semibold">{booking.status}</span></p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span className="text-zinc-400">Nama Customer</span>
            <span className="font-bold text-white">{booking.customer_name}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span className="text-zinc-400">No. WhatsApp</span>
            <span className="font-semibold text-zinc-200">{booking.whatsapp_number}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span className="text-zinc-400">Jadwal Booking</span>
            <span className="font-semibold text-zinc-200">{booking.booking_date} ({booking.booking_time} WIB)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span className="text-zinc-400">Layanan</span>
            <span className="font-semibold text-zinc-200 text-right max-w-[200px]">{booking.service_name}</span>
          </div>
          {booking.staff_name && (
            <div className="flex justify-between py-1 border-b border-zinc-800/50">
              <span className="text-zinc-400">Capster / Staff</span>
              <span className="font-semibold text-zinc-200">{booking.staff_name}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-zinc-800/50">
            <span className="text-zinc-400">Metode Bayar</span>
            <span className="font-semibold text-zinc-200">{booking.payment_method} ({booking.payment_type})</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Simpan atau tunjukkan invoice ini saat datang ke barbershop</p>
        </div>
      </div>
    </main>
  )
}