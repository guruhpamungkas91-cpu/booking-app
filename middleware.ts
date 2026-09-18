import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // 1. Abaikan file internal Next.js, API, file statis, localhost, HALAMAN ADMIN, DAN SUPER ADMIN
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/super-admin') || // 👈 Ditambahkan agar /super-admin tidak dibaca sebagai tenant
    url.pathname.includes('.') ||
    hostname.includes('localhost') ||
    hostname === 'booking-app.vercel.app'
  ) {
    return NextResponse.next();
  }

  // 2. Deteksi apakah ini diakses lewat domain utama kita (bookingpage.site)
  const rootDomain = 'bookingpage.site';
  
  // Jika diakses menggunakan domain utama (bukan subdomain), lewati middleware rewrite
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return NextResponse.next();
  }

  // 3. Ambil slug dari subdomain secara aman (contoh: fitri dari fitri.bookingpage.site)
  const currentHost = hostname.replace(/^(https?:\/\/)?/, '');
  const parts = currentHost.split('.');
  
  // Pastikan format subdomain valid (minimal ada subdomain sebelum domain utama)
  if (parts.length >= 2) {
    const tenantSlug = parts[0].toLowerCase();

    // 4. Jika user akses root publik ('/'), rewrite ke dynamic route tenant
    if (url.pathname === '/') {
      url.pathname = `/${tenantSlug}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Tambahkan 'super-admin' ke dalam pengecualian matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|admin|super-admin).*)'],
};