import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl.clone();

  // Abaikan file internal Next.js atau API agar tidak terganggu
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Contoh pemetaan domain Vercel ke slug tenant di database lu
  let tenantSlug = '';

  if (hostname.includes('mcut-barbershop')) {
    tenantSlug = 'mcut'; // Sesuai slug di database Supabase lu
  } else if (hostname.includes('fitrifeb-lashes')) {
    tenantSlug = 'fitrifeb';
  } else if (hostname.includes('glow-clinic')) {
    tenantSlug = 'glow';
  }

  // Jika domain terdeteksi sebagai tenant, arahkan (rewrite) ke halaman dinamis [tenant_slug]
  if (tenantSlug && url.pathname === '/') {
    url.pathname = `/${tenantSlug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

// Jalankan middleware untuk seluruh halaman utama, KECUALI file statis/api
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};