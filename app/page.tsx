'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Secara otomatis arahkan root domain ke tenant default (misal 'mcut') atau halaman booking utama
    router.replace('/mcut') 
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
      Memuat Control Center...
    </div>
  )
}