import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // 1. Abaikan file internal Next.js, API, file statis, atau localhost
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.') ||
    hostname.includes('localhost') ||
    hostname === 'booking-app.vercel.app' // Ganti domain utama lu di sini jika ada
  ) {
    return NextResponse.next();
  }

  // 2. Ambil nama subdomain secara otomatis (Contoh: fitri-feb dari fitri-feb.vercel.app)
  // Kalau lu mau pakai seluruh hostname, tinggal ganti variabel ini jadi `const currentSlug = hostname.toLowerCase()`
  const parts = hostname.split('.');
  const currentSlug = parts[0].toLowerCase();

  // 3. Jika user mengakses halaman utama ('/'), kita rewrite secara dinamis 
  // ke handler atau halaman dengan membawa slug/hostname tersebut
  if (url.pathname === '/') {
    // Kalau struktur project lu menggunakan dynamic route [tenant_slug], aktifkan baris bawah ini:
    // url.pathname = `/${currentSlug}`;
    
    // Atau jika frontend lu membaca window.location.hostname langsung di page.tsx,
    // kita cukup teruskan lewat header atau biarkan rewrite ke root tapi ditangkap kodingan client.
    // Tapi cara paling aman di Next.js untuk multi-tenant Vercel adalah meneruskan hostname via header:
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-hostname', hostname);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};