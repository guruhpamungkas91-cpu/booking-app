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
    hostname === 'booking-app.vercel.app' // Ganti dengan domain utama project Vercel lu kalau ada
  ) {
    return NextResponse.next();
  }

  // 2. Ambil seluruh hostname atau bagian depannya sebagai slug secara otomatis
  // Contoh: fitri-feb.vercel.app -> tenant slug-nya adalah fitri-feb (atau sesuai nama domain)
  const parts = hostname.split('.');
  const tenantSlug = parts[0].toLowerCase();

  // 3. Jika user akses root ('/'), rewrite otomatis ke dynamic route `/[tenant_slug]`
  if (url.pathname === '/') {
    url.pathname = `/${tenantSlug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};