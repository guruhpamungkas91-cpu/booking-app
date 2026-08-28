import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // 1. Ambil URL request
  const url = request.nextUrl.clone();

  // 2. Cek apakah domain memuat 'barbershop' atau 'mcut'
  if (hostname.includes('mcut-barbershop') || hostname.includes('barber')) {
    // Set custom header agar halaman page.tsx tahu ini Barber dari awal
    const response = NextResponse.next();
    response.headers.set('x-tenant-type', 'barber');
    return response;
  }

  // 3. Fallback jika domain tidak teridentifikasi
  const response = NextResponse.next();
  response.headers.set('x-tenant-type', 'default');
  return response;
}

// Jalankan middleware hanya pada route /admin
export const config = {
  matcher: '/admin/:path*',
};