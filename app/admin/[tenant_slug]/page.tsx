'use client'

import { useState, useEffect, use } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { Tenant } from '@/types';
import { User } from '@supabase/supabase-js';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TenantAdminPage({
  params,
}: {
  params: Promise<{ tenant_slug: string }>
}) {
  const resolvedParams = use(params)
  const tenantSlug = resolvedParams.tenant_slug

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const router = useRouter()

  useEffect(() => {
    async function initPage() {
      setLoadingTenant(true)
      
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .maybeSingle()

      if (tenantData) {
        setTenant(tenantData)
      }

      setLoadingTenant(false)
    }

    initPage()
  }, [tenantSlug])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (!tenant) {
      setErrorMsg('Tenant tidak ditemukan!')
      setLoading(false)
      return
    }

    if (tenant.admin_email && tenant.admin_email.toLowerCase() !== emailInput.toLowerCase()) {
      setErrorMsg(`Akses Ditolak! Akun "${emailInput}" tidak memiliki izin.`)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      setUser(data.user)
      setLoading(false)
      router.refresh()
    }
  }

  if (loadingTenant) {
    return (
      <div className="min-h-screen bg-[#06040a] text-slate-100 flex items-center justify-center">
        <div className="text-xs text-amber-500 animate-pulse">Memuat portal tenant...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#06040a] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Tenant Tidak Ditemukan</h1>
        <p className="text-xs text-slate-400">Portal admin untuk &quot;{tenantSlug}&quot; tidak terdaftar di sistem.</p>
      </div>
    )
  }

  // Jika user terautentikasi -> masuk ke AdminDashboard
  if (user) {
    return <AdminDashboard tenantSlug={tenantSlug} />
  }

  // Ambil theme_color dari DB (fallback default ke #F59E0B)
  const themeColor = tenant.theme_color || '#F59E0B'
  const isEyelash = (tenant.category || '').toLowerCase() === 'eyelash'
  const brandTitle = tenant.business_name || tenant.name || tenantSlug.toUpperCase()
  const controlCenterLabel = tenant.control_center_label || (isEyelash ? '💅 Eyelash Control Center' : '💈 Barber Control Center')

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 font-sans text-zinc-100 relative overflow-hidden bg-[#06040a]">
      
      {/* Background Glow Dinamis */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 rounded-full blur-3xl pointer-events-none opacity-20 transition-opacity duration-300"
        style={{ backgroundColor: themeColor }}
      ></div>

      {/* Main Card — Ukuran dikunci dengan w-full max-w-md tanpa transition-all */}
      <div 
        className="w-full max-w-md backdrop-blur-2xl bg-zinc-950/80 border rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative z-10 transition-colors duration-300"
        style={{ 
          borderColor: `${themeColor}40`,
          boxShadow: `0 20px 50px -10px ${themeColor}20` 
        }}
      >
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border tracking-widest uppercase shadow-inner"
            style={{ 
              backgroundColor: `${themeColor}15`,
              borderColor: `${themeColor}40`,
              color: themeColor 
            }}
          >
            <span 
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: themeColor }}
            ></span>
            {controlCenterLabel}
          </span>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase mt-2">
            {brandTitle}
          </h1>
          <p className="text-xs text-zinc-400 font-medium">Masuk untuk mengakses dasbor manajemen reservasi</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email Admin</label>
            <input
              type="email"
              required
              placeholder="admin@bisnis.com"
              className="w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all shadow-inner focus:border-opacity-100"
              style={{ caretColor: themeColor }}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all shadow-inner focus:border-opacity-100"
              style={{ caretColor: themeColor }}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-black py-3.5 rounded-2xl transition-all text-xs tracking-wide shadow-lg active:scale-[0.98] disabled:opacity-50 mt-2 text-black"
            style={{ 
              backgroundColor: themeColor,
              boxShadow: `0 10px 25px -5px ${themeColor}50`
            }}
          >
            {loading ? 'Memproses Authentikasi...' : 'MASUK DASHBOARD'}
          </button>
        </form>

        <div className="pt-2 text-center">
          <button 
            type="button"
            onClick={() => router.push(`/${tenantSlug}`)}
            className="text-[11px] text-zinc-400 hover:text-white transition-colors"
          >
            ← Kembali ke Katalog {brandTitle}
          </button>
        </div>
      </div>
    </main>
  )
}