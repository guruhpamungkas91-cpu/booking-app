import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Ganti <PROJECT_ID> dengan Reference ID Supabase kamu
    const supabasePublicUrl = 'https://<PROJECT_ID>.supabase.co/storage/v1/object/public/qris-images/mcut.png'

    return NextResponse.json({ qrUrl:"https://nhrrucnttnibqgygzqzz.supabase.co/storage/v1/object/public/qris-images/mcut.png" })
  } catch (error) {
    return NextResponse.json({ error: 'Gagal generate QRIS' }, { status: 500 })
  }
}