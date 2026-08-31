export async function sendWhatsAppMessage(targetPhone: string, message: string) {
  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': process.env.FONNTE_TOKEN || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: targetPhone,
        message: message,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending WA via Fonnte:', error)
    return null
  }
}