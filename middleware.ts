import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. Inisialisasi Supabase Client untuk Refresh Session Cookie
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // 2. Proteksi Khusus Super Admin (/super-admin)
  if (url.pathname.startsWith('/super-admin') && !user) {
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // 3. Pengecualian Rute Internal, Asset Statis, API, Admin Panel, & Domain Utama
  const isPlainLocalhost = hostname === 'localhost' || hostname === 'localhost:3000'
  const isMainDomain = 
    hostname === 'bookingpage.site' || 
    hostname === 'www.bookingpage.site' || 
    hostname === 'booking-app.vercel.app'

  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/super-admin') ||
    url.pathname.includes('.') ||
    isPlainLocalhost ||
    isMainDomain
  ) {
    return response
  }

  // 4. Ektraksi Subdomain Tenant Secara Presisi (Contoh: glow dari glow.bookingpage.site)
  const tenantSlug = hostname
    .replace(':3000', '')
    .replace('.bookingpage.site', '')
    .replace('.booking-app.vercel.app', '')
    .replace('.localhost', '')
    .toLowerCase()

  // 5. Rewrite Dinamis ke Folder Tenant (/app/[tenant_slug]/page.tsx)
  if (tenantSlug && tenantSlug !== hostname) {
    url.pathname = `/${tenantSlug}${url.pathname}`
    
    // Sertakan response.headers agar cookie auth Supabase tidak hilang saat di-rewrite
    return NextResponse.rewrite(url, { headers: response.headers })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}