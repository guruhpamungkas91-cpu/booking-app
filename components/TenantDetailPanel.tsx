'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase' // 👈 GUNAKAN INI (instance global yang benar)
import { X } from 'lucide-react'

export default function TenantDetailPanel({ 
  tenantData, 
  onClose, 
  onSaveSuccess 
}: { 
  tenantData: any; 
  onClose: () => void; 
  onSaveSuccess?: (updated: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'services' | 'addons' | 'general'>('profile')

  const [loadingProfile, setLoadingProfile] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingServices, setLoadingServices] = useState(false)
  const [loadingAddons, setLoadingAddons] = useState(false)
  const [loadingGeneral, setLoadingGeneral] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const [staffList, setStaffList] = useState<any[]>([])
  const [servicesList, setServicesList] = useState<any[]>([])
  const [addonsList, setAddonsList] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  
  // State untuk Status Utama Tenant (is_active) di halaman utama
  const [isTenantActive, setIsTenantActive] = useState<boolean>(
    tenantData?.is_active !== undefined ? tenantData.is_active : true
  )

  // State untuk Tab 1: Profil & Branding
  const [profileData, setProfileData] = useState({
    business_name: tenantData?.business_name || '',
    tenant_slug: tenantData?.tenant_slug || '',
    client_code: tenantData?.client_code || '',
    domain_url: tenantData?.domain_url || tenantData?.domain || '',
    logo_url: tenantData?.logo_url || '',
    category: tenantData?.category || 'barbershop',
    staff_label: tenantData?.staff_label || 'Capster',
    control_center_label: tenantData?.control_center_label || '💈 Control Center',
    custom_terms_text: tenantData?.custom_terms_text || '',
  })

  // State untuk Tab Keuangan / General (Termasuk bank_accounts & ewallet_accounts)
  const [generalData, setGeneralData] = useState({
    theme_color: tenantData?.theme_color || '#00ffff',
    dp_type: tenantData?.dp_type || 'Percentage (%)',
    dp_value: tenantData?.dp_value || 0,
    qris_url: tenantData?.qris_url || '',
    bank_accounts: Array.isArray(tenantData?.bank_accounts) ? tenantData.bank_accounts : [],
    ewallet_accounts: Array.isArray(tenantData?.ewallet_accounts) ? tenantData.ewallet_accounts : [],
  })

  // Snapshot awal untuk mendeteksi perubahan per bagian
  const [initialProfile, setInitialProfile] = useState<string>('')
  const [initialStaff, setInitialStaff] = useState<string>('')
  const [initialServices, setInitialServices] = useState<string>('')
  const [initialAddons, setInitialAddons] = useState<string>('')
  const [initialGeneral, setInitialGeneral] = useState<string>('')

  // State untuk pop-up konfirmasi Batal per bagian / tutup modal
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingCancelAction, setPendingCancelAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (tenantData?.id) {
      fetchAllData()
    }
  }, [tenantData])

  const fetchAllData = async () => {
    try {
      setLoadingData(true)
      // Fetch profil tenant terbaru dari tabel tenants
      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantData.id)
        .single()

      const tData = currentTenant || tenantData

      if (tData?.is_active !== undefined) {
        setIsTenantActive(tData.is_active)
      }

      const profObj = {
        business_name: tData?.business_name || '',
        tenant_slug: tData?.tenant_slug || '',
        client_code: tData?.client_code || '',
        domain_url: tData?.domain_url || tData?.domain || '',
        logo_url: tData?.logo_url || '',
        category: tData?.category || 'barbershop',
        staff_label: tData?.staff_label || 'Capster',
        control_center_label: tData?.control_center_label || '💈 Control Center',
        custom_terms_text: tData?.custom_terms_text || '',
      }
      setProfileData(profObj)
      setInitialProfile(JSON.stringify(profObj))

      // Fetch Staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('tenant_id', tenantData.id)
      
      const stfList = staffData || []
      setStaffList(stfList)
      setInitialStaff(JSON.stringify(stfList))

      // Fetch Services & Addons
      const { data: servData } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantData.id)

      const srvList = (servData || []).filter(s => !s.is_addon)
      const addList = (servData || []).filter(s => s.is_addon)

      setServicesList(srvList)
      setInitialServices(JSON.stringify(srvList))

      setAddonsList(addList)
      setInitialAddons(JSON.stringify(addList))

      // Fetch General / Keuangan
      const genObj = {
        theme_color: tData?.theme_color || '#00ffff',
        dp_type: tData?.dp_type || 'Percentage (%)',
        dp_value: tData?.dp_value || 0,
        qris_url: tData?.qris_url || '',
        bank_accounts: Array.isArray(tData?.bank_accounts) ? tData.bank_accounts : [],
        ewallet_accounts: Array.isArray(tData?.ewallet_accounts) ? tData.ewallet_accounts : [],
      }
      setGeneralData(genObj)
      setInitialGeneral(JSON.stringify(genObj))

    } catch (err) {
      console.error('Gagal mengambil data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  // Handle Toggle Tenant Active Status langsung di halaman utama
  const handleToggleTenantActive = async (newStatus: boolean) => {
    setIsTenantActive(newStatus)
    setLoadingStatus(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ is_active: newStatus })
        .eq('id', tenantData.id)
        .select()
        .single()

      if (error) throw error

      if (onSaveSuccess && data) {
        onSaveSuccess(data)
      }
    } catch (err: any) {
      alert('Gagal mengubah status aktif tenant: ' + err.message)
      setIsTenantActive(!newStatus)
    } finally {
      setLoadingStatus(false)
    }
  }

  // Helper untuk cek perubahan saat tombol Batal ditekan
  const handleCheckAndCancel = (currentJson: string, initialJson: string, revertCallback: () => void) => {
    if (currentJson !== initialJson) {
      setPendingCancelAction(() => revertCallback)
      setShowConfirmModal(true)
    } else {
      revertCallback()
    }
  }

  const revertProfile = () => fetchAllData()
  const revertStaff = () => fetchAllData()
  const revertServices = () => fetchAllData()
  const revertAddons = () => fetchAllData()
  const revertGeneral = () => fetchAllData()

  // upload logo
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo_${Date.now()}.${fileExt}`
      const filePath = `public/${fileName}`

      // Upload ke bucket 'tenant-logos'
      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Ambil Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath)

      // Masukkan ke state profileData (sesuaikan dengan nama state form profil lu, misal setProfileData)
      setProfileData({ ...profileData, logo_url: publicUrl })

      alert('Logo berhasil di-upload!')
    } catch (error: any) {
      console.error('Gagal upload logo:', error.message)
      alert('Gagal mengupload logo. Pastikan ukuran file tidak terlalu besar.')
    }
  }

  // SAVE PROFILE & BRANDING (TAB 1)
  const handleSaveProfile = async () => {
    setLoadingProfile(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({
          business_name: profileData.business_name,
          tenant_slug: profileData.tenant_slug,
          client_code: profileData.client_code,
          domain_url: profileData.domain_url,
          logo_url: profileData.logo_url,
          category: profileData.category,
          staff_label: profileData.staff_label,
          control_center_label: profileData.control_center_label,
          custom_terms_text: profileData.custom_terms_text,
        })
        .eq('id', tenantData.id)
        .select()
        .single()

      if (error) throw error

      alert('Berhasil menyimpan Profil & Branding!')
      if (onSaveSuccess && data) {
        onSaveSuccess(data)
      }
      await fetchAllData()
    } catch (err: any) {
      alert('Gagal menyimpan profil: ' + err.message)
    } finally {
      setLoadingProfile(false)
    }
  }

  // SAVE STAFF
  const handleSaveStaff = async () => {
    setLoadingStaff(true)
    try {
      const { data: existing } = await supabase.from('staff').select('id').eq('tenant_id', tenantData.id)
      const existingIds = (existing || []).map(s => s.id)
      const currentIds = staffList.filter(s => s.id && typeof s.id === 'number').map(s => s.id)
      const idsToDelete = existingIds.filter(id => !currentIds.includes(id))

      if (idsToDelete.length > 0) {
        await supabase.from('staff').delete().in('id', idsToDelete)
      }

      for (const stf of staffList) {
        const payload = {
          tenant_id: tenantData.id,
          tenant_slug: profileData.tenant_slug || tenantData.tenant_slug,
          name: stf.name,
          role: stf.role || 'Staff',
          is_active: Boolean(stf.is_active),
          max_slots: stf.max_slots || 1,        // <-- Tambahan
          phone: stf.phone || null,             // <-- Tambahan
          photo_url: stf.photo_url || null,     // <-- Tambahan
        }

        if (stf.id && typeof stf.id === 'number') {
          await supabase.from('staff').update(payload).eq('id', stf.id)
        } else {
          await supabase.from('staff').insert([payload])
        }
      }

      alert('Berhasil menyimpan data Staff!')
      await fetchAllData()
    } catch (err: any) {
      alert('Gagal menyimpan staff: ' + err.message)
    } finally {
      setLoadingStaff(false)
    }
  }

    // 👉 SISIPKAN DI SINI (Fungsi Upload Foto Staff)
    const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
      const filePath = `public/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('staff-photos')
        .getPublicUrl(filePath)

      const updated = [...staffList]
      updated[idx].photo_url = publicUrl
      setStaffList(updated)

      alert('Foto berhasil di-upload!')
    } catch (error: any) {
      console.error('Gagal upload foto:', error.message)
      alert('Gagal mengupload foto. Pastikan ukuran file tidak terlalu besar.')
    }
  }

  // SAVE SERVICES
  const handleSaveServices = async () => {
    setLoadingServices(true)
    try {
      const { data: existing } = await supabase.from('services').select('id').eq('tenant_id', tenantData.id).eq('is_addon', false)
      const existingIds = (existing || []).map(s => s.id)
      const currentIds = servicesList.filter(s => s.id && typeof s.id === 'number').map(s => s.id)
      const idsToDelete = existingIds.filter(id => !currentIds.includes(id))

      if (idsToDelete.length > 0) {
        await supabase.from('services').delete().in('id', idsToDelete)
      }

      for (const srv of servicesList) {
        const payload = {
          tenant_id: tenantData.id,
          tenant_slug: profileData.tenant_slug || tenantData.tenant_slug,
          client_code: profileData.client_code || profileData.tenant_slug,
          name: srv.name,
          price: Number(srv.price || 0),
          duration: Number(srv.duration || 0),
          desc: srv.desc || '',
          is_addon: false,
        }

        if (srv.id && typeof srv.id === 'number') {
          await supabase.from('services').update(payload).eq('id', srv.id)
        } else {
          await supabase.from('services').insert([payload])
        }
      }

      alert('Berhasil menyimpan Layanan Utama!')
      await fetchAllData()
    } catch (err: any) {
      alert('Gagal menyimpan layanan: ' + err.message)
    } finally {
      setLoadingServices(false)
    }
  }

  const handleUploadServicePhoto = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
  const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `srv_${Date.now()}.${fileExt}`
      const filePath = `public/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('service-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('service-photos')
        .getPublicUrl(filePath)

      const updated = [...servicesList]
      updated[idx].image_url = publicUrl
      setServicesList(updated)

      alert('Foto layanan berhasil di-upload!')
    } catch (error: any) {
      console.error('Gagal upload foto layanan:', error.message)
      alert('Gagal mengupload foto.')
    }
  }

  // SAVE ADD-ONS (Dual-Sync: Tabel Services + Kolom JSONB Tenants)
const handleSaveAddons = async () => {
  console.log("Tombol simpan add-ons diklik!", addonsList)
  setLoadingAddons(true)
  try {
    if (!tenantData?.id) {
      alert("Error: ID Tenant tidak ditemukan!")
      setLoadingAddons(false)
      return
    }

    // 1. Sinkronisasi ke tabel 'services' (untuk multi add-on berbasis baris)
    const { data: existing, error: fetchError } = await supabase
      .from('services')
      .select('id')
      .eq('tenant_id', tenantData.id)
      .eq('is_addon', true)

    if (fetchError) throw fetchError

    const existingIds = (existing || []).map(s => s.id)
    const currentIds = addonsList.filter((s: any) => s.id && typeof s.id === 'number').map(s => s.id)
    const idsToDelete = existingIds.filter(id => !currentIds.includes(id))

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase.from('services').delete().in('id', idsToDelete)
      if (deleteError) throw deleteError
    }

    const formattedAddonsForJson = []

    for (const add of addonsList) {
      const payload = {
        tenant_id: tenantData.id,
        tenant_slug: profileData?.tenant_slug || tenantData?.tenant_slug || '',
        client_code: profileData?.client_code || tenantData?.client_code || '',
        name: add.name || '',
        price: Number(add.price || 0),
        duration: Number(add.duration || 0),
        desc: add.desc || '',
        is_addon: true,
      }

      if (add.id && typeof add.id === 'number') {
        const { error: updateError } = await supabase.from('services').update(payload).eq('id', add.id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase.from('services').insert([payload]).select()
        if (insertError) throw insertError
        if (inserted && inserted[0]) {
          add.id = inserted[0].id
        }
      }

      // Kumpulkan data untuk format JSONB tenants.addons
      formattedAddonsForJson.push({
        label: add.name || '',
        price: Number(add.price || 0),
        desc: add.desc || '',
        duration: Number(add.duration || 0)
      })
    }

    // 2. SYNC KE KOLOM 'addons' DI TABEL 'tenants' (Supaya halaman booking publik langsung baca)
    const { error: tenantError } = await supabase
      .from('tenants')
      .update({ 
        addons: formattedAddonsForJson,
        show_extra_addon: true 
      })
      .eq('id', tenantData.id)

    if (tenantError) throw tenantError

    alert('Berhasil menyimpan Add-ons!')
    if (typeof fetchAllData === 'function') {
      await fetchAllData()
    }
  } catch (err: any) {
    console.error('Error detail saat save addons:', err)
    alert('Gagal menyimpan add-ons: ' + (err.message || JSON.stringify(err)))
  } finally {
    setLoadingAddons(false)
  }
}

  // SAVE GENERAL / KEUANGAN
  const handleSaveGeneral = async () => {
    setLoadingGeneral(true)
    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({
          theme_color: generalData.theme_color,
          dp_type: generalData.dp_type,
          dp_value: Number(generalData.dp_value || 0),
          qris_url: generalData.qris_url,
          bank_accounts: generalData.bank_accounts,
          ewallet_accounts: generalData.ewallet_accounts,
        })
        .eq('id', tenantData.id)
        .select()
        .single()

      if (error) throw error

      alert('Berhasil menyimpan Pengaturan Keuangan & Pembayaran!')
      if (onSaveSuccess && data) {
        onSaveSuccess(data)
      }
      await fetchAllData()
    } catch (err: any) {
      alert('Gagal menyimpan pengaturan: ' + err.message)
    } finally {
      setLoadingGeneral(false)
    }
  }

  // Cek apakah ada perubahan global untuk tombol Close (X)
  const hasAnyUnsavedChanges = () => {
    return (
      JSON.stringify(profileData) !== initialProfile ||
      JSON.stringify(staffList) !== initialStaff ||
      JSON.stringify(servicesList) !== initialServices ||
      JSON.stringify(addonsList) !== initialAddons ||
      JSON.stringify(generalData) !== initialGeneral
    )
  }

  const handleAttemptClose = () => {
    if (hasAnyUnsavedChanges()) {
      setPendingCancelAction(() => onClose)
      setShowConfirmModal(true)
    } else {
      onClose()
    }
  }

  return (
    <div className="bg-[#020408] text-white border border-cyan-500/30 rounded-2xl p-6 relative w-full max-w-4xl shadow-[0_0_40px_rgba(6,182,212,0.15)] space-y-6">
      
      {/* Header Modal, Status Toggle Utama, & Tombol Close (X) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cyan-500/20 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isTenantActive ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></span>
            <h2 className="text-lg font-bold tracking-wide text-white">Kelola Tenant: {profileData.business_name || tenantData.name}</h2>
          </div>
          <p className="text-xs text-cyan-400/70 mt-1 uppercase tracking-wider">{profileData.business_name || tenantData.name} ({profileData.tenant_slug})</p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          {/* Toggle Cepat Status Tenant di Halaman Utama */}
          <div className="flex items-center gap-2 bg-black/60 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
            <span className={`text-xs font-bold ${isTenantActive ? 'text-cyan-400' : 'text-slate-400'}`}>
              {isTenantActive ? '🟢 Tenant Aktif' : '🔴 Tenant Nonaktif'}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isTenantActive} 
                disabled={loadingStatus}
                onChange={(e) => handleToggleTenantActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          <button 
            onClick={handleAttemptClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* NAVIGASI TAB */}
      <div className="flex border-b border-cyan-500/20 gap-2 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'profile' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'}`}
        >
          📁 1. Profil & Branding
        </button>
        <button 
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'staff' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'}`}
        >
          👥 2. Manajemen Staff
        </button>
        <button 
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'services' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'}`}
        >
          🛠️ 3. Layanan Utama
        </button>
        <button 
          onClick={() => setActiveTab('addons')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'addons' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'}`}
        >
          📦 4. Add-ons
        </button>
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'general' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-cyan-400 hover:bg-slate-800'}`}
        >
          💰 5. Keuangan
        </button>
      </div>

      {/* KONTEN BERDASARKAN TAB AKTIF */}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        
        {/* ================= TAB 1: PROFIL & BRANDING ================= */}
        {activeTab === 'profile' && (
          <div className="border border-cyan-500/30 bg-[#070b14] p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 border-b border-cyan-500/20 pb-3">📁 Informasi Identitas & Branding Tenant</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Nama Bisnis (business_name)</label>
                <input 
                  type="text" 
                  value={profileData.business_name} 
                  onChange={(e) => setProfileData({...profileData, business_name: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Tenant Slug (tenant_slug)</label>
                <input 
                  type="text" 
                  value={profileData.tenant_slug} 
                  onChange={(e) => setProfileData({...profileData, tenant_slug: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Client Code (client_code)</label>
                <input 
                  type="text" 
                  value={profileData.client_code} 
                  onChange={(e) => setProfileData({...profileData, client_code: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Domain URL (domain_url)</label>
                <input 
                  type="text" 
                  placeholder="https://..."
                  value={profileData.domain_url} 
                  onChange={(e) => setProfileData({...profileData, domain_url: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Kategori (category)</label>
                <input 
                  type="text" 
                  value={profileData.category} 
                  onChange={(e) => setProfileData({...profileData, category: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Label Staff (staff_label)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Capster / Dokter"
                  value={profileData.staff_label} 
                  onChange={(e) => setProfileData({...profileData, staff_label: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
              
              {/* Logo URL dengan Choose File */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Logo URL (logo_url)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="https://..." 
                    value={profileData.logo_url || ''} 
                    onChange={(e) => setProfileData({ ...profileData, logo_url: e.target.value })}
                    className="bg-black border border-cyan-500/30 p-2.5 rounded-lg text-xs flex-1 text-white focus:border-cyan-400 outline-none"
                  />
                  <div className="bg-black border border-cyan-500/30 p-1.5 rounded-lg">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleUploadLogo}
                      className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Control Center Label (control_center_label)</label>
                <input 
                  type="text" 
                  value={profileData.control_center_label} 
                  onChange={(e) => setProfileData({...profileData, control_center_label: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Kustom Kalimat Persetujuan / T&C (custom_terms_text)</label>
                <textarea 
                  rows={2}
                  placeholder="Saya menyetujui ketentuan layanan dan konfirmasi data yang diberikan sudah benar."
                  value={profileData.custom_terms_text || ''} 
                  onChange={(e) => setProfileData({...profileData, custom_terms_text: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none resize-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Kalimat ini akan tampil di samping checkbox persetujuan pada halaman booking publik tenant bersangkutan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => handleCheckAndCancel(JSON.stringify(profileData), initialProfile, revertProfile)}
                className="bg-black text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={loadingProfile}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {loadingProfile ? 'Menyimpan...' : 'Simpan Profil & Branding'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: STAFF ================= */}
        {activeTab === 'staff' && (
          <div className="border border-cyan-500/30 bg-[#070b14] p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">👥 Manajemen Staff</h3>
              <button 
                onClick={() => setStaffList([...staffList, { 
                  name: '', 
                  role: profileData.staff_label || 'Staff', 
                  is_active: true, 
                  max_slots: 1, 
                  phone: '', 
                  photo_url: '' 
                }])}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              >
                + Tambah Staff
              </button>
            </div>

            <div className="space-y-3">
              {staffList.map((stf, idx) => (
                <div key={stf.id || idx} className="bg-[#020408] p-3 rounded-lg border border-cyan-500/20 space-y-3">
                  {/* Baris Pertama: Nama, Role, Max Slot, Status Aktif, & Tombol Hapus */}
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      placeholder="Nama Staff" 
                      value={stf.name} 
                      onChange={(e) => {
                        const updated = [...staffList]
                        updated[idx].name = e.target.value
                        setStaffList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm flex-1 text-white focus:border-cyan-400 outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Role / Jabatan" 
                      value={stf.role} 
                      onChange={(e) => {
                        const updated = [...staffList]
                        updated[idx].role = e.target.value
                        setStaffList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm flex-1 text-white focus:border-cyan-400 outline-none"
                    />
                    <input 
                      type="number" 
                      min="1"
                      placeholder="Max Slot" 
                      title="Maksimal slot booking bersamaan"
                      value={stf.max_slots || 1} 
                      onChange={(e) => {
                        const updated = [...staffList]
                        updated[idx].max_slots = parseInt(e.target.value) || 1
                        setStaffList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm w-24 text-white focus:border-cyan-400 outline-none"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={stf.is_active} 
                        onChange={(e) => {
                          const updated = [...staffList]
                          updated[idx].is_active = e.target.checked
                          setStaffList(updated)
                        }}
                        className="rounded bg-black border-cyan-500 text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                      Aktif
                    </label>
                    <button 
                      onClick={() => setStaffList(staffList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 p-1 text-sm font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Baris Kedua: No HP & Tombol Upload Foto */}
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      placeholder="Nomor HP (Cth: 0812... / 62812...)" 
                      value={stf.phone || ''} 
                      onChange={(e) => {
                        const updated = [...staffList]
                        updated[idx].phone = e.target.value
                        setStaffList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-xs flex-1 text-white focus:border-cyan-400 outline-none"
                    />
                    
                    {/* Input File untuk Upload ke Supabase Storage */}
                    <div className="flex items-center gap-2 flex-[2] bg-black border border-cyan-500/30 p-1.5 rounded-lg">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleUploadPhoto(e, idx)}
                        className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer w-full"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {staffList.length === 0 && <p className="text-xs text-slate-500 italic">Belum ada staff terdaftar.</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => handleCheckAndCancel(JSON.stringify(staffList), initialStaff, revertStaff)}
                className="bg-black text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveStaff}
                disabled={loadingStaff}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {loadingStaff ? 'Menyimpan...' : 'Simpan Staff'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 3: LAYANAN UTAMA ================= */}
        {activeTab === 'services' && (
          <div className="border border-cyan-500/30 bg-[#070b14] p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">🛠️ Manajemen Layanan Utama (Services)</h3>
              <button 
                onClick={() => setServicesList([...servicesList, { 
                  name: '', 
                  price: 0, 
                  duration: 30, 
                  description: '', 
                  image_url: '' 
                }])}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              >
                + Tambah Layanan
              </button>
            </div>

            <div className="space-y-4">
              {servicesList.map((srv, idx) => (
                <div key={srv.id || idx} className="bg-[#020408] p-4 rounded-xl border border-cyan-500/20 space-y-3">
                  
                  {/* Baris 1: Nama Layanan, Harga, Durasi, Tombol Hapus */}
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Nama Layanan</label>
                      <input 
                        type="text" 
                        placeholder="Cth: Glowing Express Treatment" 
                        value={srv.name} 
                        onChange={(e) => {
                          const updated = [...servicesList]
                          updated[idx].name = e.target.value
                          setServicesList(updated)
                        }}
                        className="w-full bg-black border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <label className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Harga (Rp)</label>
                      <input 
                        type="number" 
                        placeholder="250000" 
                        value={srv.price || 0} 
                        onChange={(e) => {
                          const updated = [...servicesList]
                          updated[idx].price = parseInt(e.target.value) || 0
                          setServicesList(updated)
                        }}
                        className="w-full bg-black border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Durasi (Mnt)</label>
                      <input 
                        type="number" 
                        placeholder="45" 
                        value={srv.duration || 30} 
                        onChange={(e) => {
                          const updated = [...servicesList]
                          updated[idx].duration = parseInt(e.target.value) || 30
                          setServicesList(updated)
                        }}
                        className="w-full bg-black border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => setServicesList(servicesList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 p-1 text-sm font-bold cursor-pointer mt-5"
                      title="Hapus Layanan"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Baris 2: Deskripsi Detail Paket (Konek ke field .desc) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Deskripsi Detail Layanan</label>
                    <textarea 
                      rows={2}
                      placeholder="Jelaskan detail fasilitas atau tahapan treatment paket ini..." 
                      value={srv.desc || ''} 
                      onChange={(e) => {
                        const updated = [...servicesList]
                        updated[idx].desc = e.target.value
                        setServicesList(updated)
                      }}
                      className="w-full bg-black border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none resize-none"
                    />
                  </div>

                  {/* Baris 3: Upload Foto Layanan */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">Foto / Gambar Layanan</label>
                    <div className="flex gap-2 items-center bg-black border border-cyan-500/30 p-1.5 rounded-lg">
                      <input 
                        type="text" 
                        placeholder="URL Foto Layanan (https://...)" 
                        value={srv.image_url || ''} 
                        onChange={(e) => {
                          const updated = [...servicesList]
                          updated[idx].image_url = e.target.value
                          setServicesList(updated)
                        }}
                        className="bg-transparent border-none p-1 text-xs flex-1 text-white outline-none"
                      />
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleUploadServicePhoto(e, idx)}
                        className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                      />
                    </div>
                  </div>

                </div>
              ))}
              {servicesList.length === 0 && <p className="text-xs text-slate-500 italic">Belum ada layanan utama terdaftar.</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => handleCheckAndCancel(JSON.stringify(servicesList), initialServices, revertServices)}
                className="bg-black text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveServices}
                disabled={loadingServices}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {loadingServices ? 'Menyimpan...' : 'Simpan Layanan Utama'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 4: ADD-ONS ================= */}
        {activeTab === 'addons' && (
          <div className="border border-cyan-500/30 bg-[#070b14] p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">📦 Manajemen Add-ons</h3>
              <button 
                onClick={() => setAddonsList([...addonsList, { name: '', price: 0, duration: 15, desc: '', is_addon: true }])}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              >
                + Tambah Add-on
              </button>
            </div>

            <div className="space-y-3">
              {addonsList.map((add, idx) => (
                <div key={add.id || idx} className="bg-[#020408] p-3 rounded-lg border border-cyan-500/20 space-y-2">
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      placeholder="Nama Add-on" 
                      value={add.name} 
                      onChange={(e) => {
                        const updated = [...addonsList]
                        updated[idx].name = e.target.value
                        setAddonsList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm flex-2 text-white focus:border-cyan-400 outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Harga (Rp)" 
                      value={add.price} 
                      onChange={(e) => {
                        const updated = [...addonsList]
                        updated[idx].price = e.target.value
                        setAddonsList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm flex-1 text-white focus:border-cyan-400 outline-none"
                    />
                    <input 
                      type="number" 
                      placeholder="Durasi (menit)" 
                      value={add.duration} 
                      onChange={(e) => {
                        const updated = [...addonsList]
                        updated[idx].duration = e.target.value
                        setAddonsList(updated)
                      }}
                      className="bg-black border border-cyan-500/30 p-2 rounded-lg text-sm flex-1 text-white focus:border-cyan-400 outline-none"
                    />
                    <button 
                      onClick={() => setAddonsList(addonsList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-300 p-1 text-sm font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Deskripsi singkat add-on..." 
                    value={add.desc || ''} 
                    onChange={(e) => {
                      const updated = [...addonsList]
                      updated[idx].desc = e.target.value
                      setAddonsList(updated)
                    }}
                    className="w-full bg-black border border-cyan-500/20 p-2 rounded-lg text-xs text-slate-300 focus:border-cyan-400 outline-none"
                  />
                </div>
              ))}
              {addonsList.length === 0 && <p className="text-xs text-slate-500 italic">Belum ada add-ons terdaftar.</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => handleCheckAndCancel(JSON.stringify(addonsList), initialAddons, revertAddons)}
                className="bg-black text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveAddons}
                disabled={loadingAddons}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {loadingAddons ? 'Menyimpan...' : 'Simpan Add-ons'}
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 5: KEUANGAN & PEMBAYARAN ================= */}
        {activeTab === 'general' && (
          <div className="border border-cyan-500/30 bg-[#070b14] p-5 rounded-xl space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">💰 Keuangan & Pembayaran</h3>
            
            {/* Pengaturan Utama: DP & QRIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-cyan-400 block mb-1">Tipe DP (dp_type)</label>
                <select 
                  value={generalData.dp_type} 
                  onChange={(e) => setGeneralData({...generalData, dp_type: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                >
                  <option value="PERCENTAGE">PERCENTAGE (%)</option>
                  <option value="FIXED">FIXED AMOUNT (Rp)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-cyan-400 block mb-1">Nilai DP (dp_value)</label>
                <input 
                  type="number" 
                  value={generalData.dp_value} 
                  onChange={(e) => setGeneralData({...generalData, dp_value: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-cyan-400 block mb-1">QRIS URL</label>
                <input 
                  type="text" 
                  placeholder="https://..." 
                  value={generalData.qris_url} 
                  onChange={(e) => setGeneralData({...generalData, qris_url: e.target.value})}
                  className="w-full bg-black border border-cyan-500/30 p-2.5 rounded-lg text-sm text-white focus:border-cyan-400 outline-none"
                />
              </div>
            </div>

            {/* ================= REKENING BANK (bank_accounts) ================= */}
            <div className="border-t border-cyan-500/20 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">Daftar Rekening Bank (bank_accounts)</label>
                <button
                  type="button"
                  onClick={() => {
                    const currentBanks = Array.isArray(generalData.bank_accounts) ? generalData.bank_accounts : [];
                    setGeneralData({
                      ...generalData,
                      bank_accounts: [...currentBanks, { bank_name: '', account_number: '', holder_name: '' }]
                    });
                  }}
                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  + Tambah Bank
                </button>
              </div>

              {(Array.isArray(generalData.bank_accounts) ? generalData.bank_accounts : []).map((bank: any, index: number) => (
                <div key={index} className="p-3 bg-black border border-cyan-500/20 rounded-xl space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => {
                      const currentBanks = [...generalData.bank_accounts];
                      currentBanks.splice(index, 1);
                      setGeneralData({ ...generalData, bank_accounts: currentBanks });
                    }}
                    className="absolute top-2 right-3 text-slate-500 hover:text-red-400 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                    <input
                      type="text"
                      placeholder="Nama Bank (Cth: BCA)"
                      value={bank.bank_name || ''}
                      onChange={(e) => {
                        const currentBanks = [...generalData.bank_accounts];
                        currentBanks[index].bank_name = e.target.value;
                        setGeneralData({ ...generalData, bank_accounts: currentBanks });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Nomor Rekening"
                      value={bank.account_number || ''}
                      onChange={(e) => {
                        const currentBanks = [...generalData.bank_accounts];
                        currentBanks[index].account_number = e.target.value;
                        setGeneralData({ ...generalData, bank_accounts: currentBanks });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Atas Nama (A/N)"
                      value={bank.holder_name || ''}
                      onChange={(e) => {
                        const currentBanks = [...generalData.bank_accounts];
                        currentBanks[index].holder_name = e.target.value;
                        setGeneralData({ ...generalData, bank_accounts: currentBanks });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ================= E-WALLET ACCOUNTS (ewallet_accounts) ================= */}
            <div className="border-t border-cyan-500/20 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300">Daftar E-Wallet (ewallet_accounts)</label>
                <button
                  type="button"
                  onClick={() => {
                    const currentWallets = Array.isArray(generalData.ewallet_accounts) ? generalData.ewallet_accounts : [];
                    setGeneralData({
                      ...generalData,
                      ewallet_accounts: [...currentWallets, { wallet_name: '', phone_number: '', holder_name: '' }]
                    });
                  }}
                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  + Tambah E-Wallet
                </button>
              </div>

              {(Array.isArray(generalData.ewallet_accounts) ? generalData.ewallet_accounts : []).map((wallet: any, index: number) => (
                <div key={index} className="p-3 bg-black border border-cyan-500/20 rounded-xl space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => {
                      const currentWallets = [...generalData.ewallet_accounts];
                      currentWallets.splice(index, 1);
                      setGeneralData({ ...generalData, ewallet_accounts: currentWallets });
                    }}
                    className="absolute top-2 right-3 text-slate-500 hover:text-red-400 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                    <input
                      type="text"
                      placeholder="E-Wallet (Cth: DANA)"
                      value={wallet.wallet_name || ''}
                      onChange={(e) => {
                        const currentWallets = [...generalData.ewallet_accounts];
                        currentWallets[index].wallet_name = e.target.value;
                        setGeneralData({ ...generalData, ewallet_accounts: currentWallets });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Nomor HP / Akun"
                      value={wallet.phone_number || ''}
                      onChange={(e) => {
                        const currentWallets = [...generalData.ewallet_accounts];
                        currentWallets[index].phone_number = e.target.value;
                        setGeneralData({ ...generalData, ewallet_accounts: currentWallets });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Atas Nama (A/N)"
                      value={wallet.holder_name || ''}
                      onChange={(e) => {
                        const currentWallets = [...generalData.ewallet_accounts];
                        currentWallets[index].holder_name = e.target.value;
                        setGeneralData({ ...generalData, ewallet_accounts: currentWallets });
                      }}
                      className="bg-[#070b14] border border-cyan-500/30 p-2 rounded-lg text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Tombol Aksi Batal & Simpan */}
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => handleCheckAndCancel(JSON.stringify(generalData), initialGeneral, revertGeneral)}
                className="bg-black text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveGeneral}
                disabled={loadingGeneral}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50"
              >
                {loadingGeneral ? 'Menyimpan...' : 'Simpan Pengaturan Keuangan'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* POP-UP KONFIRMASI DISCARD CHANGES */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#020408] border border-cyan-500/40 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-[0_0_40px_rgba(6,182,212,0.25)]">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto text-lg font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              i
            </div>
            <div>
              <h4 className="text-lg font-bold text-white tracking-wide">Buang Perubahan?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Ada konfigurasi fitur yang belum tersimpan. Yakin ingin keluar tanpa menyimpan?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-black text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-400 transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.1)]"
              >
                Lanjut Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false)
                  if (pendingCancelAction) {
                    pendingCancelAction()
                    setPendingCancelAction(null)
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#070b14] hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
              >
                Ya, Buang
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}