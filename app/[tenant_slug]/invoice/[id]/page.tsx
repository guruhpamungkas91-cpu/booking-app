'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { InvoiceBooking } from '@/types'
import { CheckCircle2, Clock, XCircle, Calendar, User, Phone, Scissors, CreditCard, Download, ArrowLeft } from 'lucide-react'

export default function InvoicePage() {
  const params = useParams()
  const bookingIdParam = params?.id as string
  const rawId = bookingIdParam ? bookingIdParam.replace('BK-', '') : ''

  const [booking, setBooking] = useState<InvoiceBooking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rawId) return

    const fetchBooking = async () => {
      const numericId = parseInt(rawId, 10)
      if (isNaN(numericId)) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', numericId)
        .single()

      if (error) {
        console.error('Error Supabase:', error.message)
      }

      if (!error && data) {
        setBooking(data as InvoiceBooking)
      }
      setLoading(false)
    }

    fetchBooking()
  }, [rawId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center font-sans">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-zinc-400 font-medium">Memuat Invoice...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center font-sans p-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center max-w-sm">
          <XCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-xs text-rose-300 font-medium">Invoice tidak ditemukan atau data salah.</p>
        </div>
      </div>
    )
  }

  // Helper warna & ikon berdasarkan status
  const getStatusBadge = (status?: string) => {
  const s = status?.toLowerCase() || ''
  
  if (s === 'confirmed' || s === 'success' || s === 'lunas') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
      </span>
    )
  }
  if (s === 'cancelled' || s === 'batal') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider text-rose-400 uppercase bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" /> Cancelled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wider text-amber-400 uppercase bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
      <Clock className="w-3.5 h-3.5" /> Pending
    </span>
  )
}

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Glow Ambient Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative z-10">
        
        {/* Header Invoice */}
        <div className="text-center border-b border-zinc-800/80 pb-6">
          <div className="flex justify-center mb-3">
            {getStatusBadge(booking.status)}
          </div>
          <p className="text-[10px] tracking-widest text-zinc-500 uppercase font-semibold">Bukti Reservasi Digital</p>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">#{bookingIdParam}</h1>
        </div>

        {/* Detail Reservasi */}
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
            <span className="text-zinc-400 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-zinc-500" /> Pelanggan
            </span>
            <span className="font-bold text-white text-right">{booking.customer_name}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
            <span className="text-zinc-400 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-500" /> No. WhatsApp
            </span>
            <span className="font-semibold text-zinc-200">{booking.whatsapp_number}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
            <span className="text-zinc-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" /> Jadwal
            </span>
            <span className="font-semibold text-zinc-200 text-right">
              {booking.booking_date} ({booking.booking_time} WIB)
            </span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
            <span className="text-zinc-400 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-zinc-500" /> Layanan
            </span>
            <span className="font-semibold text-emerald-400 text-right max-w-[180px] sm:max-w-[200px]">
              {booking.service_name}
            </span>
          </div>

          {booking.staff_name && (
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
              <span className="text-zinc-400 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-zinc-500" /> Spesialis / Staff
              </span>
              <span className="font-semibold text-zinc-200">{booking.staff_name}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-b border-zinc-800/40">
            <span className="text-zinc-400 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-zinc-500" /> Pembayaran
            </span>
            <span className="font-semibold text-zinc-200">
              {booking.payment_method} {booking.payment_type ? `(${booking.payment_type})` : ''}
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="p-3.5 bg-zinc-950/60 rounded-2xl border border-zinc-800/60 text-center">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Tunjukkan bukti invoice ini kepada staf/admin saat tiba di lokasi.
          </p>
        </div>

        {/* Tombol Aksi */}
        <div className="pt-2 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" /> Cetak / PDF
          </button>
        </div>

      </div>
    </main>
  )
}