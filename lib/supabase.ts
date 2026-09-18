import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nhrrucnttnibqgygzqzz.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Gunakan ini khusus untuk Client Components ('use client')
export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey)

// Instance singleton opsional jika masih dibutuhkan komponen lama di browser
export const supabase = createClient()