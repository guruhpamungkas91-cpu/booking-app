import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // 1. Abaikan file internal Next.js, API, atau localhost / domain utama aplikasi lu
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.') ||
    hostname.includes('localhost') ||
    hostname === 'booking-app.vercel.app' // <-- Ganti dengan domain utama project Vercel lu jika ada
  ) {
    return NextResponse.next();
  }

  // 2. Untuk semua subdomain tenant lain (fitri-feb, mcut-barbershop, glow-clinic, dll),
  // biarkan masuk tanpa perlu di-hardcode. Nanti frontend yang akan baca hostname-nya 
  // dan nge-query langsung ke Supabase secara otomatis!
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};