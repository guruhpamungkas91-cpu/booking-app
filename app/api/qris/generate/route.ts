import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Return response dummy dulu untuk tes
    return NextResponse.json({ qrUrl: '/mcut.png' })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal generate QRIS' }, { status: 500 })
  }
}