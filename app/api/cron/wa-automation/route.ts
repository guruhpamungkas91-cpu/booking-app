import { NextResponse } from 'next/server'
// Mundur 3 kali: wa-automation -> cron -> api -> root -> lib
import { supabase } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Validasi kunci rahasia
  if (searchParams.get('key') !== process.env.CRON_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // -------------------------------------------------------------
  // Hitung Tanggal Besok (Format YYYY-MM-DD Lokal WIB / UTC+7)
  // -------------------------------------------------------------
  const now = new Date()
  // Tambah 1 hari untuk target H-1
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Konversi ke format string YYYY-MM-DD berdasarkan waktu lokal/Asia/Jakarta
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDay() ? tomorrow.getDate() : tomorrow.getDate()).padStart(2, '0')
  const tomorrowStr = `${year}-${month}-${day}`

  // -------------------------------------------------------------
  // 1. AUTO REMINDER (H-1 Sebelum Jadwal)
  // -------------------------------------------------------------
  // Menggunakan `.or()` agar data yang 'is_reminder_sent'-nya FALSE atau NULL tetap terbaca
  const { data: upcomingBookings, error: dbError } = await supabase
    .from('Reservations')
    .select('*')
    .eq('booking_date', tomorrowStr)
    .or('is_reminder_sent.eq.false,is_reminder_sent.is.null')

  const logs: any[] = []

  if (upcomingBookings && upcomingBookings.length > 0) {
    for (const booking of upcomingBookings) {
      const msg = 
        `Halo Kak *${booking.customer_name}* 😊\n\n` +
        `Sekadar mengingatkan jadwal perawatan kamu untuk besok:\n` +
        `📅 *Tanggal:* ${booking.booking_date}\n` +
        `⏰ *Jam:* ${booking.booking_time}\n` +
        `✨ *Layanan:* ${booking.service_name}\n\n` +
        `Sampai jumpa besok ya Kak! Mohon datang tepat waktu.`

      const res = await sendWhatsAppMessage(booking.whatsapp_number, msg)
      logs.push({ customer: booking.customer_name, fonnteResponse: res })

      // Fonnte biasanya mengembalikan nilai status: true atau target terisi
      if (res) {
        await supabase
          .from('Reservations')
          .update({ is_reminder_sent: true })
          .eq('id', booking.id)
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CRM RETENSI (21 Hari Setelah Service)
  // -------------------------------------------------------------
  const past21Days = new Date(now)
  past21Days.setDate(past21Days.getDate() - 21)
  const pastYear = past21Days.getFullYear()
  const pastMonth = String(past21Days.getMonth() + 1).padStart(2, '0')
  const pastDay = String(past21Days.getDate()).padStart(2, '0')
  const past21DaysStr = `${pastYear}-${pastMonth}-${pastDay}`

  const { data: pastBookings } = await supabase
    .from('Reservations')
    .select('*')
    .eq('booking_date', past21DaysStr)
    .or('is_retention_sent.eq.false,is_retention_sent.is.null')

  if (pastBookings && pastBookings.length > 0) {
    for (const booking of pastBookings) {
      const msg = 
        `Halo Kak *${booking.customer_name}* 😊\n\n` +
        `Sudah 3 minggu nih sejak perawatan terakhir kamu.\n` +
        `Waktunya *retouch / perawatan ulang* supaya tampilan kamu tetap maksimal! 💋\n\n` +
        `Yuk amankan slot kamu sekarang lewat link reservasi kami!`

      const res = await sendWhatsAppMessage(booking.whatsapp_number, msg)

      if (res) {
        await supabase
          .from('Reservations')
          .update({ is_retention_sent: true })
          .eq('id', booking.id)
      }
    }
  }

  // Hapus log debug dan kembalikan response standar produksi
  return NextResponse.json({ success: true, message: 'Automation running cleanly' })
}