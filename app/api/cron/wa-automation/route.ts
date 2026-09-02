import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

// Helper untuk format YYYY-MM-DD sesuai Timezone WIB (Asia/Jakarta)
function getWibDateString(addDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + addDays)
  
  // Format ke timezone Jakarta
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }
  
  const formatter = new Intl.DateTimeFormat('en-CA', options) // format en-CA menghasilkan YYYY-MM-DD
  return formatter.format(date)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Validasi kunci rahasia
  if (searchParams.get('key') !== process.env.CRON_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Hitung Tanggal Besok (H-1) berbasis WIB
  const tomorrowStr = getWibDateString(1)

  // Ambil reservasi untuk besok
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
      logs.push({ customer: booking.customer_name, targetDate: tomorrowStr, fonnteResponse: res })

      if (res) {
        await supabase
          .from('Reservations')
          .update({ is_reminder_sent: true })
          .eq('id', booking.id)
      }
    }
  }

  // 2. CRM RETENSI (21 Hari Setelah Service) berbasis WIB
  const past21DaysStr = getWibDateString(-21)

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

  // Mengembalikan log transparan agar gampang di-debug
  return NextResponse.json({ 
    success: true, 
    targetTomorrowDate: tomorrowStr,
    foundBookings: upcomingBookings?.length || 0,
    logs 
  })
}