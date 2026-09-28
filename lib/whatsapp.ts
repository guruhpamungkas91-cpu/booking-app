interface SendWAMessageOptions {
  targetPhone: string
  message: string
  customToken?: string // Opsional: jika tenant menggunakan API key Fonnte sendiri
}

export async function sendWhatsAppMessage({
  targetPhone,
  message,
  customToken,
}: SendWAMessageOptions) {
  try {
    // Sanitasi nomor HP: hilangkan spasi, strip, dan karakter non-digit
    const sanitizedPhone = targetPhone.replace(/[^0-9]/g, '')
    const token = customToken || process.env.FONNTE_TOKEN || ''

    if (!token) {
      console.warn('Fonnte Token tidak ditemukan.')
      return { status: false, message: 'Token WA tidak terkonfigurasi' }
    }

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: sanitizedPhone,
        message: message,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending WA via Fonnte:', error)
    return { status: false, error }
  }
}