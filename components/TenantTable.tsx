'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import FeatureToggleModal from './FeatureToggleModal'
import AddTenantModal from './AddTenantModal'
import TenantDetailPanel from './TenantDetailPanel'

interface Tenant {
  id: string
  business_name: string
  tenant_slug: string
  client_code: string
  domain_url: string
  subscription_plan: string
  is_active: boolean
  prevent_double_booking: boolean
  enable_slot_blocking: boolean
  enable_auto_disable_time_slots: boolean
  hide_booked_slots: boolean
  auto_wa_reminder: boolean
  require_consent: boolean
  show_extra_addon: boolean
  business_performance?: boolean // <-- Tambahkan di sini
  layout_type?: string
  [key: string]: any
}

export default function TenantTable({ initialTenants }: { initialTenants: Tenant[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  
  const [selectedDetailTenant, setSelectedDetailTenant] = useState<Tenant | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  const handlePlanChange = async (tenantId: string, newPlan: string) => {
    const { error } = await supabase
      .from('tenants')
      .update({ subscription_plan: newPlan })
      .eq('id', tenantId)

    if (error) {
      alert('Gagal mengubah paket: ' + error.message)
    } else {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_plan: newPlan } : t))
      router.refresh()
    }
  }

  const getPlanStyle = (plan: string) => {
    switch (plan) {
      case 'PROFESIONAL':
        return 'text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)] focus:border-cyan-400'
      case 'ULTIMATE':
        return 'text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.12)] focus:border-amber-400'
      default:
        return 'text-white border-cyan-500/30'
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="bg-black border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.12)] overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>

        <div className="p-6 md:px-8 md:py-6 border-b border-cyan-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]"></span>
              Daftar Tenant ({tenants.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">Kelola status, paket langganan, dan fitur masing-masing klien secara real-time.</p>
          </div>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-300 flex items-center gap-2 cursor-pointer transform hover:scale-105"
          >
            <span className="text-base leading-none">+</span> Tambah Tenant Baru
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-black text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                <th className="py-4 px-6">Tenant Name</th>
                <th className="py-4 px-6">Slug / Code</th>
                <th className="py-4 px-6">Subscription Plan</th>
                <th className="py-4 px-6">Status Akun</th>
                <th className="py-4 px-6 text-right">Aksi Fitur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10 text-sm">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-cyan-950/20 transition-all group">
                  <td className="py-4 px-6">
                    <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {tenant.business_name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 opacity-75">
                      {tenant.domain_url || `${tenant.tenant_slug}.vercel.app`}
                    </div>
                  </td>

                  <td className="py-4 px-6 font-mono text-xs">
                    <span className="text-cyan-300 font-bold">{tenant.tenant_slug}</span>{' '}
                    <span className="text-slate-500">({tenant.client_code || '-'})</span>
                  </td>

                  <td className="py-4 px-6">
                    <select
                      value={tenant.subscription_plan}
                      onChange={(e) => handlePlanChange(tenant.id, e.target.value)}
                      className={`bg-black border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none transition-all cursor-pointer ${getPlanStyle(tenant.subscription_plan)}`}
                    >
                      <option value="PROFESIONAL" className="bg-black text-cyan-300">PROFESIONAL</option>
                      <option value="ULTIMATE" className="bg-black text-amber-300">ULTIMATE</option>
                    </select>
                  </td>

                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
                      Active
                    </span>
                  </td>

                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedDetailTenant(tenant)
                          setIsDetailModalOpen(true)
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 transition-all duration-300 cursor-pointer"
                        title="Kelola Detail & Konfigurasi Tenant"
                      >
                        ⚙️ Setting
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTenant(tenant)
                          setIsFeatureModalOpen(true)
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-950/60 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all duration-300 cursor-pointer transform hover:scale-105"
                      >
                        Kelola Fitur
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTenant && (
        <FeatureToggleModal
          tenant={selectedTenant}
          isOpen={isFeatureModalOpen}
          onClose={() => {
            setIsFeatureModalOpen(false)
            setSelectedTenant(null)
          }}
          onSuccess={(updatedFeatures) => {
            setTenants(prev => 
              prev.map(t => 
                t.id === selectedTenant.id 
                  ? { ...t, ...updatedFeatures }
                  : t
              )
            )
            router.refresh()
          }}
        />
      )}

      {isDetailModalOpen && selectedDetailTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#0B0F19] rounded-2xl border border-cyan-500/40 shadow-2xl my-8">
            <div className="max-h-[85vh] overflow-y-auto p-2">
              <TenantDetailPanel 
                tenantData={selectedDetailTenant}
                onClose={() => {
                  setIsDetailModalOpen(false)
                  setSelectedDetailTenant(null)
                }}
                onSaveSuccess={(updatedTenantData) => {
                  setTenants(prev => 
                    prev.map(t => 
                      t.id === selectedDetailTenant.id 
                        ? { ...t, ...updatedTenantData } 
                        : t
                    )
                  )
                  router.refresh()
                }}
              />
            </div>
          </div>
        </div>
      )}

      <AddTenantModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}