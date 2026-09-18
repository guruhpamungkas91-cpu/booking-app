import { createServerSupabaseClient } from '@/lib/supabase-server'
import TenantTable from '@/components/TenantTable'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // <-- Tambahkan baris ini agar selalu mengambil data segar dari database

export default async function SuperAdminPage() {
  const supabase = await createServerSupabaseClient()
  const userEmail = 'guruhpamungkas91@gmail.com'

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-black text-slate-100 p-6 md:p-12 relative overflow-x-hidden">
      
      {/* Background Ambient Glow Tipis nan Mewah */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-cyan-500/20 gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wide uppercase mb-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Super Admin Core System
            </div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400">
              Control Center
            </h1>
            <p className="text-slate-400 text-sm">
              Kelola seluruh tenant, konfigurasi bisnis, dan feature toggle dari satu pusat kendali eksklusif.
            </p>
          </div>
          
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 px-4 py-2.5 rounded-xl text-xs flex items-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Dev Bypass Mode</span>
              <span className="text-cyan-300 font-mono font-medium">{userEmail}</span>
            </div>
          </div>
        </div>

        {tenantsError ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-2xl backdrop-blur-md shadow-lg">
            <p className="font-bold text-sm">Gagal memuat data tenant:</p>
            <p className="text-xs mt-1 opacity-90">{tenantsError.message}</p>
          </div>
        ) : (
          <TenantTable initialTenants={tenants || []} />
        )}

      </div>
    </div>
  )
}