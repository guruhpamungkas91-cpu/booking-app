'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AddTenantModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddTenantModal({ isOpen, onClose }: AddTenantModalProps) {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    business_name: '',
    tenant_slug: '',
    client_code: '',
    domain_url: '',
    subscription_plan: 'PROFESIONAL',
    business_category: '',
    admin_email: '',
    admin_whatsapp: '',
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const cleanSlug = formData.tenant_slug.toLowerCase().replace(/\s+/g, '-')

    const { error } = await supabase.from('tenants').insert([
      {
        business_name: formData.business_name,
        tenant_slug: cleanSlug,
        client_code: formData.client_code.toUpperCase(),
        domain_url: formData.domain_url,
        subscription_plan: formData.subscription_plan,
        business_category: formData.business_category,
        admin_email: formData.admin_email,
        admin_whatsapp: formData.admin_whatsapp,
        is_active: true,
      },
    ])

    setLoading(false)

    if (error) {
      alert('Gagal menambahkan tenant: ' + error.message)
    } else {
      setFormData({
        business_name: '',
        tenant_slug: '',
        client_code: '',
        domain_url: '',
        subscription_plan: 'PROFESIONAL',
        business_category: '',
        admin_email: '',
        admin_whatsapp: '',
      })
      onClose()
      router.refresh()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      
      {/* Modal Card Utama: Hitam Pekat dengan Neon Cyan Glow */}
      <div className="bg-black border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] w-full max-w-2xl overflow-hidden relative">
        
        {/* Garis pendar cahaya neon di bagian atas */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>

        {/* Header Modal - Murni Hitam Pekat */}
        <div className="flex justify-between items-center p-6 border-b border-cyan-500/20 bg-black">
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></span>
              Tambah Tenant Baru
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Daftarkan partner bisnis atau cabang baru ke dalam ekosistem SaaS.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-cyan-300 transition-colors p-1.5 rounded-lg hover:bg-cyan-950/40 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Input - Murni Hitam Pekat */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-black">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Nama Bisnis */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Nama Bisnis / Usaha
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: M Cut Barbershop"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)]"
              />
            </div>

            {/* Slug Tenant */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Slug Tenant (URL Path)
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: mcut"
                value={formData.tenant_slug}
                onChange={(e) => setFormData({ ...formData, tenant_slug: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)] font-mono text-xs"
              />
            </div>

            {/* Client Code */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Client Code (Inisial)
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: MCUT"
                value={formData.client_code}
                onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)] font-mono text-xs uppercase"
              />
            </div>

            {/* Domain / Vercel URL */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Domain / Vercel URL
              </label>
              <input
                type="text"
                placeholder="Contoh: mcut.vercel.app"
                value={formData.domain_url}
                onChange={(e) => setFormData({ ...formData, domain_url: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)] font-mono text-xs"
              />
            </div>

            {/* Paket Langganan */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Paket Langganan
              </label>
              <select
                value={formData.subscription_plan}
                onChange={(e) => setFormData({ ...formData, subscription_plan: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)] cursor-pointer"
              >
                <option value="PROFESIONAL" className="bg-black text-cyan-300">PROFESIONAL</option>
                <option value="ULTIMATE" className="bg-black text-amber-300">ULTIMATE</option>
              </select>
            </div>

            {/* Kategori Bisnis */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Kategori Bisnis
              </label>
              <input
                type="text"
                placeholder="Contoh: Barbershop, Salon, F&B, dll"
                value={formData.business_category}
                onChange={(e) => setFormData({ ...formData, business_category: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)]"
              />
            </div>

            {/* Email Admin */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Email Admin Tenant
              </label>
              <input
                type="email"
                required
                placeholder="contoh@domain.com"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)]"
              />
            </div>

            {/* Nomor WhatsApp Admin */}
            <div>
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
                Nomor WhatsApp Admin
              </label>
              <input
                type="text"
                placeholder="628123456789"
                value={formData.admin_whatsapp}
                onChange={(e) => setFormData({ ...formData, admin_whatsapp: e.target.value })}
                className="w-full bg-black border border-cyan-500/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.08)] font-mono text-xs"
              />
            </div>

          </div>

          {/* Tombol Aksi - Murni Hitam Pekat */}
          <div className="flex justify-end items-center gap-3 pt-6 border-t border-cyan-500/20 mt-6 bg-black">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-black text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-500 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-300 cursor-pointer transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan & Daftarkan'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}