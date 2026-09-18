import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Tambahkan "async" di sini
export async function createServerSupabaseClient() {
  // Tambahkan "await" di sini agar cookies ter-unwrap dengan benar
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (typeof cookieStore.set === 'function') {
                cookieStore.set(name, value, options)
              }
            })
          } catch {
            // Diabaikan jika terpanggil dari Server Component murni
          }
        },
      },
    }
  )
}