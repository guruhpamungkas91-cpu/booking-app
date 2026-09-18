// ============================================================================
// 1. IMPORTS & INITIALIZATION
// ============================================================================
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isPostgrestError } from '@/lib/errorHandler';

// ============================================================================
// 2. TYPES & INTERFACES
// ============================================================================
interface Tenant {
  id?: string;
  name?: string;
  custom_dashboard_theme?: string;
  [key: string]: any; // Boleh pakai index signature jika propertinya dinamis banget, tapi lebih baik didefinisikan eksplisit
}

export interface Reservation {
  id: number
  created_at: string
  customer_name: string
  whatsapp_number: string
  service_name: string
  staff_name?: string
  staff?: string // Ditambahkan untuk backward compatibility data lama
  booking_date: string
  booking_time: string
  payment_method?: string
  status: string
  tenant_id?: string
  total_price?: number
  item_price?: number // Ditambahkan untuk mengamankan fungsi getItemPrice
  price?: number      // Ditambahkan sebagai alternatif properti harga
  [key: string]: any  // Index signature pengaman untuk properti dinamis lain dari database
}

interface BlockedSlot {
  id?: number
  created_at?: string
  tenant_id?: string
  block_date: string
  block_end_date?: string;
  block_time: string
  reason?: string
}

interface BusinessDataItem {
  label: string;
  value: string;
  amount: string;
  rawAmount: number;
}

interface StaffItem {
  name: string;
  count: number;
}

type SortField = 'booking_date' | 'booking_time' | 'customer_name' | 'service_name' | 'staff_name' | 'price' | 'payment_method' | 'status'
type SortOrder = 'asc' | 'desc'
type SubscriptionPlanType = 'PROFESIONAL' | 'ULTIMATE'
type BusinessType = 'eyelash' | 'barber'
type ThemeMode = 'purple' | 'pink' | 'amber' | 'emerald' | 'blue' | 'indigo' | 'green';

// Deklarasikan objek warna di luar komponen agar bersih dari error scope
const GLOBAL_THEME_3D_COLORS: Record<ThemeMode, { top: string; body: string; glow: string }> = {
  purple: { top: 'from-purple-400 to-indigo-300', body: 'from-purple-600/80 via-indigo-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]' },
  pink: { top: 'from-pink-400 to-rose-300', body: 'from-pink-600/80 via-rose-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]' },
  amber: { top: 'from-amber-400 to-yellow-300', body: 'from-amber-600/80 via-yellow-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]' },
  emerald: { top: 'from-emerald-400 to-teal-300', body: 'from-emerald-600/80 via-teal-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
  blue: { top: 'from-blue-400 to-cyan-300', body: 'from-blue-600/80 via-cyan-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]' },
  indigo: { top: 'from-blue-400 to-indigo-300', body: 'from-blue-600/80 via-indigo-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.3)]' },
  green: { top: 'from-emerald-400 to-teal-300', body: 'from-emerald-600/80 via-teal-500/70 to-zinc-950/90', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' },
};

// 💡 TIPS: Karena isi theme3DColors dan themeStaff3DColors sama persis dengan GLOBAL_THEME_3D_COLORS,
// Kamu bisa langsung mapping ke sana, atau tulis manual seperti di bawah ini persis di bawah GLOBAL_THEME_3D_COLORS:

const theme3DColors = GLOBAL_THEME_3D_COLORS;
const themeStaff3DColors = GLOBAL_THEME_3D_COLORS;

// ============================================================================
// 3. HELPER FUNCTIONS & CONSTANTS
// ============================================================================
const SERVICE_PRICES: Record<string, number> = {
  'Potong Rambut': 50000,
  'Coloring': 120000,
  'Creambath': 75000,
  'Shaving': 35000,
  'Natural Eyelash': 120000,
  'Single Lash Extension': 135000,
  'Russian Volume': 180000,
  'Cat Eye Style': 160000,
  'Lash Lift & Tint': 100000,
  'Retouch Eyelash': 75000,
  'Remove Eyelash': 40000,
}

// ============================================================================
// 4. MAIN DASHBOARD COMPONENT & STATES
// ============================================================================
export default function AdminDashboard() {
  console.log("🔥 HALAMAN ADMIN BERHASIL DIRENDER OLEH NEXT.JS!");
  const params = useParams()
  const tenantSlug = (params?.tenant_slug as string) || ''

  const [isInitializing, setIsInitializing] = useState<boolean>(true)
  
  const [brandTitle, setBrandTitle] = useState<string>('Memuat...')
  const [businessType, setBusinessType] = useState<string>('barbershop')
  const [staffLabel, setStaffLabel] = useState<string>('Staff')
  const [staffList, setStaffList] = useState<any[]>([]);
  const [controlCenterLabel, setControlCenterLabel] = useState<string>('Control Center')

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantCode, setTenantCode] = useState<string>('')
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [financialReportsEnabled, setFinancialReportsEnabled] = useState<boolean>(false)
  
  const [businessFilter, setBusinessFilter] = useState<string>('bulanan');
  const [businessMonth, setBusinessMonth] = useState(String(new Date().getMonth() + 1));
  const [businessYear, setBusinessYear] = useState(String(new Date().getFullYear()));

  // State baru untuk Performa Staff (biar punya filter bulan & tahun sendiri)
  const [staffMonth, setStaffMonth] = useState(String(new Date().getMonth() + 1));
  const [staffYear, setStaffYear] = useState(String(new Date().getFullYear()));
  
  const [businessPerformanceEnabled, setBusinessPerformanceEnabled] = useState<boolean>(true);
  const [staffPerformanceEnabled, setStaffPerformanceEnabled] = useState<boolean>(false)
  const [slotBlockingEnabled, setSlotBlockingEnabled] = useState<boolean>(true)
  const [enableMaintenanceFeature, setEnableMaintenanceFeature] = useState<boolean>(false) 
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false) 
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanType>('PROFESIONAL')
  const [isSuperAdminToggleActive, setIsSuperAdminToggleActive] = useState<boolean>(false)
  const [isCustomThemeActive, setIsCustomThemeActive] = useState<boolean>(false)
  
  const [enableCustomTheme, setEnableCustomTheme] = useState<boolean>(false);

  const [selectedMode, setSelectedMode] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('admin_theme_mode');
      if (savedMode === 'light' || savedMode === 'dark') return savedMode;
    }
    return 'dark';
  });

  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('admin_color_theme');
      if (savedTheme) return savedTheme as ThemeMode;
    }
    return 'purple';
  });

  useEffect(() => {
    if (currentTenant) {
      setEnableCustomTheme(Boolean(currentTenant.custom_dashboard_theme));
    }
  }, [currentTenant]);

  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [blockDateInput, setBlockDateInput] = useState('')
  const [blockStartDate, setBlockStartDate] = useState('')
  const [blockEndDate, setBlockEndDate] = useState('')
  const [blockMode, setBlockMode] = useState('fullday')
  const [blockTimeInput, setBlockTimeInput] = useState('10:00')
  const [reasonPreset, setReasonPreset] = useState('Libur Lebaran')
  const [blockReasonInput, setBlockReasonInput] = useState('')
  const [isBlocking, setIsBlocking] = useState(false)

  const [isReservationsModalOpen, setIsReservationsModalOpen] = useState(false);
  const [customerReservations, setCustomerReservations] = useState<BlockedSlot[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const [limit, setLimit] = useState<number | 'all'>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const [sortField, setSortField] = useState<SortField>('booking_date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [cancelModalItem, setCancelModalItem] = useState<Reservation | null>(null)

  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  // ============================================================================
  // 5. AUXILIARY UTILITY FUNCTIONS
  // ============================================================================
  const getServicePrice = useCallback((serviceName?: string): number => {
    if (!serviceName) return businessType === 'eyelash' ? 120000 : 50000
    if (serviceName.includes(',')) {
      const parts = serviceName.split(',').map((s) => s.trim().toLowerCase())
      return parts.reduce((acc, curr) => {
        const matchedKey = Object.keys(SERVICE_PRICES).find(
          (key) => key.toLowerCase() === curr
        )
        const price = matchedKey 
          ? SERVICE_PRICES[matchedKey] 
          : (businessType === 'eyelash' ? 120000 : 50000)
        return acc + price
      }, 0)
    }
    const matchedKey = Object.keys(SERVICE_PRICES).find(
      (key) => key.toLowerCase() === serviceName.trim().toLowerCase()
    )
    return matchedKey ? SERVICE_PRICES[matchedKey] : (businessType === 'eyelash' ? 120000 : 50000)
  }, [businessType])

  const getItemPrice = useCallback((item: Reservation): number => {
    if (item.total_price !== undefined && item.total_price !== null && item.total_price > 0) {
      return item.total_price
    }
    return getServicePrice(item.service_name)
  }, [getServicePrice])

  const formatDateID = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  const isCompleted = (status?: string) => {
    const s = (status || '').toString().trim().toLowerCase()
    return s === 'completed' || s === 'selesai'
  }

  const getWeekRangeFromStart = (startDateString: string) => {
    if (!startDateString) return { startStr: '', endStr: '' }
    const [year, month, day] = startDateString.split('-').map(Number)
    const startDateObj = new Date(year, month - 1, day)

    const endDateObj = new Date(startDateObj)
    endDateObj.setDate(startDateObj.getDate() + 6)

    const formatYMD = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const date = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${date}`
    }

    return {
      startStr: formatYMD(startDateObj),
      endStr: formatYMD(endDateObj),
    }
  }

  const fetchTenantDetail = useCallback(async (searchKey: string) => {
    try {
      if (!searchKey) return
      const target = searchKey.trim()
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

      let query = supabase.from('tenants').select('*')
      if (isUuid) {
        query = query.eq('id', target)
      } else {
        query = query.or(`tenant_slug.eq.${target.toLowerCase()},domain_url.eq.${target.toLowerCase()}`)
      }

      const { data, error } = await query.maybeSingle()
      if (error) {
        console.error('Supabase error:', error)
        return
      }

      if (data) {
        setTenantId(data.id)
        setBrandTitle(data.business_name || data.name || target)
        const dbCategory = (data.category || 'barbershop').toLowerCase()
        setBusinessType(dbCategory)
        setTenantCode(data.tenant_slug)
        setStaffLabel(data.staff_label || 'Capster / Staff')
        setControlCenterLabel(data.control_center_label || '💈 Barber Control Center')
        if (!localStorage.getItem('admin_color_theme') && data.theme_color) {
          setSelectedTheme(data.theme_color as ThemeMode);
        }
        setFinancialReportsEnabled(Boolean(data.financial_reports))
        if (data.subscription_plan) {
          const rawPlan = data.subscription_plan.toUpperCase()
          setSubscriptionPlan(rawPlan === 'ULTIMATE' ? 'ULTIMATE' : 'PROFESIONAL')
        }
        if (data.is_active !== undefined) {
          setIsSuperAdminToggleActive(Boolean(data.is_active))
        } else if (data.super_admin_toggle !== undefined) {
          setIsSuperAdminToggleActive(Boolean(data.super_admin_toggle))
        }
      }
    } catch (err) {
      console.error('Error fetching tenant details:', err)
    }
  }, [])

  // ============================================================================
  // 7. AUTHENTICATION HANDLERS
  // ============================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: currentTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle()

    if (!currentTenant) {
      alert('Tenant tidak ditemukan!')
      setLoading(false)
      return
    }

    if (!currentTenant.admin_email || currentTenant.admin_email.toLowerCase() !== emailInput.toLowerCase()) {
      alert(`Akses Ditolak! Akun "${emailInput}" tidak memiliki izin untuk mengelola tenant ini.`)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    })

    if (error) {
      alert('Login gagal: ' + error.message)
    } else if (data.session) {
      setIsAuthenticated(true)
      setTenantId(currentTenant.id)
      setBrandTitle(currentTenant.business_name || currentTenant.name)
      setBusinessType((currentTenant.category || 'barbershop').toLowerCase())
      setTenantCode(currentTenant.tenant_slug)
      setControlCenterLabel(currentTenant.control_center_label || 'Control Center')
      const savedColorTheme = typeof window !== 'undefined' ? localStorage.getItem('admin_color_theme') : null;
      if (!savedColorTheme) {
        setSelectedTheme((currentTenant.theme_color || 'purple') as ThemeMode);
      }
      if (currentTenant.subscription_plan) {
        const rawPlan = currentTenant.subscription_plan.toUpperCase()
        setSubscriptionPlan(rawPlan === 'ULTIMATE' ? 'ULTIMATE' : 'PROFESIONAL')
      }
      if (currentTenant.super_admin_toggle !== undefined) {
        setIsSuperAdminToggleActive(Boolean(currentTenant.super_admin_toggle))
      } else if (currentTenant.is_super_admin_active !== undefined) {
        setIsSuperAdminToggleActive(Boolean(currentTenant.is_super_admin_active))
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  // ============================================================================
  // 8. BLOCKED SLOTS MANAGEMENT
  // ============================================================================
  const fetchBlockedSlots = useCallback(async () => {
    if (!tenantId) return
    const { data, error } = await supabase
    .from('blocked_slots')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .not('reason', 'ilike', '%Otomatis: Booking Confirmed%')
    .order('block_date', { ascending: true });

    if (!error && data) {
      setBlockedSlots(data)
    }
  }, [tenantId, tenantSlug])

  const handleAddBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockStartDate || !blockEndDate) {
      alert("Pilih tanggal yang ingin diblokir!");
      return;
    }
    if (blockEndDate < blockStartDate) {
      alert("Tanggal selesai tidak boleh lebih awal dari tanggal mulai!");
      return;
    }
    setIsBlocking(true);

    try {
      const finalReason = reasonPreset === 'Lainnya' 
        ? blockReasonInput 
        : (blockReasonInput ? `${reasonPreset} - ${blockReasonInput}` : reasonPreset);

      const payload = {
        tenant_id: tenantId, 
        tenant_slug: tenantSlug,
        date: blockStartDate,
        block_date: blockStartDate,
        block_end_date: blockEndDate,
        block_time: blockMode === 'custom_time' ? blockTimeInput : null,
        start_time: blockMode === 'custom_time' ? blockTimeInput : null,
        reason: finalReason,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('blocked_slots')
        .insert([payload]);

      if (error) throw error;

      setBlockStartDate('');
      setBlockEndDate('');
      setBlockTimeInput('09:00');
      setBlockReasonInput('');
      
      if (typeof fetchBlockedSlots === 'function') {
        fetchBlockedSlots();
      }

      alert("Berhasil memblokir slot/tanggal!");
    } catch (err: unknown) {
      let errorMsg = "Terjadi kesalahan yang tidak diketahui.";
      if (isPostgrestError(err)) {
        errorMsg = err.message || err.details || err.hint;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      } else {
        errorMsg = String(err);
      }
      console.error("Gagal memblokir slot:", err);
      alert("Gagal menyimpan data: " + errorMsg);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleDeleteBlockSlot = async (id?: number) => {
    if (!id) return
    const isConfirmed = window.confirm('Apakah kamu yakin ingin membuka kembali slot jam ini?')
    if (!isConfirmed) return

    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus block slot: ' + error.message)
    } else {
      setBlockedSlots((prev) => prev.filter((item) => item.id !== id))
    }
  }

  const fetchCustomerReservations = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingReservations(true);
    try {
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .ilike('reason', '%Otomatis: Booking Confirmed%')
        .order('block_date', { ascending: false });

      if (error) throw error;
      setCustomerReservations(data || []);
    } catch (err: unknown) {
      console.error("Gagal memuat reservasi pelanggan:", err);
    } finally {
      setIsLoadingReservations(false);
    }
  }, [tenantId, tenantSlug]);

  // ============================================================================
  // 9. RESERVATION DATA OPERATIONS
  // ============================================================================
  const syncConfirmedSlotsToBlocked = useCallback(async (currentReservations: Reservation[]) => {
    if (!tenantId) return
    const confirmedList = currentReservations.filter((r) => {
      const s = (r.status || '').toLowerCase()
      return s === 'confirmed' || s === 'dikonfirmasi'
    })

    if (confirmedList.length === 0) return

    const { data: latestBlocked } = await supabase
      .from('blocked_slots')
      .select('block_date, block_time')
      .eq('tenant_id', tenantId)

    const existingSlots = latestBlocked || []
    let hasNewInsert = false

    for (let i = 0; i < confirmedList.length; i++) {
      const item = confirmedList[i]
      const exists = existingSlots.some((b) => {
        return b.block_date === item.booking_date && b.block_time === item.booking_time
      })

      if (!exists) {
        await supabase.from('blocked_slots').insert([
          {
            tenant_id: tenantId,
            tenant_slug: tenantSlug,
            block_date: item.booking_date,
            date: item.booking_date,
            block_time: item.booking_time,
            start_time: item.booking_time,
            reason: `Otomatis: Booking Confirmed (${item.customer_name || 'Pelanggan'})`
          }
        ])
        hasNewInsert = true
      }
    }

    if (hasNewInsert && typeof fetchBlockedSlots === 'function') {
      fetchBlockedSlots()
    }
  }, [tenantId, tenantSlug, fetchBlockedSlots])

  const fetchReservations = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Gagal mengambil data reservasi: ' + error.message)
    } else {
      const fetchedData = data || []
      setReservations(fetchedData)
      setFilteredReservations(fetchedData)

      if (fetchedData.length > 0) {
        syncConfirmedSlotsToBlocked(fetchedData)
      }
    }
    setLoading(false)
  }, [tenantId, syncConfirmedSlotsToBlocked])

  const updateStatusInDB = async (id: number, newStatus: string) => {
    const targetReservation = reservations.find((r) => r.id === id)

    const { error } = await supabase
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert('Gagal update status: ' + error.message)
    } else {
      if (newStatus === 'confirmed' || newStatus === 'dikonfirmasi') {
        if (targetReservation && tenantId) {
          const exists = blockedSlots.some(
            (b) => b.block_date === targetReservation.booking_date && b.block_time === targetReservation.booking_time
          )
          if (!exists) {
            await supabase.from('blocked_slots').insert([
              {
                tenant_id: tenantId,
                tenant_slug: tenantSlug,
                block_date: targetReservation.booking_date,
                date: targetReservation.booking_date,
                block_time: targetReservation.booking_time,
                start_time: targetReservation.booking_time,
                reason: `Otomatis: Booking Confirmed (${targetReservation.customer_name})`
              }
            ])
          }
        }
      } 
      else if (newStatus.includes('cancelled')) {
        if (targetReservation && tenantId) {
          await supabase
            .from('blocked_slots')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('block_date', targetReservation.booking_date)
            .eq('block_time', targetReservation.booking_time)
        }
      }

      await fetchReservations()
      if (typeof fetchBlockedSlots === 'function') {
        fetchBlockedSlots()
      }
    }
  }

  const handleStatusChange = (item: Reservation, newStatus: string) => {
    if (newStatus === 'cancelled' || newStatus === 'cancelled_need_refund') {
      setCancelModalItem(item)
      return
    }
    updateStatusInDB(item.id, newStatus)
  }

  const handleConfirmCancel = async (needRefund: boolean) => {
    if (!cancelModalItem) return
    const statusText = needRefund ? 'cancelled_need_refund' : 'cancelled'
    await updateStatusInDB(cancelModalItem.id, statusText)
    setCancelModalItem(null)
  }

  const handleCompleteRefund = async (id: number) => {
    const isConfirmed = window.confirm('Apakah kamu yakin refund untuk pesanan ini sudah ditransfer balik ke pelanggan?')
    if (!isConfirmed) return
    await updateStatusInDB(id, 'cancelled_refunded')
  }

  const handleDelete = useCallback(async (id: number, customerName: string) => {
    const isConfirmed = window.confirm(`Apakah kamu yakin ingin menghapus data reservasi atas nama "${customerName}"?`)
    if (!isConfirmed) return

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus data: ' + error.message)
    } else {
      await fetchReservations()
      if (typeof fetchBlockedSlots === 'function') {
        fetchBlockedSlots()
      }
    }
  }, [fetchReservations, fetchBlockedSlots])

  // ============================================================================
  // 10. STATS & REPORT CALCULATIONS (DENGAN DATA AKTUAL UNTUK GRAFIK)
  // ============================================================================
  const stats = useMemo(() => {
    const totalBookings = reservations.length

    const totalRevenue = reservations.reduce((sum, item) => {
      if (isCompleted(item.status)) {
        return sum + getItemPrice(item)
      }
      return sum
    }, 0)

    const pendingCount = reservations.filter((r) => {
      const s = (r.status || '').toString().trim().toLowerCase()
      return s === '' || s === 'pending' || s === 'menunggu'
    }).length

    const confirmedCount = reservations.filter((b) => {
      const s = (b.status || '').toString().trim().toLowerCase()
      return s === 'confirmed' || s === 'dikonfirmasi'
    }).length

    const completedCount = reservations.filter((b) => isCompleted(b.status)).length

    const cancelledCount = reservations.filter((b) => {
      const s = (b.status || '').toString().trim().toLowerCase()
      return s.startsWith('cancelled') || s === 'batal'
    }).length

    const needRefundCount = reservations.filter((b) => {
      return (b.status || '').toLowerCase() === 'cancelled_need_refund'
    }).length

    const staffPerformance: Record<string, number> = {}
    reservations.forEach((item) => {
      if (isCompleted(item.status) && item.staff_name) {
        const staffName = item.staff_name.trim();
        staffPerformance[staffName] = (staffPerformance[staffName] || 0) + 1;
      }
    });

    const staffList = Object.keys(staffPerformance)
      .map((name) => ({
        name,
        count: staffPerformance[name],
      }))
      .sort((a, b) => b.count - a.count)

    let topStaffName = '-'
    let topStaffCount = 0
    if (staffList.length > 0) {
      topStaffName = staffList[0].name
      topStaffCount = staffList[0].count
    }

    return {
      totalBookings,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
      needRefundCount,
      completedPercentage: totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0,
      cancelledPercentage: totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0,
      totalRevenue,
      topStaffName,
      topStaffCount,
      staffList,
    }
  }, [reservations, getItemPrice])

  // Data Aktual untuk Grafik Omzet Usaha
  const actualBusinessData = useMemo<BusinessDataItem[]>(() => {
    const completedRes = reservations.filter(r => isCompleted(r.status));
    
    if (businessFilter === 'mingguan') {
      const map: Record<string, number> = { 'Sen': 0, 'Sel': 0, 'Rab': 0, 'Kam': 0, 'Jum': 0, 'Sab': 0, 'Min': 0 };
      const countMap: Record<string, number> = { 'Sen': 0, 'Sel': 0, 'Rab': 0, 'Kam': 0, 'Jum': 0, 'Sab': 0, 'Min': 0 };
      
      completedRes.forEach(r => {
        if (!r.booking_date) return;
        const d = new Date(r.booking_date);
        const dayIdx = d.getDay();
        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const name = dayNames[dayIdx];
        map[name] = (map[name] || 0) + getItemPrice(r);
        countMap[name] = (countMap[name] || 0) + 1;
      });

      const barKeys = [
        { label: 'Sen', key: 'Sen' },
        { label: 'Sel', key: 'Sel' },
        { label: 'Rab', key: 'Rab' },
        { label: 'Kam', key: 'Kam' },
        { label: 'Jum', key: 'Jum' },
        { label: 'Sab', key: 'Sab' },
        { label: 'Min', key: 'Min' },
      ];

      const maxVal = Math.max(...barKeys.map(b => map[b.key]), 1);
      
      return barKeys.map(b => {
        const amt = map[b.key];
        const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
        return { 
          label: b.label, 
          value: `${countMap[b.key]} transaksi`,
          amount: formattedAmt, 
          rawAmount: amt 
        };
      });

    } else if (businessFilter === 'bulanan') {
      const weekMap = [0, 0, 0, 0];
      const weekCounts = [0, 0, 0, 0];
      
      completedRes.forEach(r => {
        if (!r.booking_date) return;
        const dayNum = new Date(r.booking_date).getDate();
        const weekIdx = Math.min(Math.floor((dayNum - 1) / 7), 3);
        weekMap[weekIdx] += getItemPrice(r);
        weekCounts[weekIdx] += 1;
      });

      const maxVal = Math.max(...weekMap, 1);
      
      return weekMap.map((amt, idx) => {
        const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
        return { 
          label: `Minggu ${idx + 1}`, 
          value: `${weekCounts[idx]} trs`, 
          amount: formattedAmt, 
          rawAmount: amt // 👈 Ditambahkan
        };
      });

    } else {
      const qMap = [0, 0, 0, 0];
      const qCounts = [0, 0, 0, 0];
      
      completedRes.forEach(r => {
        if (!r.booking_date) return;
        const month = new Date(r.booking_date).getMonth();
        const qIdx = Math.floor(month / 3);
        qMap[qIdx] += getItemPrice(r);
        qCounts[qIdx] += 1;
      });

      const maxVal = Math.max(...qMap, 1);
      
      return qMap.map((amt, idx) => {
        const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
        return { 
          label: `Q${idx + 1}`, 
          value: `${qCounts[idx]} trs`, 
          amount: formattedAmt, 
          rawAmount: amt // 👈 Ditambahkan
        };
      });
    }
  }, [reservations, businessFilter, getItemPrice]);

  const reportData = useMemo(() => {
    let weekInfo = { startStr: '', endStr: '' }
    const dateFiltered = reservations.filter((item) => {
      const itemDate = item.booking_date
      if (reportPeriod === 'daily') return itemDate === reportDate
      if (reportPeriod === 'weekly') {
        weekInfo = getWeekRangeFromStart(reportDate)
        return itemDate >= weekInfo.startStr && itemDate <= weekInfo.endStr
      }
      if (reportPeriod === 'monthly') {
        const selectedYearMonth = reportDate.substring(0, 7)
        return itemDate.startsWith(selectedYearMonth)
      }
      if (reportPeriod === 'custom') {
        if (!reportStartDate || !reportEndDate) return true
        return itemDate >= reportStartDate && itemDate <= reportEndDate
      }
      return true
    })

    const financialItems = dateFiltered.filter((item) => {
      const s = (item.status || '').toLowerCase()
      return isCompleted(s) || s.startsWith('cancelled')
    })

    let grossRevenue = 0
    let totalRefund = 0

    financialItems.forEach((item) => {
      const price = getItemPrice(item)
      const s = (item.status || '').toLowerCase()

      if (isCompleted(s)) {
        grossRevenue += price
      } else if (s === 'cancelled_refunded' || s === 'cancelled_need_refund') {
        grossRevenue += price
        totalRefund += price
      }
    })

    const netRevenue = grossRevenue - totalRefund

    return {
      items: financialItems,
      grossRevenue,
      totalRefund,
      netRevenue,
      count: financialItems.length,
      weekInfo: reportPeriod === 'weekly' ? getWeekRangeFromStart(reportDate) : null,
    }
  }, [reservations, reportPeriod, reportDate, reportStartDate, reportEndDate, getItemPrice])

  // ============================================================================
  // 11. EXPORT & PRINT HANDLERS
  // ============================================================================
  const exportReportToCSV = () => {
    if (reportData.items.length === 0) {
      alert('Tidak ada transaksi Completed / Refund pada periode laporan ini!')
      return
    }

    let labelPeriode = ''
    if (reportPeriod === 'daily') labelPeriode = `Harian (${formatDateID(reportDate)})`
    else if (reportPeriod === 'weekly' && reportData.weekInfo) {
      labelPeriode = `Mingguan (${formatDateID(reportData.weekInfo.startStr)} s/d ${formatDateID(reportData.weekInfo.endStr)})`
    } else if (reportPeriod === 'monthly') labelPeriode = `Bulanan (${reportDate.substring(0, 7)})`
    else labelPeriode = `Custom (${formatDateID(reportStartDate)} s/d ${formatDateID(reportEndDate)})`

    const displayBrand = brandTitle || tenantCode || 'BUSINESS'
    const themeColor = selectedTheme === 'pink' ? '#ec4899' : selectedTheme === 'amber' ? '#f59e0b' : selectedTheme === 'emerald' ? '#10b981' : selectedTheme === 'blue' ? '#3b82f6' : '#a855f7'

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th { background-color: ${themeColor}; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #cccccc; padding: 8px; }
          td { border: 1px solid #cccccc; padding: 6px 10px; text-align: left; }
          .num { text-align: right; font-weight: bold; }
          .center { text-align: center; }
          .total-row { background-color: #fef2f2; font-weight: bold; }
          .net-row { background-color: #d1fae5; font-weight: bold; font-size: 13px; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #555555; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="title">LAPORAN KEUANGAN & OMZET NETTO - ${displayBrand}</div>
        <div class="subtitle">Periode: ${labelPeriode} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</div>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal Booking</th>
              <th>Jam</th>
              <th>Nama Pelanggan</th>
              <th>Layanan</th>
              <th>Metode Bayar</th>
              <th>WhatsApp</th>
              <th>Status Transaksi</th>
              <th>Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.items
              .map((item, index) => {
                const harga = getItemPrice(item)
                const s = (item.status || '').toLowerCase()
                const isRefund = s === 'cancelled_refunded' || s === 'cancelled_need_refund'
                return `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td class="center">${item.booking_date}</td>
                  <td class="center">${item.booking_time} WIB</td>
                  <td>${item.customer_name}</td>
                  <td>${item.service_name}</td>
                  <td class="center">${item.payment_method || 'QRIS'}</td>
                  <td>'${item.whatsapp_number}</td>
                  <td class="center" style="color: ${isRefund ? '#dc2626' : '#059669'}; font-weight: bold;">
                    ${isCompleted(s) ? 'COMPLETED' : 'CANCELLED (REFUND)'}
                  </td>
                  <td class="num">Rp ${harga.toLocaleString('id-ID')}</td>
                </tr>
              `
              })
              .join('')}
            <tr class="total-row">
              <td colspan="8" style="text-align: right;">TOTAL OMZET BRUTO:</td>
              <td class="num" style="color: #059669;">Rp ${reportData.grossRevenue.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="total-row">
              <td colspan="8" style="text-align: right; color: #dc2626;">TOTAL REFUND:</td>
              <td class="num" style="color: #dc2626;">- Rp ${reportData.totalRefund.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="net-row">
              <td colspan="8" style="text-align: right; font-weight: bold; color: #065f46;">TOTAL OMZET NETTO:</td>
              <td class="num" style="color: #065f46; font-size: 14px;">Rp ${reportData.netRevenue.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Laporan_Keuangan_${displayBrand}_${reportPeriod.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xls`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintPDF = () => {
    if (reportData.items.length === 0) {
      alert('Tidak ada transaksi Completed / Refund pada periode laporan ini!')
      return
    }

    let labelPeriode = ''
    if (reportPeriod === 'daily') labelPeriode = `Harian (${formatDateID(reportDate)})`
    else if (reportPeriod === 'weekly' && reportData.weekInfo) {
      labelPeriode = `Mingguan (${formatDateID(reportData.weekInfo.startStr)} s/d ${formatDateID(reportData.weekInfo.endStr)})`
    } else if (reportPeriod === 'monthly') labelPeriode = `Bulanan (${reportDate.substring(0, 7)})`
    else labelPeriode = `Custom (${formatDateID(reportStartDate)} s/d ${formatDateID(reportEndDate)})`

    const displayBrand = brandTitle || tenantCode || 'BUSINESS'
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Keuangan ${displayBrand}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
          .header p { margin: 4px 0 0 0; color: #555; font-size: 11px; }
          .info-table { width: 100%; margin-bottom: 15px; font-size: 11px; }
          .info-table td { padding: 3px 0; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          table.data-table th { background-color: #f3f4f6; color: #111; font-weight: bold; border: 1px solid #d1d5db; padding: 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
          table.data-table td { border: 1px solid #e5e7eb; padding: 6px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .summary-box { margin-top: 20px; float: right; width: 45%; }
          .summary-table { width: 100%; border-collapse: collapse; }
          .summary-table td { padding: 5px; border-bottom: 1px solid #e5e7eb; }
          .footer { margin-top: 50px; text-align: right; clear: both; }
          .signature-space { height: 50px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${displayBrand}</h1>
          <p>LAPORAN KEUANGAN & OMZET NETTO</p>
        </div>
        <table class="info-table">
          <tr>
            <td><strong>Periode Laporan:</strong> ${labelPeriode}</td>
            <td class="right"><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID')}</td>
          </tr>
        </table>
        <table class="data-table">
          <thead>
            <tr>
              <th class="center" width="5%">No</th>
              <th class="center" width="12%">Tanggal</th>
              <th class="center" width="10%">Jam</th>
              <th>Nama Pelanggan</th>
              <th>Layanan</th>
              <th class="center">Bayar</th>
              <th class="center">Status</th>
              <th class="right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.items
              .map((item, index) => {
                const harga = getItemPrice(item)
                const s = (item.status || '').toLowerCase()
                const isRefund = s === 'cancelled_refunded' || s === 'cancelled_need_refund'
                return `
                <tr>
                  <td class="center">${index + 1}</td>
                  <td class="center">${item.booking_date}</td>
                  <td class="center">${item.booking_time}</td>
                  <td class="bold">${item.customer_name}</td>
                  <td>${item.service_name}</td>
                  <td class="center">${item.payment_method || 'QRIS'}</td>
                  <td class="center bold" style="color: ${isRefund ? '#dc2626' : '#059669'};">
                    ${isCompleted(s) ? 'COMPLETED' : 'REFUND'}
                  </td>
                  <td class="right bold">Rp ${harga.toLocaleString('id-ID')}</td>
                </tr>
              `
              })
              .join('')}
          </tbody>
        </table>
        <div class="summary-box">
          <table class="summary-table">
            <tr>
              <td>Omzet Bruto:</td>
              <td class="right bold" style="color: #059669;">Rp ${reportData.grossRevenue.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Total Refund:</td>
              <td class="right bold" style="color: #dc2626;">- Rp ${reportData.totalRefund.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="border-top: 2px solid #000; font-size: 12px;">
              <td class="bold">Omzet Netto:</td>
              <td class="right bold" style="color: #065f46;">Rp ${reportData.netRevenue.toLocaleString('id-ID')}</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          <p>Dicetak oleh Admin ${displayBrand}</p>
          <div class="signature-space"></div>
          <p>__________________________</p>
        </div>
        <script>
          window.onload = function() { window.print() }
        </script>
      </body>
      </html>
    `
    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

  // ============================================================================
  // 12. FILTERING, SORTING & PAGINATION LOGIC
  // ============================================================================
  const uniqueServices = useMemo(() => {
    const list = new Set(reservations.map((r) => r.service_name).filter(Boolean))
    return Array.from(list)
  }, [reservations])

  const uniquePayments = useMemo(() => {
    const list = new Set(reservations.map((r) => r.payment_method || 'QRIS').filter(Boolean))
    return Array.from(list)
  }, [reservations])

  useEffect(() => {
    let result = [...reservations]
    const isModeStandard = !isSuperAdminToggleActive

    if (isModeStandard) {
      result = result.slice(0, 5)
    } else {
      if (subscriptionPlan === 'PROFESIONAL') {
        result = result.slice(0, 5)
      } else if (subscriptionPlan === 'ULTIMATE') {
        // Full access
      }
    }

    if (!isModeStandard) {
      if (startDate) result = result.filter((item) => item.booking_date >= startDate)
      if (endDate) result = result.filter((item) => item.booking_date <= endDate)
      if (serviceFilter !== 'all') result = result.filter((item) => item.service_name === serviceFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item) =>
        item.customer_name?.toLowerCase().includes(term) ||
        item.whatsapp_number?.includes(term) ||
        item.service_name?.toLowerCase().includes(term) ||
        item.staff_name?.toLowerCase().includes(term)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((item) => {
        const s = (item.status || 'pending').toLowerCase()
        if (statusFilter === 'cancelled') return s.startsWith('cancelled')
        if (statusFilter === 'cancelled_need_refund') return s === 'cancelled_need_refund'
        return s === statusFilter.toLowerCase()
      })
    }

    if (paymentFilter !== 'all') result = result.filter((item) => (item.payment_method || 'QRIS') === paymentFilter)

    if (!isModeStandard) {
      result.sort((a, b) => {
        let valA: any = ''
        let valB: any = ''

        if (sortField === 'booking_date') {
          valA = a.booking_date
          valB = b.booking_date
        } else if (sortField === 'booking_time') {
          valA = a.booking_time
          valB = b.booking_time
        } else if (sortField === 'customer_name') {
          valA = (a.customer_name || '').toLowerCase()
          valB = (b.customer_name || '').toLowerCase()
        } else if (sortField === 'service_name') {
          valA = (a.service_name || '').toLowerCase()
          valB = (b.service_name || '').toLowerCase()
        } else if (sortField === 'staff_name') {
          valA = (a.staff_name || '').toLowerCase()
          valB = (b.staff_name || '').toLowerCase()
        } else if (sortField === 'price') {
          valA = getItemPrice(a)
          valB = getItemPrice(b)
        } else if (sortField === 'payment_method') {
          valA = (a.payment_method || 'QRIS').toLowerCase()
          valB = (b.payment_method || 'QRIS').toLowerCase()
        } else if (sortField === 'status') {
          valA = (a.status || 'pending').toLowerCase()
          valB = (b.status || 'pending').toLowerCase()
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    setFilteredReservations(result)
    setCurrentPage(1)
  }, [startDate, endDate, statusFilter, serviceFilter, paymentFilter, searchTerm, sortField, sortOrder, reservations, subscriptionPlan, isSuperAdminToggleActive, getItemPrice])

  const totalPages = useMemo(() => {
    if (limit === 'all' || !isSuperAdminToggleActive) return 1
    return Math.ceil(filteredReservations.length / limit) || 1
  }, [filteredReservations.length, limit, isSuperAdminToggleActive])

  const displayedReservations = useMemo(() => {
    if (limit === 'all' || !isSuperAdminToggleActive) return filteredReservations
    const startIndex = (currentPage - 1) * limit
    return filteredReservations.slice(startIndex, startIndex + limit)
  }, [filteredReservations, currentPage, limit, isSuperAdminToggleActive])

  const handleSort = (field: SortField) => {
    if (!isSuperAdminToggleActive) return
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ============================================================================
  // 13. LIFECYCLE EFFECTS (DIPERBAIKI & AMAN DARI INFINITE LOOP)
  // ============================================================================
  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      if (!tenantSlug) return;
      
      try {
        setIsInitializing(true)
        
        // 1. Ambil data tenant
        const { data: currentTenant, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('tenant_slug', tenantSlug)
          .maybeSingle()

        if (tenantError) {
          console.error("Error fetching tenant:", tenantError);
        }

        if (!currentTenant) {
          if (isMounted) {
            setIsInitializing(false);
          }
          return;
        }

        if (isMounted) {
          setCurrentTenant(currentTenant)
          setTenantId(currentTenant.id)
          setBrandTitle(currentTenant.business_name || currentTenant.name)
          setBusinessType((currentTenant.category || 'barbershop').toLowerCase())
          setTenantCode(currentTenant.tenant_slug)
          setControlCenterLabel(currentTenant.control_center_label || 'Control Center')

          const savedColorTheme = typeof window !== 'undefined' ? localStorage.getItem('admin_color_theme') : null;
          if (!savedColorTheme) {
            setSelectedTheme((currentTenant.theme_color || 'purple') as ThemeMode);
          }

          setFinancialReportsEnabled(Boolean(currentTenant.financial_reports))
          setStaffPerformanceEnabled(Boolean(currentTenant.staff_performance))
          setBusinessPerformanceEnabled(Boolean(currentTenant.business_performance ?? true));
          setSlotBlockingEnabled(currentTenant.enable_slot_blocking ?? false);
          
          setEnableMaintenanceFeature(Boolean(currentTenant.is_system_maintenance || currentTenant.enable_maintenance_feature))
          setIsMaintenanceMode(Boolean(currentTenant.is_maintenance_mode))
          setMaintenanceMessage(currentTenant.maintenance_message || '')

          if (currentTenant.subscription_plan) {
            setSubscriptionPlan(currentTenant.subscription_plan.toUpperCase() === 'ULTIMATE' ? 'ULTIMATE' : 'PROFESIONAL')
          }

          const activeToggle = currentTenant.super_admin_toggle ?? currentTenant.is_super_admin_active ?? currentTenant.is_active;
          if (activeToggle !== undefined) {
            setIsSuperAdminToggleActive(Boolean(activeToggle));
          }

          if (currentTenant.custom_dashboard_theme !== undefined) {
            setIsCustomThemeActive(Boolean(currentTenant.custom_dashboard_theme))
          }
        }

        // 2. Cek Sesi Auth User
        const { data: authData } = await supabase.auth.getSession()
        
        if (authData?.session) {
          const userEmail = authData.session.user.email
          if (currentTenant.admin_email && currentTenant.admin_email.toLowerCase() !== userEmail?.toLowerCase()) {
            await supabase.auth.signOut()
            if (isMounted) {
              setIsAuthenticated(false)
              alert(`Akses Ditolak! Akun "${userEmail}" tidak memiliki izin untuk mengelola tenant ini.`)
            }
          } else {
            if (isMounted) {
              setIsAuthenticated(true)
            }
          }
        }

      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [tenantSlug])

  // Efek terpisah khusus untuk fetch data turunan saat tenantId sudah ada
  useEffect(() => {
    if (tenantId) {
      fetchReservations()
      fetchBlockedSlots()
    }
  }, [tenantId]) // Sengaja fungsi fetch tidak dimasukkan ke dependency untuk mencegah infinite loop

  // ============================================================================
  // 14. DYNAMIC THEME SYSTEM COMPUTATION
  // ============================================================================
  const isDark = selectedMode === 'dark';

  const getUltimateThemeStyles = () => {
    if (!enableCustomTheme) {
      return {
        bg: 'bg-zinc-950 text-zinc-300',
        cardBg: 'bg-zinc-900/60 border border-zinc-800 text-zinc-200 shadow-none backdrop-blur-none',
        headerBg: 'bg-zinc-900/90 text-zinc-100 border-zinc-800 shadow-none backdrop-blur-none',
        accentText: 'text-zinc-100',
        badge: 'bg-zinc-800 border-zinc-700 text-zinc-400 shadow-none',
        buttonPrimary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold border border-zinc-700 shadow-none',
        btnActivePeriod: 'bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-none',
        focusBorder: 'focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700',
        badgeBg: 'bg-zinc-800 text-zinc-300 border-zinc-700'
      };
    }

    if (isDark) {
      switch (selectedTheme) {
        case 'purple':
          return {
            bg: 'bg-[#0f071e] text-purple-50',
            cardBg: 'bg-gradient-to-br from-purple-950/45 via-zinc-950/90 to-slate-950/95 border-purple-500/40 shadow-[0_0_35px_rgba(168,85,247,0.2)] hover:shadow-[0_0_45px_rgba(168,85,247,0.35)] backdrop-blur-2xl ring-1 ring-purple-500/20',
            headerBg: 'bg-gradient-to-r from-purple-950/70 via-zinc-950/95 to-indigo-950/60 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.25)] backdrop-blur-3xl ring-1 ring-purple-500/30',
            accentText: 'text-purple-400',
            badge: 'bg-purple-500/25 border-purple-400/50 text-purple-200 shadow-sm shadow-purple-500/20',
            buttonPrimary: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-purple-600/40 hover:shadow-purple-600/60',
            btnActivePeriod: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30',
            focusBorder: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
            badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/50'
          };
        case 'pink':
          return {
            bg: 'bg-[#1a0815] text-pink-50',
            cardBg: 'bg-gradient-to-br from-pink-950/45 via-zinc-950/90 to-slate-950/95 border-pink-500/40 shadow-[0_0_35px_rgba(236,72,153,0.2)] hover:shadow-[0_0_45px_rgba(236,72,153,0.35)] backdrop-blur-2xl ring-1 ring-pink-500/20',
            headerBg: 'bg-gradient-to-r from-pink-950/70 via-zinc-950/95 to-rose-950/60 border-pink-500/50 shadow-[0_0_40px_rgba(236,72,153,0.25)] backdrop-blur-3xl ring-1 ring-pink-500/30',
            accentText: 'text-pink-400',
            badge: 'bg-pink-500/25 border-pink-400/50 text-pink-200 shadow-sm shadow-pink-500/20',
            buttonPrimary: 'bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-400 text-white font-black shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50',
            btnActivePeriod: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/30',
            focusBorder: 'focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20',
            badgeBg: 'bg-pink-500/20 text-pink-200 border-pink-400/50'
          };
        case 'amber':
          return {
            bg: 'bg-[#1a1205] text-amber-50',
            cardBg: 'bg-gradient-to-br from-amber-950/45 via-zinc-950/90 to-slate-950/95 border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.2)] hover:shadow-[0_0_45px_rgba(245,158,11,0.35)] backdrop-blur-2xl ring-1 ring-amber-500/20',
            headerBg: 'bg-gradient-to-r from-amber-950/70 via-zinc-950/95 to-yellow-950/60 border-amber-500/50 shadow-[0_0_40px_rgba(245,158,11,0.25)] backdrop-blur-3xl ring-1 ring-amber-500/30',
            accentText: 'text-amber-400',
            badge: 'bg-amber-500/25 border-amber-400/50 text-amber-200 shadow-sm shadow-amber-500/20',
            buttonPrimary: 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50',
            btnActivePeriod: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/30',
            focusBorder: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
            badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-400/50'
          };
        case 'emerald':
          return {
            bg: 'bg-[#051a12] text-emerald-50',
            cardBg: 'bg-gradient-to-br from-emerald-950/45 via-zinc-950/90 to-slate-950/95 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.2)] hover:shadow-[0_0_45px_rgba(16,185,129,0.35)] backdrop-blur-2xl ring-1 ring-emerald-500/20',
            headerBg: 'bg-gradient-to-r from-emerald-950/70 via-zinc-950/95 to-teal-950/60 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.25)] backdrop-blur-3xl ring-1 ring-emerald-500/30',
            accentText: 'text-emerald-400',
            badge: 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200 shadow-sm shadow-emerald-500/20',
            buttonPrimary: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50',
            btnActivePeriod: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30',
            focusBorder: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
            badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
          };
        default:
          return {
            bg: 'bg-[#05141a] text-cyan-50',
            cardBg: 'bg-gradient-to-br from-cyan-950/45 via-zinc-950/90 to-slate-950/95 border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.2)] hover:shadow-[0_0_45px_rgba(6,182,212,0.35)] backdrop-blur-2xl ring-1 ring-cyan-500/20',
            headerBg: 'bg-gradient-to-r from-cyan-950/70 via-zinc-950/95 to-blue-950/60 border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.25)] backdrop-blur-3xl ring-1 ring-cyan-500/30',
            accentText: 'text-cyan-400',
            badge: 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200 shadow-sm shadow-cyan-500/20',
            buttonPrimary: 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black shadow-lg shadow-cyan-600/30 hover:shadow-cyan-600/50',
            btnActivePeriod: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-600/30',
            focusBorder: 'focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20',
            badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50'
          };
      }
    } else {
      switch (selectedTheme) {
        case 'purple':
          return {
            bg: 'bg-gradient-to-br from-purple-50/80 via-slate-100 to-indigo-50/60 text-slate-900',
            cardBg: 'bg-white/95 border-purple-200/90 shadow-[0_12px_40px_rgba(168,85,247,0.12)] hover:shadow-[0_18px_50px_rgba(168,85,247,0.2)] backdrop-blur-xl',
            headerBg: 'bg-white/95 border-purple-300 shadow-[0_15px_45px_rgba(168,85,247,0.15)] backdrop-blur-xl',
            accentText: 'text-purple-600',
            badge: 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm',
            buttonPrimary: 'bg-purple-600 hover:bg-purple-500 text-white font-black shadow-lg shadow-purple-600/30',
            btnActivePeriod: 'bg-purple-600 text-white shadow-md shadow-purple-600/20',
            focusBorder: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
            badgeBg: 'bg-purple-100 text-purple-800 border-purple-300'
          };
        case 'pink':
          return {
            bg: 'bg-gradient-to-br from-pink-50/80 via-slate-100 to-rose-50/60 text-slate-900',
            cardBg: 'bg-white/95 border-pink-200/90 shadow-[0_12px_40px_rgba(236,72,153,0.12)] hover:shadow-[0_18px_50px_rgba(236,72,153,0.2)] backdrop-blur-xl',
            headerBg: 'bg-white/95 border-pink-300 shadow-[0_15px_45px_rgba(236,72,153,0.15)] backdrop-blur-xl',
            accentText: 'text-pink-600',
            badge: 'bg-pink-100 border-pink-300 text-pink-700 shadow-sm',
            buttonPrimary: 'bg-pink-600 hover:bg-pink-500 text-white font-black shadow-lg shadow-pink-600/30',
            btnActivePeriod: 'bg-pink-600 text-white shadow-md shadow-pink-600/20',
            focusBorder: 'focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20',
            badgeBg: 'bg-pink-100 text-pink-800 border-pink-300'
          };
        case 'amber':
          return {
            bg: 'bg-gradient-to-br from-amber-50/80 via-slate-100 to-orange-50/60 text-slate-900',
            cardBg: 'bg-white/95 border-amber-200/90 shadow-[0_12px_40px_rgba(245,158,11,0.12)] hover:shadow-[0_18px_50px_rgba(245,158,11,0.2)] backdrop-blur-xl',
            headerBg: 'bg-white/95 border-amber-300 shadow-[0_15px_45px_rgba(245,158,11,0.15)] backdrop-blur-xl',
            accentText: 'text-amber-600',
            badge: 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm',
            buttonPrimary: 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-lg shadow-amber-500/30',
            btnActivePeriod: 'bg-amber-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/20',
            focusBorder: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
            badgeBg: 'bg-amber-100 text-amber-900 border-amber-300'
          };
        case 'emerald':
          return {
            bg: 'bg-gradient-to-br from-emerald-50/80 via-slate-100 to-teal-50/60 text-slate-900',
            cardBg: 'bg-white/95 border-emerald-200/90 shadow-[0_12px_40px_rgba(16,185,129,0.12)] hover:shadow-[0_18px_50px_rgba(16,185,129,0.2)] backdrop-blur-xl',
            headerBg: 'bg-white/95 border-emerald-300 shadow-[0_15px_45px_rgba(16,185,129,0.15)] backdrop-blur-xl',
            accentText: 'text-emerald-600',
            badge: 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm',
            buttonPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg shadow-emerald-600/30',
            btnActivePeriod: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20',
            focusBorder: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
            badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300'
          };
        default:
          return {
            bg: 'bg-gradient-to-br from-sky-50/80 via-slate-100 to-cyan-50/60 text-slate-900',
            cardBg: 'bg-white/95 border-sky-200/90 shadow-[0_12px_40px_rgba(14,165,233,0.12)] hover:shadow-[0_18px_50px_rgba(14,165,233,0.2)] backdrop-blur-xl',
            headerBg: 'bg-white/95 border-sky-300 shadow-[0_15px_45px_rgba(14,165,233,0.15)] backdrop-blur-xl',
            accentText: 'text-sky-600',
            badge: 'bg-sky-100 border-sky-300 text-sky-700 shadow-sm',
            buttonPrimary: 'bg-cyan-600 hover:bg-cyan-500 text-white font-black shadow-lg shadow-cyan-600/30',
            btnActivePeriod: 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20',
            focusBorder: 'focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20',
            badgeBg: 'bg-sky-100 text-sky-800 border-sky-300'
          };
      }
    }
  };

  const currentTheme = getUltimateThemeStyles();
  const activeColor3D = GLOBAL_THEME_3D_COLORS[selectedTheme] || GLOBAL_THEME_3D_COLORS.purple;
  const activeStaffColor3D = GLOBAL_THEME_3D_COLORS[selectedTheme] || GLOBAL_THEME_3D_COLORS.purple;

  // ============================================================================
  // 15. INITIAL LOADING UI STATE
  // ============================================================================
  if (isInitializing) {
    return (
      <main className="min-h-screen bg-[#06040A] flex items-center justify-center font-sans text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin"></div>
          <span className="text-xs font-medium tracking-wider text-purple-200/80">Memuat Sistem Dashboard Admin...</span>
        </div>
      </main>
    )
  }

  // ============================================================================
  // 16. LOGIN FORM UI STATE (UNAUTHENTICATED)
  // ============================================================================
  if (!isAuthenticated) {
    const isEyelash = businessType === 'eyelash'
    return (
      <main className={`min-h-screen flex items-center justify-center p-4 font-sans text-zinc-100 relative overflow-hidden transition-colors duration-500 ${
        isEyelash ? 'bg-[#0b0510]' : 'bg-[#06040a]'
      }`}>
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isEyelash ? 'bg-pink-500/15' : 'bg-purple-600/15'
        }`}></div>

        <div className={`max-w-md w-full backdrop-blur-2xl border rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative z-10 transition-all duration-300 ${
          isEyelash 
            ? 'bg-pink-950/20 border-pink-500/30 shadow-pink-950/30' 
            : 'bg-zinc-900/60 border-purple-500/30 shadow-purple-950/40'
        }`}>
          <div className="text-center space-y-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border tracking-widest uppercase shadow-inner ${
              isEyelash 
                ? 'bg-gradient-to-r from-pink-500/20 to-rose-600/10 text-pink-300 border-pink-500/30' 
                : 'bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-purple-600/10 text-purple-300 border-purple-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isEyelash ? 'bg-pink-400' : 'bg-purple-400'}`}></span>
              {controlCenterLabel}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase bg-gradient-to-b from-white via-zinc-200 to-purple-200/60 bg-clip-text text-transparent mt-2">
              {brandTitle || (isEyelash ? 'Eyelash Salon' : 'Barbershop Portal')}
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Masuk untuk mengakses dasbor manajemen reservasi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email Admin</label>
              <input
                type="email"
                required
                placeholder="admin@bisnis.com"
                className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all shadow-inner ${
                  isEyelash ? 'border-pink-900/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20' : 'border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
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
                className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all shadow-inner ${
                  isEyelash ? 'border-pink-900/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20' : 'border-zinc-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                }`}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-black py-3.5 rounded-2xl transition-all text-xs tracking-wide shadow-lg active:scale-[0.98] disabled:opacity-50 mt-2 ${
                isEyelash 
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-pink-500/20' 
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
              }`}
            >
              {loading ? 'Memproses Authentikasi...' : 'MASUK DASHBOARD'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  const isEyelash = businessType === 'eyelash'
  const isProfesional = subscriptionPlan === 'PROFESIONAL'
  const isUltimate = subscriptionPlan === 'ULTIMATE'

  // ============================================================================
  // 17. MAIN DASHBOARD UI (AUTHENTICATED)
  // ============================================================================
  return (
    <main className={`min-h-screen p-3 sm:p-6 md:p-8 font-sans relative transition-all duration-700 ${currentTheme.bg}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute -top-[10%] -left-[10%] w-[650px] h-[650px] rounded-full blur-[180px] opacity-35 transition-all duration-700 ${isDark ? 'bg-purple-600/30' : 'bg-cyan-400/30'}`}></div>
        <div className={`absolute top-[40%] -right-[10%] w-[750px] h-[750px] rounded-full blur-[200px] opacity-35 transition-all duration-700 ${isDark ? 'bg-indigo-600/30' : 'bg-purple-300/40'}`}></div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">

        {/* 17.1 HEADER SECTION */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6 md:p-7 rounded-3xl transition-all duration-500 gap-4 border backdrop-blur-2xl ${
          enableCustomTheme ? currentTheme.headerBg : 'bg-zinc-950 text-zinc-100 border-zinc-800'
        }`}>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight uppercase flex items-center gap-2">
                <span className={enableCustomTheme && !isDark ? 'text-slate-900' : 'text-white'}>{controlCenterLabel}</span>
              </h1>
              <span className={`text-[9px] sm:text-[10px] font-black px-3.5 py-1.5 rounded-full border tracking-widest uppercase flex items-center gap-1.5 ${
                enableCustomTheme ? currentTheme.badge : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}>
                {subscriptionPlan} SYSTEM
              </span>
            </div>
            <p className={`text-[11px] sm:text-xs mt-1 font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              Kelola dan pantau pesanan masuk secara real-time untuk <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{brandTitle}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <div className={`flex items-center gap-3 p-2 px-3.5 rounded-2xl border backdrop-blur-xl shadow-sm ${isDark ? 'bg-zinc-950/85 border-zinc-800' : 'bg-white/85 border-slate-200'}`}>
              <div className="flex items-center bg-black/10 dark:bg-white/10 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setSelectedMode('dark');
                    localStorage.setItem('admin_theme_mode', 'dark');
                  }}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${isDark ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  🌙 Dark
                </button>
                <button
                  onClick={() => {
                    setSelectedMode('light');
                    localStorage.setItem('admin_theme_mode', 'light');
                  }}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${!isDark ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  ☀️ Light
                </button>
              </div>

              {enableCustomTheme && (
                <>
                  <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700"></div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setSelectedTheme('purple'); localStorage.setItem('admin_color_theme', 'purple'); }}
                      className={`w-5 h-5 rounded-full bg-purple-600 border-2 transition-all ${selectedTheme === 'purple' ? 'border-white scale-125 shadow-md ring-2 ring-purple-400' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                    <button
                      onClick={() => { setSelectedTheme('pink'); localStorage.setItem('admin_color_theme', 'pink'); }}
                      className={`w-5 h-5 rounded-full bg-pink-500 border-2 transition-all ${selectedTheme === 'pink' ? 'border-white scale-125 shadow-md ring-2 ring-pink-400' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                    <button
                      onClick={() => { setSelectedTheme('amber'); localStorage.setItem('admin_color_theme', 'amber'); }}
                      className={`w-5 h-5 rounded-full bg-amber-400 border-2 transition-all ${selectedTheme === 'amber' ? 'border-white scale-125 shadow-md ring-2 ring-amber-300' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                    <button
                      onClick={() => { setSelectedTheme('emerald'); localStorage.setItem('admin_color_theme', 'emerald'); }}
                      className={`w-5 h-5 rounded-full bg-emerald-500 border-2 transition-all ${selectedTheme === 'emerald' ? 'border-white scale-125 shadow-md ring-2 ring-emerald-400' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                    <button
                      onClick={() => { setSelectedTheme('blue'); localStorage.setItem('admin_color_theme', 'blue'); }}
                      className={`w-5 h-5 rounded-full bg-cyan-500 border-2 transition-all ${selectedTheme === 'blue' ? 'border-white scale-125 shadow-md ring-2 ring-cyan-300' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => { fetchReservations() }}
                className={`px-4 py-2.5 rounded-xl font-bold transition-all text-[11px] sm:text-xs border shadow-sm ${isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="bg-rose-500/15 hover:bg-rose-500/30 text-rose-500 border border-rose-500/30 px-4 py-2.5 rounded-xl font-bold transition-all text-[11px] sm:text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* 17.4 STATS CARDS SECTION */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${
          !isSuperAdminToggleActive ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
        } gap-3 sm:gap-4`}>
          
          {isSuperAdminToggleActive && (
            <div className={`col-span-2 sm:col-span-1 border p-4 sm:p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${currentTheme.cardBg}`}>
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="text-4xl sm:text-6xl">{isEyelash ? '💄' : '💰'}</span>
              </div>
              <p className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${currentTheme.accentText}`}>Total Omzet</p>
              <div className="mt-2 sm:mt-3">
                <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Rp {stats.totalRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1.5 text-emerald-500">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {stats.completedCount} transaksi selesai
                </p>
              </div>
            </div>
          )}

          <div className={`border p-4 sm:p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-1 ${currentTheme.cardBg}`}>
            <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-slate-500'}`}>Total Booking</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.totalBookings}</h3>
              <span className={`w-fit text-[9px] sm:text-[11px] font-black px-2.5 py-1 rounded-full border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>Semua Data</span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-1 ${currentTheme.cardBg}`}>
            <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Menunggu</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{stats.pendingCount}</h3>
              <span className="w-fit text-[9px] sm:text-[11px] font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30 text-amber-500">Konfirmasi</span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-1 ${currentTheme.cardBg}`}>
            <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Selesai</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.completedCount}</h3>
              <span className="w-fit text-[9px] sm:text-xs font-extrabold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-500">
                {stats.completedPercentage}%
              </span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-3xl transition-all duration-300 transform hover:-translate-y-1 ${currentTheme.cardBg}`}>
            <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Pembatalan</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{stats.cancelledCount}</h3>
              {stats.needRefundCount > 0 ? (
                <span className="w-fit text-[9px] font-black bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-500 animate-pulse">
                  {stats.needRefundCount} Refund
                </span>
              ) : (
                <span className="w-fit text-[9px] sm:text-xs font-extrabold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/30 text-rose-500">
                  {stats.cancelledPercentage}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 17.5 PERFORMANCE SECTION */}
        {isSuperAdminToggleActive && businessPerformanceEnabled && (
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            
            {/* ========================================================= */}
            {/* 1. KIRI: PERFORMA USAHA (DENGAN FILTER & DESAIN EKSKLUSIF)  */}
            {/* ========================================================= */}
            {(() => {
              const activeColor3D = theme3DColors[selectedTheme] || theme3DColors.purple;

              // Filter reservasi usaha berdasarkan bulan & tahun khusus Usaha
              const filteredByMonthYear = reservations.filter(r => {
                if (!r.booking_date) return false;
                const d = new Date(r.booking_date);
                const m = String(d.getMonth() + 1);
                const y = String(d.getFullYear());
                return m === businessMonth && y === businessYear;
              });

              const completedRes = filteredByMonthYear.filter(r => isCompleted(r.status));
              
              let actualBusinessData = [];
              if (businessFilter === 'mingguan') {
                const map: Record<string, number> = { 'Sen': 0, 'Sel': 0, 'Rab': 0, 'Kam': 0, 'Jum': 0, 'Sab': 0, 'Min': 0 };
                const countMap: Record<string, number> = { 'Sen': 0, 'Sel': 0, 'Rab': 0, 'Kam': 0, 'Jum': 0, 'Sab': 0, 'Min': 0 };
                
                completedRes.forEach(r => {
                  const d = new Date(r.booking_date);
                  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                  const name = dayNames[d.getDay()];
                  map[name] = (map[name] || 0) + getItemPrice(r);
                  countMap[name] = (countMap[name] || 0) + 1;
                });

                const barKeys = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
                actualBusinessData = barKeys.map(k => {
                  const amt = map[k];
                  const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
                  return { label: k, value: `${countMap[k]} transaksi`, amount: formattedAmt, rawAmount: amt };
                });
              } else if (businessFilter === 'bulanan') {
                const weekMap = [0, 0, 0, 0];
                const weekCounts = [0, 0, 0, 0];
                
                completedRes.forEach(r => {
                  const dayNum = new Date(r.booking_date).getDate();
                  const weekIdx = Math.min(Math.floor((dayNum - 1) / 7), 3);
                  weekMap[weekIdx] += getItemPrice(r);
                  weekCounts[weekIdx] += 1;
                });

                actualBusinessData = weekMap.map((amt, idx) => {
                  const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
                  return { label: `Minggu ${idx + 1}`, value: `${weekCounts[idx]} transaksi`, amount: formattedAmt, rawAmount: amt };
                });
              } else {
                const qMap = [0, 0, 0, 0];
                const qCounts = [0, 0, 0, 0];
                
                completedRes.forEach(r => {
                  const month = new Date(r.booking_date).getMonth();
                  const qIdx = Math.floor(month / 3);
                  qMap[qIdx] += getItemPrice(r);
                  qCounts[qIdx] += 1;
                });

                actualBusinessData = qMap.map((amt, idx) => {
                  const formattedAmt = amt >= 1000000 ? `Rp ${(amt / 1000000).toFixed(1)}jt` : amt >= 1000 ? `Rp ${(amt / 1000).toFixed(0)}rb` : `Rp ${amt}`;
                  return { label: `Q${idx + 1}`, value: `${qCounts[idx]} transaksi`, amount: formattedAmt, rawAmount: amt };
                });
              }

              const businessColumnsClass = actualBusinessData.length === 7 ? 'grid-cols-7' : 'grid-cols-4';
              const maxBusinessVal = Math.max(1, ...actualBusinessData.map((i) => Number(i.rawAmount) || 1));

              return (
                <div className={'border p-4 sm:p-6 rounded-3xl transition-all flex flex-col justify-between gap-4 relative overflow-hidden flex-1 shadow-2xl ' + currentTheme.cardBg}>
                  
                  <div>
                    {/* HEADER & FILTER HIDUP (USAHA) */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border border-emerald-400/50 bg-gradient-to-br from-emerald-500/30 to-emerald-700/20 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-lg shadow-emerald-500/20">
                          📈
                        </div>
                        <div>
                          <span className={'text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-inner ' + currentTheme.badgeBg}>
                            Performa Usaha ({businessFilter})
                          </span>
                          <h3 className={'text-base sm:text-lg font-semibold mt-1 ' + (isDark ? 'text-zinc-200' : 'text-slate-800')}>
                            Grafik Omzet & Bisnis (Actual)
                          </h3>
                        </div>
                      </div>

                      {/* KUMPULAN FILTER DENGAN EFEK GLOW & GLASSMORPHISM */}
                      <div className="flex flex-wrap items-center gap-2">
                        
                        {/* DROPDOWN BULAN */}
                        <div className="relative group">
                          <select 
                            value={businessMonth} 
                            onChange={(e) => setBusinessMonth(e.target.value)}
                            className={'px-3 py-2 text-[11px] sm:text-xs font-bold rounded-2xl border backdrop-blur-md outline-none transition-all duration-300 shadow-lg cursor-pointer ' + (isDark ? 'bg-zinc-900/80 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:shadow-emerald-500/20' : 'bg-white/90 border-emerald-500/40 text-emerald-700 hover:border-emerald-500')}
                          >
                            {[
                              { v: '1', l: 'Januari' }, { v: '2', l: 'Februari' }, { v: '3', l: 'Maret' },
                              { v: '4', l: 'April' }, { v: '5', l: 'Mei' }, { v: '6', l: 'Juni' },
                              { v: '7', l: 'Juli' }, { v: '8', l: 'Agustus' }, { v: '9', l: 'September' },
                              { v: '10', l: 'Oktober' }, { v: '11', l: 'November' }, { v: '12', l: 'Desember' }
                            ].map(m => <option key={m.v} value={m.v} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{m.l}</option>)}
                          </select>
                        </div>

                        {/* DROPDOWN TAHUN */}
                        <div className="relative group">
                          <select 
                            value={businessYear} 
                            onChange={(e) => setBusinessYear(e.target.value)}
                            className={'px-3 py-2 text-[11px] sm:text-xs font-bold rounded-2xl border backdrop-blur-md outline-none transition-all duration-300 shadow-lg cursor-pointer ' + (isDark ? 'bg-zinc-900/80 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:shadow-emerald-500/20' : 'bg-white/90 border-emerald-500/40 text-emerald-700 hover:border-emerald-500')}
                          >
                            {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{y}</option>)}
                          </select>
                        </div>

                        {/* TAB FILTER (MINGGUAN/BULANAN/TAHUNAN) */}
                        <div className={'flex items-center p-1 rounded-2xl border backdrop-blur-md shadow-inner ' + (isDark ? 'bg-black/60 border-zinc-800' : 'bg-slate-200/80 border-slate-300')}>
                          {['mingguan', 'bulanan', 'tahunan'].map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setBusinessFilter(tab)}
                              className={'px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-xl transition-all duration-300 capitalize ' + (
                                businessFilter === tab 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                                  : (isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60')
                              )}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-800/60 flex flex-col justify-end h-[280px] sm:h-[300px] relative px-2">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 px-2 py-4">
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                    </div>

                    <div className={'grid ' + businessColumnsClass + ' gap-2 sm:gap-4 items-end h-full pb-6 z-10'}>
                      {actualBusinessData.map((item, idx: number) => {
                        const heightPct = Math.max(Math.round(((item.rawAmount || 0) / maxBusinessVal) * 100), 18);
                        return (
                          <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                            
                            {/* TEKS 3D HIDUP */}
                            <div className="mb-2 flex flex-col items-center whitespace-nowrap transition-all duration-300 group-hover:scale-110">
                              <span className={'text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-xl border shadow-[0_6px_16px_rgba(0,0,0,0.6)] backdrop-blur-md transform transition-transform group-hover:-translate-y-1 ' + (isDark ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 border-emerald-500/40 text-emerald-300 shadow-emerald-500/20' : 'bg-gradient-to-b from-white to-slate-100 border-emerald-500/40 text-emerald-700 shadow-emerald-500/10')}>
                                ✨ {item.value}
                              </span>
                            </div>

                            <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-zinc-900 border border-zinc-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap z-30">
                              {item.amount} ({item.value})
                            </div>

                            {/* BATANG 3D */}
                            <div 
                              className={'w-full max-w-[48px] rounded-2xl transition-all duration-700 relative flex flex-col items-center group-hover:scale-[1.05] ' + activeColor3D.glow}
                              style={{ height: heightPct + '%' }}
                            >
                              <div className={'w-full h-3 rounded-t-xl bg-gradient-to-r ' + activeColor3D.top + ' border-t border-white/40 shadow-sm shrink-0'} />
                              <div className={'w-full flex-1 bg-gradient-to-b ' + activeColor3D.body + ' backdrop-blur-md border-x border-b border-white/10 rounded-b-xl'} />
                            </div>

                            <span className={'text-[11px] font-bold mt-3 tracking-wider uppercase truncate max-w-full ' + (isDark ? 'text-zinc-400 group-hover:text-white' : 'text-slate-600')}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* ========================================================= */}
            {/* 2. KANAN: PERFORMA STAFF (DINAMIS DARI DATA STAFF & TABEL) */}
            {/* ========================================================= */}
            {(() => {
              const activeColor3D = theme3DColors[selectedTheme] || theme3DColors.purple;
              
              // 1. Pastikan staffList aman dan ambil namanya dengan berbagai kemungkinan struktur properti
              const currentStaffList: any[] = Array.isArray(staffList) ? staffList : [];

              const registeredStaffNames: string[] = currentStaffList
                .map((s: any) => s?.name || s?.staff_name || s?.nama || '')
                .filter((name: string): name is string => typeof name === 'string' && name.trim().length > 0);

              // 2. Filter reservasi staff berdasarkan bulan & tahun khusus Staff yang statusnya completed
              const staffFilteredRes = reservations.filter((r: any) => {
                if (!r?.booking_date) return false;
                const d = new Date(r.booking_date);
                const m = String(d.getMonth() + 1);
                const y = String(d.getFullYear());
                return m === staffMonth && y === staffYear && isCompleted(r.status);
              });

              // 3. Hitung jumlah transaksi per staff dari data reservasi
              const staffMap: Record<string, number> = {};
              staffFilteredRes.forEach((r: any) => {
                let staffName = r?.staff_name || r?.staff || r?.staffName || '';
                if (staffName) {
                  staffMap[staffName] = (staffMap[staffName] || 0) + 1;
                }
              });

              // 4. PERBAIKAN UTAMA: Gabungkan (Merge) nama dari database staff DAN transaksi reservasi 
              // agar staff yang baru didaftarkan (seperti Fitri meski transaksinya masih 0) tetap muncul!
              const combinedStaffSet = new Set<string>([
                ...registeredStaffNames,
                ...Object.keys(staffMap)
              ]);

              const allStaffKeys: string[] = combinedStaffSet.size > 0 
                ? Array.from(combinedStaffSet) 
                : ['Unassigned Staff'];

              const staffData = allStaffKeys.map((name: string) => ({
                label: name,
                count: staffMap[name] || 0
              }));

              const maxStaffVal = Math.max(1, ...staffData.map((s: { count: number }) => s.count));

              return (
                <div className={'border p-4 sm:p-6 rounded-3xl transition-all flex flex-col justify-between gap-5 relative overflow-hidden lg:w-[460px] shrink-0 shadow-2xl ' + currentTheme.cardBg}>
                  
                  {/* HEADER & FILTER: Disusun vertikal responsif agar TIDAK TUMPANG TINDIH */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/30 to-amber-700/20 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-lg shadow-amber-500/20">
                        👑
                      </div>
                      <div>
                        <span className={'text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border shadow-inner ' + currentTheme.badgeBg}>
                          Performa Staff
                        </span>
                        <h3 className={'text-base sm:text-lg font-semibold mt-1 ' + (isDark ? 'text-zinc-200' : 'text-slate-800')}>
                          Grafik Kinerja Staff
                        </h3>
                      </div>
                    </div>

                    {/* DROPDOWN FILTER BULAN & TAHUN: Pindah ke baris bawahnya secara rapi */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/40">
                      <div className="relative group">
                        <select 
                          value={staffMonth} 
                          onChange={(e) => setStaffMonth(e.target.value)}
                          className={'px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-2xl border backdrop-blur-md outline-none transition-all duration-300 shadow-lg cursor-pointer ' + (isDark ? 'bg-zinc-900/80 border-amber-500/40 text-amber-300 hover:border-amber-400 hover:shadow-amber-500/20' : 'bg-white/90 border-amber-500/40 text-amber-700 hover:border-amber-500')}
                        >
                          {[
                            { v: '1', l: 'Januari' }, { v: '2', l: 'Februari' }, { v: '3', l: 'Maret' },
                            { v: '4', l: 'April' }, { v: '5', l: 'Mei' }, { v: '6', l: 'Juni' },
                            { v: '7', l: 'Juli' }, { v: '8', l: 'Agustus' }, { v: '9', l: 'September' },
                            { v: '10', l: 'Oktober' }, { v: '11', l: 'November' }, { v: '12', l: 'Desember' }
                          ].map(m => <option key={m.v} value={m.v} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{m.l}</option>)}
                        </select>
                      </div>

                      <div className="relative group">
                        <select 
                          value={staffYear} 
                          onChange={(e) => setStaffYear(e.target.value)}
                          className={'px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-2xl border backdrop-blur-md outline-none transition-all duration-300 shadow-lg cursor-pointer ' + (isDark ? 'bg-zinc-900/80 border-amber-500/40 text-amber-300 hover:border-amber-400 hover:shadow-amber-500/20' : 'bg-white/90 border-amber-500/40 text-amber-700 hover:border-amber-500')}
                        >
                          {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/60 flex flex-col justify-end h-[280px] sm:h-[300px] relative px-2">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 px-2 py-4">
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                      <div className="border-b border-dashed border-zinc-500 w-full"></div>
                    </div>

                    <div className="grid grid-flow-col auto-cols-fr gap-4 items-end h-full pb-6 z-10 justify-center">
                      {staffData.map((item: { label: string; count: number }, idx: number) => {
                        const heightPct = Math.max(Math.round((item.count / maxStaffVal) * 100), 18);
                        return (
                          <div key={idx} className="flex flex-col items-center h-full justify-end group relative max-w-[110px]">
                            
                            {/* EFEK 3D HIDUP PADA TEKS TRANSAKSI */}
                            <div className="mb-2 flex flex-col items-center whitespace-nowrap transition-all duration-300 group-hover:scale-110">
                              <span className={'text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-xl border shadow-[0_6px_16px_rgba(0,0,0,0.6)] backdrop-blur-md transform transition-transform group-hover:-translate-y-1 ' + (isDark ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 border-amber-500/40 text-amber-300 shadow-amber-500/20' : 'bg-gradient-to-b from-white to-slate-100 border-amber-500/40 text-amber-700 shadow-amber-500/10')}>
                                ✨ {item.count} transaksi
                              </span>
                            </div>

                            {/* BATANG 3D STAFF */}
                            <div 
                              className={'w-full max-w-[48px] rounded-2xl transition-all duration-700 relative flex flex-col items-center group-hover:scale-[1.05] ' + activeColor3D.glow}
                              style={{ height: heightPct + '%' }}
                            >
                              <div className={'w-full h-3 rounded-t-xl bg-gradient-to-r ' + activeColor3D.top + ' border-t border-white/40 shadow-sm shrink-0'} />
                              <div className={'w-full flex-1 bg-gradient-to-b ' + activeColor3D.body + ' backdrop-blur-md border-x border-b border-white/10 rounded-b-xl'} />
                            </div>

                            {/* NAMA STAFF: Tampil natural sesuai inputan database/super admin */}
                            <span className={'text-[10px] font-bold mt-3 tracking-wide truncate max-w-full text-center normal-case ' + (isDark ? 'text-zinc-400 group-hover:text-white' : 'text-slate-600')} title={item.label}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* 17.6 STANDARD MODE BANNER */}
        {!isSuperAdminToggleActive && (
          <div className={`p-4 sm:p-6 rounded-3xl border shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${currentTheme.cardBg}`}>
            <div className="space-y-1">
              <span className={`text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${currentTheme.badgeBg}`}>Standard Mode / Non-Active Toggle</span>
              <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Dashboard tampil dalam mode standar/dasar. Aktifkan toggle Super Admin untuk membuka fitur lengkap!</h3>
              <p className={`text-[11px] sm:text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Hubungi administrator pusat untuk mengaktifkan status berlangganan kamu.</p>
            </div>
            <button onClick={() => alert('Silakan aktifkan toggle super admin dari panel superadmin Supabase!')} className={`w-full md:w-auto font-black px-5 py-2.5 rounded-2xl text-xs whitespace-nowrap shadow-lg transition-all active:scale-95 ${currentTheme.buttonPrimary}`}>
              Info Toggle 🔒
            </button>
          </div>
        )}

        {/* 17.7 BLOCK SLOT MANAGEMENT SECTION */}
          {isSuperAdminToggleActive && slotBlockingEnabled && (
          <div className={`p-4 sm:p-6 rounded-3xl shadow-2xl border transition-all space-y-4 ${currentTheme.cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-3 gap-2">
              <div>
                <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${currentTheme.accentText}`}>
                  <span>🚫 Pengaturan Operasional </span>
                </h3>
                <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Blokir rentang tanggal libur panjang (Lebaran, Cuti) atau jam istirahat tertentu secara fleksibel.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30 self-start sm:self-auto">
                {blockedSlots.length} Slot Off
              </span>
            </div>

            <form onSubmit={handleAddBlockSlot} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                {/* Tanggal Mulai */}
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Tanggal Mulai:</label>
                  <input 
                    type="date" 
                    required 
                    value={blockStartDate} 
                    onChange={(e) => setBlockStartDate(e.target.value)} 
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100 [color-scheme:dark]' : 'bg-white border-slate-300 text-slate-800 [color-scheme:light]'} ${currentTheme.focusBorder}`}
                  />
                </div>

                {/* Tanggal Selesai */}
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Tanggal Selesai:</label>
                  <input 
                    type="date" 
                    required 
                    value={blockEndDate} 
                    onChange={(e) => setBlockEndDate(e.target.value)} 
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100 [color-scheme:dark]' : 'bg-white border-slate-300 text-slate-800 [color-scheme:light]'} ${currentTheme.focusBorder}`}
                  />
                </div>

                {/* Mode Waktu */}
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Mode Waktu:</label>
                  <select 
                    value={blockMode} 
                    onChange={(e) => setBlockMode(e.target.value)} 
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none cursor-pointer ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                  >
                    <option value="fullday">🏖️ Seharian Penuh (Full Day)</option>
                    <option value="custom_time">⏰ Jam Tertentu Saja</option>
                  </select>
                </div>

                {/* Jam Off */}
                {blockMode === 'custom_time' ? (
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Pilih Jam:</label>
                    <select 
                      value={blockTimeInput} 
                      onChange={(e) => setBlockTimeInput(e.target.value)} 
                      className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none cursor-pointer ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                    >
                      {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00', '21:00'].map((time) => (
                        <option key={time} value={time}>{time} WIB</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 opacity-40 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Jam Off:</label>
                    <div className={`w-full px-3 py-2 border rounded-xl text-xs italic opacity-60 ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-400' : 'bg-slate-100 border-slate-300 text-slate-500'}`}>
                      Semua Jam (Tutup Toko)
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Kategori Keterangan:</label>
                  <select 
                    value={reasonPreset} 
                    onChange={(e) => setReasonPreset(e.target.value)} 
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none cursor-pointer ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                  >
                    <option value="Libur Lebaran">🌙 Libur Lebaran / Hari Raya</option>
                    <option value="Libur Nasional">🇮🇩 Libur Nasional / Tanggal Merah</option>
                    <option value="Istirahat Staff">☕ Istirahat Staff / Capster</option>
                    <option value="Maintenance Salon">🧹 Maintenance / Sterilisasi</option>
                    <option value="Lainnya">✏️ Lainnya (Tulis Manual)</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {reasonPreset === 'Lainnya' ? 'Keterangan Detail:' : 'Catatan Tambahan:'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={reasonPreset === 'Lainnya' ? "Misal: Ada Acara Keluar" : "Opsional..."}
                    value={blockReasonInput} 
                    onChange={(e) => setBlockReasonInput(e.target.value)} 
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-100' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                  />
                </div>

                <div>
                  <button 
                    type="submit" 
                    disabled={isBlocking} 
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 h-[38px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🔒</span> {isBlocking ? 'Memproses...' : 'Block Slot / Tanggal Ini'}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-300">DAFTAR SLOT TER-BLOCK SAAT INI:</h4>
              {blockedSlots.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Belum ada jadwal/tanggal operasional yang diblokir.</p>
              ) : (
                <div className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                  {blockedSlots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-4 hover:bg-gray-800/40 transition-colors">
                      
                      {/* Informasi Kiri: Keterangan & Tanggal */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                            {slot.reason || 'Libur / Tutup'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {slot.block_time ? `Jam: ${slot.block_time}` : 'Seharian Penuh (Full Day)'}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-gray-200">
                          📅 {slot.block_date} 
                          {slot.block_end_date && slot.block_end_date !== slot.block_date 
                            ? ` s/d ${slot.block_end_date}` 
                            : ''}
                        </p>
                      </div>

                      {/* Tombol Aksi Hapus */}
                      <button 
                        onClick={() => handleDeleteBlockSlot(slot.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        🗑️ Batalkan Blokir
                      </button>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- MAINTENANCE MODE --- */}
        {/* KONTROL MAINTENANCE / TOKO TUTUP - HANYA MUNCUL JIKA DIIZINKAN SUPER ADMIN */}
        {enableMaintenanceFeature && (
          <div className={`p-4 sm:p-6 rounded-3xl shadow-2xl border transition-all space-y-4 ${currentTheme.cardBg}`}>
            
            {/* Header Card Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-3 gap-4">
              <div>
                <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${currentTheme.accentText}`}>
                  <span>⚠️</span> Mode Tutup & Pemeliharaan Sistem
                </h3>
                <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Nyalakan tombol ini untuk mengunci halaman booking publik secara instan saat operasional tutup atau sedang pemeliharaan.
                </p>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer self-start sm:self-auto">
                <input 
                  type="checkbox" 
                  checked={isMaintenanceMode} 
                  onChange={async (e) => {
                    const newStatus = e.target.checked
                    setIsMaintenanceMode(newStatus)
                    
                    const { error } = await supabase
                      .from('tenants')
                      .update({ is_maintenance_mode: newStatus })
                      .eq('tenant_slug', tenantSlug)

                    if (error) {
                      alert('Gagal mengubah status maintenance: ' + error.message)
                      setIsMaintenanceMode(!newStatus)
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* --- TAMBAHAN: INPUT KUSTOM PESAN MAINTENANCE TEPAT DI BAWAH TOGGLE --- */}
            <div className="space-y-2 pt-2">
              <label className={`block text-xs font-bold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Kustom Pesan Toko Tutup / Maintenance (Tampil di Halaman Publik)
              </label>
              <div className="flex gap-2">
                <textarea 
                  rows={2}
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Tuliskan pesan penutupan toko di sini..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('tenants')
                      .update({ maintenance_message: maintenanceMessage })
                      .eq('tenant_slug', tenantSlug)

                    if (error) {
                      alert('Gagal menyimpan pesan: ' + error.message)
                    } else {
                      alert('Pesan maintenance berhasil diperbarui!')
                    }
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold rounded-xl transition-all self-end"
                >
                  Simpan Pesan
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                Pesan ini akan otomatis tampil menggantikan teks bawaan saat halaman publik dikunci.
              </p>
            </div>

          </div>
        )}

        {/* --- SHORTCUT MENU / TOMBOL PEMICU RESERVASI PELANGGAN --- */}
        {/* --- KEMBAR IDENTIK DENGAN PENGATURAN OPERASIONAL --- */}
        <div className={`p-4 sm:p-6 rounded-3xl shadow-2xl border transition-all space-y-4 ${currentTheme.cardBg}`}>
          
          {/* Header Card dengan Garis Pembatas Bawah (Sama persis kayak Pengaturan Operasional) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-3 gap-2">
            <div>
              <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${currentTheme.accentText}`}>
                <span>📋</span> Manajemen Reservasi Pelanggan
              </h3>
              <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Pantau slot jam yang otomatis ter-booking oleh pelanggan dari halaman publik.
              </p>
            </div>
            
            {/* Badge Counter / Tombol Pemicu di sebelah kanan */}
            <button
              onClick={() => {
                setIsReservationsModalOpen(true);
                fetchCustomerReservations();
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 border border-indigo-500/30 active:scale-95 self-start sm:self-auto"
            >
              <span>📋 Lihat Daftar</span>
              <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-200 rounded-full text-[10px] border border-indigo-500/30 font-bold">
                Cek Data
              </span>
            </button>
          </div>

        </div>

        {/* --- MODAL DAFTAR RESERVASI PELANGGAN --- */}
        {isReservationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-700/60 w-full max-w-2xl rounded-3xl shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/90">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📋</span> Daftar Reservasi Pelanggan
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Slot waktu yang otomatis diblokir dari hasil booking halaman publik.</p>
              </div>
              <button 
                onClick={() => setIsReservationsModalOpen(false)}
                className="text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold border border-gray-700"
              >
                ✕ Tutup
              </button>
            </div>

            {/* Body Content (List Data) */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-gray-950/30">
              {isLoadingReservations ? (
                <div className="text-center py-12 text-xs text-indigo-400 animate-pulse font-medium">
                  Memuat data reservasi...
                </div>
              ) : customerReservations.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
                  <p className="text-xs text-gray-500 italic">Belum ada reservasi pelanggan yang masuk saat ini.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {customerReservations.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800/80 hover:border-indigo-500/30 transition-all flex items-center justify-between shadow-sm group"
                    >
                      <div className="space-y-1.5">
                        {/* Badge Status */}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {item.reason}
                        </span>
                        
                        {/* Informasi Tanggal & Jam */}
                        <div className="text-sm font-medium text-gray-200 flex items-center gap-2 pt-0.5">
                          <span className="text-base">📅</span> 
                          <span>{item.block_date}</span>
                          {item.block_time && (
                            <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 text-xs">
                              {item.block_time} WIB
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tag Keterangan Kanan */}
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-800/60 px-3 py-1.5 rounded-xl border border-gray-700/50 group-hover:bg-indigo-500/10 group-hover:text-indigo-300 transition-colors">
                        🔄 Sinkron Otomatis
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/90 flex justify-end">
              <button
                onClick={() => setIsReservationsModalOpen(false)}
                className="px-5 py-2 text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all border border-gray-700"
              >
                Tutup Halaman
              </button>
            </div>

          </div>
        </div>
      )}

        {/* 17.8 FINANCIAL REPORT SECTION */}
        {isSuperAdminToggleActive && financialReportsEnabled && (
          <div className={`p-4 sm:p-6 md:p-7 rounded-3xl shadow-2xl space-y-4 sm:space-y-5 border transition-all ${currentTheme.cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-2">
              <div>
                <h2 className={`text-base sm:text-lg font-black flex items-center gap-2 ${currentTheme.accentText}`}>
                  <span>📊 Laporan Keuangan & Omzet Netto</span>
                </h2>
                <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  Data siap diexport ke Excel atau dicetak langsung/disimpan sebagai PDF resmi.
                </p>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 border border-amber-400/50 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 w-max shadow-lg shadow-amber-500/10">
                {isUltimate ? '🚀 Ultimate Plan (Full Access)' : '👑 Profesional Plan (Excel + Cetak PDF)'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className="md:col-span-6 space-y-3 sm:space-y-4">
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Tipe Laporan:</label>
                  <div className={`grid grid-cols-4 gap-1 sm:gap-2 p-1 rounded-2xl border ${isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-slate-200/80 border-slate-300'}`}>
                    {(['daily', 'weekly', 'monthly', 'custom'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setReportPeriod(mode)}
                        className={`py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all capitalize ${
                          reportPeriod === mode
                            ? currentTheme.btnActivePeriod
                            : isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/40' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        {mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : mode === 'monthly' ? 'Bulanan' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>
                {reportPeriod !== 'custom' ? (
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 sm:mb-2 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                      {reportPeriod === 'daily' && 'Pilih Tanggal:'}
                      {reportPeriod === 'weekly' && 'Pilih Tanggal Awal (7 Hari):'}
                      {reportPeriod === 'monthly' && 'Pilih Bulan & Tahun:'}
                    </label>
                    <input
                      type={reportPeriod === 'monthly' ? 'month' : 'date'}
                      value={reportPeriod === 'monthly' ? reportDate.substring(0, 7) : reportDate}
                      onChange={(e) => {
                        const val = e.target.value
                        setReportDate(reportPeriod === 'monthly' ? `${val}-01` : val)
                      }}
                      className={`w-full px-3.5 sm:px-4 py-2 sm:py-2.5 border rounded-2xl text-xs focus:outline-none shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                    />
                    {reportPeriod === 'weekly' && reportData.weekInfo && (
                      <p className={`text-[10px] sm:text-[11px] font-bold mt-2 flex items-center gap-1 ${currentTheme.accentText}`}>
                        <span>📅</span> Periode: {formatDateID(reportData.weekInfo.startStr)} s/d {formatDateID(reportData.weekInfo.endStr)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className={`block text-[11px] sm:text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Dari Tanggal:</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] sm:text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Sampai Tanggal:</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="md:col-span-6 space-y-3 sm:space-y-4">
                <div className={`border p-4 sm:p-5 rounded-2xl grid grid-cols-2 gap-3 sm:gap-4 text-xs shadow-inner ${isDark ? 'bg-zinc-950/90 border-zinc-800/80' : 'bg-slate-100 border-slate-300'}`}>
                  <div>
                    <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>OMZET BRUTO</p>
                    <p className={`text-lg sm:text-xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Rp {reportData.grossRevenue.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-rose-500 mt-1 font-bold">
                      Refund: -Rp {reportData.totalRefund.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className={`text-right border-l pl-3 sm:pl-4 ${isDark ? 'border-zinc-800' : 'border-slate-300'}`}>
                    <p className="text-[10px] sm:text-[11px] font-black text-emerald-500 uppercase tracking-wider">OMZET NETTO</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                      Rp {reportData.netRevenue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={exportReportToCSV}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    <span>📥 Export Excel</span>
                  </button>
                  <button
                    onClick={handlePrintPDF}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 active:scale-[0.98] ${currentTheme.buttonPrimary}`}
                  >
                    <span>🖨️ Cetak / PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 17.9 FILTER & SEARCH BAR SECTION */}
        <div className={`border p-4 sm:p-5 rounded-3xl shadow-xl transition-all ${currentTheme.cardBg}`}>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${
            !isSuperAdminToggleActive ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-7'
          } gap-3 sm:gap-4 items-end w-full`}>
            
            <div className="w-full lg:col-span-1">
              <label className={`block text-xs font-bold mb-1.5 ${currentTheme.accentText}`}>Pencarian Data:</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama, WA, atau layanan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-2xl text-xs border focus:outline-none transition-all ${
                    isDark 
                      ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-amber-500/50' 
                      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-amber-500'
                  }`}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full transition-all ${
                      isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    title="Clear Search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {isSuperAdminToggleActive && (
              <div className="w-full">
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Dari Tanggal:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs focus:outline-none shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                />
              </div>
            )}
            {isSuperAdminToggleActive && (
              <div className="w-full">
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Sampai Tanggal:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs focus:outline-none shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                />
              </div>
            )}
            <div className="w-full">
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
              >
                <option value="all">Semua Status</option>
                <option value="pending">🟡 Pending</option>
                <option value="confirmed">🟢 Confirmed</option>
                <option value="completed">🔵 Completed</option>
                <option value="cancelled">🔴 Cancelled</option>
                <option value="cancelled_need_refund">⚠️ Need Refund</option>
              </select>
            </div>
            {isSuperAdminToggleActive && (
              <div className="w-full">
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Layanan:</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                >
                  <option value="all">Semua Layanan</option>
                  {uniqueServices.map((svc) => (
                    <option key={svc} value={svc}>
                      {isEyelash ? '💅' : '✂️'} {svc}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isSuperAdminToggleActive && (
              <div className="w-full">
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Limit Data:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    const val = e.target.value
                    setLimit(val === 'all' ? 'all' : Number(val))
                    setCurrentPage(1)
                  }}
                  className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value="all">Semua Data</option>
                </select>
              </div>
            )}
            <div className="w-full flex gap-2 items-end">
              <div className="w-full">
                <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>Metode Bayar:</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'} ${currentTheme.focusBorder}`}
                >
                  <option value="all">Semua Metode</option>
                  {uniquePayments.map((pay) => (
                    <option key={pay} value={pay}>
                      💳 {pay}
                    </option>
                  ))}
                </select>
              </div>

              {(startDate || endDate || statusFilter !== 'all' || serviceFilter !== 'all' || paymentFilter !== 'all' || searchTerm || limit !== 10) && (
                <button
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                    setStatusFilter('all')
                    setServiceFilter('all')
                    setPaymentFilter('all')
                    setSearchTerm('')
                    setLimit(10)
                  }}
                  className={`px-3 py-2 sm:py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap h-[38px] sm:h-[42px] border ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'}`}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 17.10 RESERVATIONS DATA TABLE */}
        <div className={`border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${currentTheme.cardBg}`}>
          {loading ? (
            <div className={`p-12 text-center text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className={`p-12 text-center text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full">
                  <thead>
                    <tr className={`border-b text-[10px] font-black uppercase tracking-widest select-none ${
                      isDark ? 'border-zinc-800/80 bg-zinc-950/90 text-zinc-400' : 'border-slate-200 bg-slate-100/80 text-slate-600'
                    }`}>
                      <th onClick={() => handleSort('booking_date')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Tanggal</span>
                          {isSuperAdminToggleActive && sortField === 'booking_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('booking_time')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Jam</span>
                          {isSuperAdminToggleActive && sortField === 'booking_time' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('customer_name')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Pelanggan</span>
                          {isSuperAdminToggleActive && sortField === 'customer_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th onClick={() => handleSort('service_name')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Layanan</span>
                          {isSuperAdminToggleActive && sortField === 'service_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      {isSuperAdminToggleActive && (
                        <th onClick={() => handleSort('staff_name')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>{staffLabel}</span>
                            {sortField === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                      )}
                      {isSuperAdminToggleActive && (
                        <th onClick={() => handleSort('payment_method')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>Bayar</span>
                            {sortField === 'payment_method' && (sortOrder === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                      )}
                      {isSuperAdminToggleActive && (
                        <th onClick={() => handleSort('price')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>Harga</span>
                            {sortField === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                      )}
                      <th onClick={() => handleSort('status')} className={`py-3.5 px-3 cursor-pointer transition hover:${currentTheme.accentText}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Status</span>
                          {isSuperAdminToggleActive && sortField === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th className="py-3.5 px-3 text-center">
                        <span className="whitespace-nowrap">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs ${isDark ? 'divide-zinc-800/50' : 'divide-slate-200'}`}>
                    {displayedReservations.map((item) => {
                      // 1. Inisialisasi status dan nomor WhatsApp yang bersih
                      const rawStatus = (item.status || 'pending').toLowerCase()
                      const cleanWa = item.whatsapp_number ? item.whatsapp_number.replace(/[^0-9]/g, '') : ''
                      const price = getItemPrice(item)

                      // 2. Teks & URL WhatsApp untuk Konfirmasi Biasa (Pending/Confirmed/Dll)
                      const waText = `Halo Kak ${item.customer_name}, kami dari ${brandTitle || 'Salon/Barbershop'}. Mau konfirmasi reservasi kamu tanggal ${formatDateID(item.booking_date)} jam ${item.booking_time} WIB untuk layanan ${item.service_name}. Terima kasih!`
                      const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waText)}`

                      // 3. Teks & URL WhatsApp khusus untuk keperluan Refund (Khusus status cancelled_need_refund)
                      const refundWaText = `Halo Kak ${item.customer_name}, terkait pembatalan reservasi layanan ${item.service_name} pada tanggal ${formatDateID(item.booking_date)}, mohon konfirmasikan nomor rekening atau e-wallet (Nama Bank/E-Wallet, No Rekening, dan Atas Nama) untuk proses pengembalian dana (refund) ya. Terima kasih!`
                      const refundWaUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(refundWaText)}`

                      // 4. Kondisi penentu untuk tombol WhatsApp di UI
                      const isNeedRefund = rawStatus === 'cancelled_need_refund'
                      const finalWaUrl = isNeedRefund ? refundWaUrl : waUrl
                      
                      return (
                        <tr key={item.id} className={`transition-all ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                          <td className={`py-3 px-3 font-semibold whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                            {formatDateID(item.booking_date)}
                          </td>
                          <td className={`py-3 px-3 font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                            {item.booking_time}
                          </td>
                          <td className="py-3 px-3">
                            <div className={`font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.customer_name}</div>
                            <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{item.whatsapp_number || '-'}</div>
                          </td>
                          <td className={`py-3 px-3 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                            <span className="line-clamp-2">{item.service_name}</span>
                          </td>
                          {isSuperAdminToggleActive && (
                            <td className={`py-3 px-3 font-medium whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                              {item.staff_name || '-'}
                            </td>
                          )}
                          {isSuperAdminToggleActive && (
                            <td className={`py-3 px-3 font-semibold whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                              <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                                💳 {item.payment_method || 'QRIS'}
                              </span>
                            </td>
                          )}
                          {isSuperAdminToggleActive && (
                            <td className={`py-3 px-3 font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                              Rp {price.toLocaleString('id-ID')}
                            </td>
                          )}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <select
                              value={rawStatus}
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer focus:outline-none transition-all shadow-sm ${
                                rawStatus === 'confirmed' || rawStatus === 'dikonfirmasi'
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                                  : isCompleted(rawStatus)
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                                  : rawStatus === 'cancelled_need_refund'
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                                  : rawStatus === 'cancelled_refunded'
                                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-500'
                                  : rawStatus.startsWith('cancelled') || rawStatus === 'batal'
                                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                                  : 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                              }`}
                            >
                              <option value="pending" className="bg-zinc-900 text-amber-300 font-bold">🟡 Pending</option>
                              <option value="confirmed" className="bg-zinc-900 text-emerald-300 font-bold">🟢 Confirmed</option>
                              <option value="completed" className="bg-zinc-900 text-blue-300 font-bold">🔵 Completed</option>
                              <option value="cancelled" className="bg-zinc-900 text-rose-300 font-bold">🔴 Cancelled</option>
                              <option value="cancelled_need_refund" hidden className="bg-zinc-900 text-amber-300 font-bold">🟠 Need Refund</option>
                              <option value="cancelled_refunded" hidden className="bg-zinc-900 text-purple-300 font-bold">💸 Refunded</option>
                            </select>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-2">
                              {cleanWa && (
                                <a
                                  href={finalWaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
                                    isNeedRefund 
                                      ? 'bg-amber-500/30 border-amber-500/60 text-amber-300 animate-pulse' 
                                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/30'
                                  }`}
                                  title={isNeedRefund ? 'WA Pelanggan: Konfirmasi Rekening Refund' : 'Chat WhatsApp Konfirmasi'}
                                >
                                  💬
                                </a>
                              )}
                              {/* 2. TOMBOL SUDAH REFUND (Hanya muncul saat status cancelled_need_refund) */}
                              {rawStatus === 'cancelled_need_refund' && (
                                <button
                                  onClick={() => handleCompleteRefund(item.id)}
                                  className="bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-xl transition-all font-extrabold text-[10px] shadow-sm active:scale-95 whitespace-nowrap"
                                  title="Tandai Sudah Refund"
                                >
                                  ✓ Refunded
                                </button>
                              )}
                                <button
                                onClick={() => handleDelete(item.id, item.customer_name)}
                                className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-500 flex items-center justify-center hover:bg-rose-500/30 transition-all shadow-sm"
                                title="Hapus Reservasi"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>


              {/* PAGINATION CONTROLS */}
              {isSuperAdminToggleActive && limit !== 'all' && totalPages > 1 && (
                <div className={`p-4 border-t flex items-center justify-between text-xs ${isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-200 bg-slate-100'}`}>
                  <span className={isDark ? 'text-zinc-400' : 'text-slate-600'}>
                    Halaman <strong className={isDark ? 'text-white' : 'text-slate-900'}>{currentPage}</strong> dari <strong className={isDark ? 'text-white' : 'text-slate-900'}>{totalPages}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className={`px-3 py-1.5 rounded-xl border font-bold disabled:opacity-40 transition-all ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Sebelumnya
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className={`px-3 py-1.5 rounded-xl border font-bold disabled:opacity-40 transition-all ${
                        isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>


      {/* MODAL KONFIRMASI PEMBATALAN / REFUND */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`max-w-md w-full border rounded-3xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
            isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase tracking-widest">
                Konfirmasi Pembatalan
              </span>
              <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Batalkan Pesanan: {cancelModalItem.customer_name}?
              </h3>
              <p className={`text-xs ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                Apakah pembatalan ini memerlukan pengembalian dana (refund) kepada pelanggan? Slot jam terkait juga akan otomatis dibuka kembali.
              </p>
            </div>

            <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-2xl space-y-1 text-xs font-mono">
              <p><span className="text-zinc-400">Layanan:</span> {cancelModalItem.service_name}</p>
              <p><span className="text-zinc-400">Jadwal:</span> {formatDateID(cancelModalItem.booking_date)} - {cancelModalItem.booking_time} WIB</p>
              <p><span className="text-zinc-400">Nominal:</span> Rp {getItemPrice(cancelModalItem).toLocaleString('id-ID')}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => handleConfirmCancel(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-3 rounded-2xl text-xs transition-all border border-zinc-700"
              >
                Tanpa Refund ❌
              </button>
              <button
                onClick={() => handleConfirmCancel(true)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-lg shadow-rose-600/30"
              >
                Ya, Perlu Refund 💸
              </button>
            </div>

            <button
              onClick={() => setCancelModalItem(null)}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 font-bold pt-1"
            >
              Batal / Kembali
            </button>
          </div>
        </div>
      )}
    </main>
  )
}