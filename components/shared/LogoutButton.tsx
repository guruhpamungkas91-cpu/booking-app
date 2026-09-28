'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface LogoutButtonProps {
  redirectTo?: string
  onLogout?: () => void
}

export default function LogoutButton({ redirectTo, onLogout }: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)

      // 1. Sign out dari Supabase secara asynchronous
      await supabase.auth.signOut()

      // 2. Jika ada callback lokal (seperti setIsAuthenticated(false)), jalankan langsung secara instan
      if (onLogout) {
        onLogout()
      } else if (redirectTo) {
        window.location.href = redirectTo
      }
    } catch (err) {
      console.error('Error logging out:', err)
      if (onLogout) onLogout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="bg-rose-500/15 hover:bg-rose-500/30 text-rose-500 border border-rose-500/30 px-4 py-2.5 rounded-xl font-bold transition-all text-[11px] sm:text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoggingOut ? (
        <>
          <span className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
          Keluar...
        </>
      ) : (
        'Logout'
      )}
    </button>
  )
}