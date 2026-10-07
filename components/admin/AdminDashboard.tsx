// ============================================================================
// 1. IMPORTS & INITIALIZATION
// ============================================================================
'use client'

import { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isPostgrestError } from '@/lib/errorHandler'
import type { Tenant, StaffItem, Reservation, BlockedSlot, DashboardItem } from '@/types'
import { ServiceItem } from '@/types/service'
import LogoutButton from '@/components/shared/LogoutButton'

export const dynamic = 'force-dynamic'

// ============================================================================
// 2. TYPES & INTERFACES
// ============================================================================
type SortField = 'booking_date' | 'booking_time' | 'customer_name' | 'service_name' | 'staff_name' | 'price' | 'payment_method' | 'status'
type SortOrder = 'asc' | 'desc'
type SubscriptionPlanType = 'PROFESIONAL' | 'ULTIMATE'
type ThemeMode = 'purple' | 'pink' | 'amber' | 'emerald' | 'blue' | 'indigo' | 'green'

// ============================================================================
// 3. HELPER FUNCTIONS & CONSTANTS
// ============================================================================
const parseSafeDate = (dateStr?: string): Date | null => {
  if (!dateStr) return null

  // Jika formatnya YYYY-MM-DD murni, parse sebagai waktu lokal
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

const toLocalDateStr = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// 4. MAIN DASHBOARD COMPONENT & STATES
// ============================================================================
interface AdminDashboardProps {
  tenantSlug?: string
}

export default function AdminDashboard({ tenantSlug: propsTenantSlug }: AdminDashboardProps = {}) {
  const params = useParams()
  const activeTenantSlug = useMemo(() => {
    return propsTenantSlug || (params?.tenant_slug as string) || ''
  }, [propsTenantSlug, params])

  const tenantSlug = activeTenantSlug

  const [isInitializing, setIsInitializing] = useState<boolean>(true)
  
  const [brandTitle, setBrandTitle] = useState<string>('Memuat...')
  const [businessType, setBusinessType] = useState<string>('barbershop')
  const [staffLabel, setStaffLabel] = useState<string>('Staff')
  const [staffList, setStaffList] = useState<string[]>([])
  const [controlCenterLabel, setControlCenterLabel] = useState<string>('Control Center')

  // ➕ TAMBAHKAN STATE SERVICES DARI SUPABASE DI SINI
  const [services, setServices] = useState<ServiceItem[]>([])

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantCode, setTenantCode] = useState<string>('')
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null)
  const [financialReportsEnabled, setFinancialReportsEnabled] = useState<boolean>(false)
  
  const [businessFilter, setBusinessFilter] = useState<string>('bulanan')
  const [businessMonth, setBusinessMonth] = useState(String(new Date().getMonth() + 1))
  const [businessYear, setBusinessYear] = useState(String(new Date().getFullYear()))
  
  const [businessPerformanceEnabled, setBusinessPerformanceEnabled] = useState<boolean>(true)
  const [slotBlockingEnabled, setSlotBlockingEnabled] = useState<boolean>(true)
  const [enableMaintenanceFeature, setEnableMaintenanceFeature] = useState<boolean>(false) 
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false) 
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [isSavingMessage, setIsSavingMessage] = useState<boolean>(false)

  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanType>('PROFESIONAL')
  const [isSuperAdminToggleActive, setIsSuperAdminToggleActive] = useState<boolean>(false)
  const [isCustomThemeActive, setIsCustomThemeActive] = useState<boolean>(false)
  const isEyelash = businessType === 'eyelash'
  const isUltimate = subscriptionPlan === 'ULTIMATE'

  const [selectedMode, setSelectedMode] = useState<'dark' | 'light'>('dark')
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('purple')

  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [blockStartDate, setBlockStartDate] = useState('')
  const [blockEndDate, setBlockEndDate] = useState('')
  const [blockMode, setBlockMode] = useState('fullday')
  const [blockTimeInput, setBlockTimeInput] = useState('10:00')
  const [reasonPreset, setReasonPreset] = useState('Libur Lebaran')
  const [blockReasonInput, setBlockReasonInput] = useState('')
  const [isBlocking, setIsBlocking] = useState(false)

  const [isReservationsModalOpen, setIsReservationsModalOpen] = useState(false)
  const [customerReservations, setCustomerReservations] = useState<BlockedSlot[]>([])
  const [isLoadingReservations, setIsLoadingReservations] = useState(false)

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

  const [cancelModalItem, setCancelModalItem] = useState<DashboardItem | null>(null)

  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  // ============================================================================
  // 5. AUXILIARY UTILITY FUNCTIONS
  // ============================================================================
  const getServicePrice = useCallback((serviceName?: string): number => {
  if (!serviceName) return businessType === 'eyelash' ? 120000 : 50000

  // Pastikan servicesList atau services berupa array dari state/props database
  const availableServices = Array.isArray(services) ? services : []

  // Jika nama layanan terdiri dari beberapa item yang dipisah koma (misal: "Potong Rambut, Creambath")
  if (serviceName.includes(',')) {
    const parts = serviceName.split(',').map((s) => s.trim().toLowerCase())
    return parts.reduce((acc, curr) => {
      const matched = availableServices.find(
        (s) => s.name?.trim().toLowerCase() === curr
      )
      const price = matched && typeof matched.price === 'number' 
        ? matched.price 
        : (businessType === 'eyelash' ? 120000 : 50000)
      return acc + price
    }, 0)
  }

  // Jika nama layanan tunggal
  const matched = availableServices.find(
    (s) => s.name?.trim().toLowerCase() === serviceName.trim().toLowerCase()
  )

  return matched && typeof matched.price === 'number'
    ? matched.price
    : (businessType === 'eyelash' ? 120000 : 50000)
}, [businessType, services])

    const getItemPrice = useCallback((item: DashboardItem) => {
    // 1. Prioritaskan harga yang tercatat langsung pada item transaksi
    if (typeof item.total_price === 'number' && !isNaN(item.total_price) && item.total_price > 0) {
      return item.total_price
    }
    if (typeof item.price === 'number' && !isNaN(item.price) && item.price > 0) {
      return item.price
    }

    // 2. Ambil harga dari pencarian dinamis layanan/database
    const dynamicPrice = getServicePrice(typeof item.service_name === 'string' ? item.service_name : undefined)
    if (typeof dynamicPrice === 'number' && !isNaN(dynamicPrice) && dynamicPrice > 0) {
      return dynamicPrice
    }

    // 3. Fallback jika data harga benar-benar tidak ditemukan
    return 0
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
        setCurrentTenant(data)
        setTenantId(data.id)
        setBrandTitle(data.business_name || data.name || target)
        const dbCategory = (data.category || 'barbershop').toLowerCase()
        setBusinessType(dbCategory)
        setTenantCode(data.tenant_slug)
        setStaffLabel(data.staff_label || 'Capster / Staff')
        setControlCenterLabel(data.control_center_label || 'Barber Control Center')
        if (!localStorage.getItem('admin_color_theme') && data.theme_color) {
          setSelectedTheme(data.theme_color as ThemeMode)
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

    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle()

    if (!tenantData) {
      alert('Tenant tidak ditemukan!')
      setLoading(false)
      return
    }

    if (!tenantData.admin_email || tenantData.admin_email.toLowerCase() !== emailInput.toLowerCase()) {
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
      setCurrentTenant(tenantData)
      setTenantId(tenantData.id)
      setBrandTitle(tenantData.business_name || tenantData.name)
      setBusinessType((tenantData.category || 'barbershop').toLowerCase())
      setTenantCode(tenantData.tenant_slug)
      setControlCenterLabel(tenantData.control_center_label || 'Control Center')
      const savedColorTheme = typeof window !== 'undefined' ? localStorage.getItem('admin_color_theme') : null
      if (!savedColorTheme) {
        setSelectedTheme((tenantData.theme_color || 'purple') as ThemeMode)
      }
      if (tenantData.subscription_plan) {
        const rawPlan = tenantData.subscription_plan.toUpperCase()
        setSubscriptionPlan(rawPlan === 'ULTIMATE' ? 'ULTIMATE' : 'PROFESIONAL')
      }
      if (tenantData.super_admin_toggle !== undefined) {
        setIsSuperAdminToggleActive(Boolean(tenantData.super_admin_toggle))
      } else if (tenantData.is_super_admin_active !== undefined) {
        setIsSuperAdminToggleActive(Boolean(tenantData.is_super_admin_active))
      }
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = `/admin/${tenantSlug}`
  }

  // ============================================================================
  // 8. BLOCKED SLOTS MANAGEMENT
  // ============================================================================
  const fetchBlockedSlots = useCallback(async () => {
    if (!tenantId) return
    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('reason', 'ilike', '%Otomatis: Booking Confirmed%')
      .order('block_date', { ascending: true })

    if (!error && data) {
      setBlockedSlots(data)
    }
  }, [tenantId])

  const handleAddBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blockStartDate || !blockEndDate) {
      alert("Pilih tanggal yang ingin diblokir!")
      return
    }
    if (blockEndDate < blockStartDate) {
      alert("Tanggal selesai tidak boleh lebih awal dari tanggal mulai!")
      return
    }
    setIsBlocking(true)

    try {
      const finalReason = reasonPreset === 'Lainnya' 
        ? blockReasonInput 
        : (blockReasonInput ? `${reasonPreset} - ${blockReasonInput}` : reasonPreset)

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
      }

      const { error } = await supabase
        .from('blocked_slots')
        .insert([payload])

      if (error) throw error

      setBlockStartDate('')
      setBlockEndDate('')
      setBlockTimeInput('09:00')
      setBlockReasonInput('')
      
      fetchBlockedSlots()
      alert("Berhasil memblokir slot/tanggal!")
    } catch (err: unknown) {
      let errorMsg = "Terjadi kesalahan yang tidak diketahui."
      if (isPostgrestError(err)) {
        errorMsg = err.message || err.details || err.hint
      } else if (err instanceof Error) {
        errorMsg = err.message
      } else {
        errorMsg = String(err)
      }
      console.error("Gagal memblokir slot:", err)
      alert("Gagal menyimpan data: " + errorMsg)
    } finally {
      setIsBlocking(false)
    }
  }

  const handleDeleteBlockSlot = async (id?: number | string) => {
    if (!id) return

    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus slot: ' + error.message)
    } else {
      fetchBlockedSlots()
    }
  }

  const fetchCustomerReservations = useCallback(async () => {
    if (!tenantId) return
    setIsLoadingReservations(true)
    try {
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('reason', '%Otomatis: Booking Confirmed%')
        .order('block_date', { ascending: false })

      if (error) throw error
      setCustomerReservations(data || [])
    } catch (err: unknown) {
      console.error("Gagal memuat reservasi pelanggan:", err)
    } finally {
      setIsLoadingReservations(false)
    }
  }, [tenantId])

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

    const newSlotsToInsert = confirmedList
      .filter((item) => !existingSlots.some((b) => b.block_date === item.booking_date && b.block_time === item.booking_time))
      .map((item) => ({
        tenant_id: tenantId,
        tenant_slug: tenantSlug,
        block_date: item.booking_date,
        date: item.booking_date,
        block_time: item.booking_time,
        start_time: item.booking_time,
        reason: `Otomatis: Booking Confirmed (${item.customer_name || 'Pelanggan'})`
      }))

    if (newSlotsToInsert.length > 0) {
      await supabase.from('blocked_slots').insert(newSlotsToInsert)
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

      if (fetchedData.length > 0) {
        syncConfirmedSlotsToBlocked(fetchedData)
      }
    }
    setLoading(false)
  }, [tenantId, syncConfirmedSlotsToBlocked])

  const updateStatusInDB = async (id: number | string, newStatus: string) => {
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
      fetchBlockedSlots()
    }
  }

  const handleStatusChange = (item: Reservation, newStatus: string) => {
    if (newStatus === 'cancelled' || newStatus === 'cancelled_need_refund') {
      setCancelModalItem(item)
      return
    }

    if (!item.id) return
    updateStatusInDB(item.id, newStatus)
  }

  const handleConfirmCancel = async (needRefund: boolean) => {
    if (!cancelModalItem || !cancelModalItem.id) return
    const statusText = needRefund ? 'cancelled_need_refund' : 'cancelled'
    await updateStatusInDB(cancelModalItem.id, statusText)
    setCancelModalItem(null)
  }

  const handleCompleteRefund = async (id?: number | string) => {
    if (!id) return
    const isConfirmed = window.confirm('Apakah kamu yakin refund untuk pesanan ini sudah ditransfer balik ke pelanggan?')
    if (!isConfirmed) return
    await updateStatusInDB(id, 'cancelled_refunded')
  }

  const handleDelete = useCallback(async (id?: number | string, customerName?: string) => {
    if (!id) return
    const displayName = customerName || 'Pelanggan'
    const isConfirmed = window.confirm(`Apakah kamu yakin ingin menghapus data reservasi atas nama "${displayName}"?`)
    if (!isConfirmed) return

    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus data: ' + error.message)
    } else {
      await fetchReservations()
      fetchBlockedSlots()
    }
  }, [fetchReservations, fetchBlockedSlots])

  const fetchServices = useCallback(async () => {
  if (!tenantSlug && !tenantCode) return
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .or(`client_code.eq.${tenantCode || tenantSlug},tenant_slug.eq.${tenantSlug}`)

    if (error) {
      console.error('Error fetching services:', error)
      return
    }

    if (data) {
      setServices(data)
    }
  } catch (err) {
    console.error('Fetch services error:', err)
  }
}, [tenantSlug, tenantCode])

  const fetchStaffList = useCallback(async () => {
    if (!tenantId) return
    const { data, error } = await supabase
      .from('staff')
      .select('name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (!error && data) {
      setStaffList(data.map((s) => s.name))
    }
  }, [tenantId])

  const handleSaveMaintenanceMessage = async () => {
    if (!tenantId) return
    setIsSavingMessage(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          is_maintenance_mode: isMaintenanceMode,
          maintenance_message: maintenanceMessage
        })
        .eq('id', tenantId)

      if (error) throw error
      alert('Pengaturan pemeliharaan berhasil disimpan!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan'
      alert('Error: ' + msg)
    } finally {
      setIsSavingMessage(false)
    }
  }

  // ============================================================================
  // 10. STATS & REPORT CALCULATIONS
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
    }
  }, [reservations, getItemPrice])

  const reportData = useMemo(() => {
    const dateFiltered = reservations.filter((item) => {
      const itemDate = item.booking_date || ''
      if (!itemDate) return false

      if (reportPeriod === 'daily') return itemDate === reportDate
      if (reportPeriod === 'weekly') {
        const weekInfo = getWeekRangeFromStart(reportDate)
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
    const list = new Set(reservations.map((r) => r.service_name).filter((name): name is string => Boolean(name)))
    return Array.from(list)
  }, [reservations])

  const uniquePayments = useMemo(() => {
    const list = new Set(reservations.map((r) => r.payment_method || 'QRIS').filter(Boolean))
    return Array.from(list)
  }, [reservations])

  const filteredReservations = useMemo(() => {
    let result = [...reservations]
    const isModeStandard = !isSuperAdminToggleActive

    if (isModeStandard) {
      result = result.slice(0, 5)
    } else {
      if (subscriptionPlan === 'PROFESIONAL') {
        result = result.slice(0, 5)
      }
    }

    if (!isModeStandard) {
      if (startDate) result = result.filter((item) => (item.booking_date || '') >= startDate)
      if (endDate) result = result.filter((item) => (item.booking_date || '') <= endDate)
      if (serviceFilter !== 'all') result = result.filter((item) => item.service_name === serviceFilter)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item: DashboardItem) => {
        const customerName = typeof item.customer_name === 'string' ? item.customer_name.toLowerCase() : ''
        const whatsapp = typeof item.whatsapp_number === 'string' ? item.whatsapp_number : ''
        const serviceName = typeof item.service_name === 'string' ? item.service_name.toLowerCase() : ''
        const staffName = typeof item.staff_name === 'string' ? item.staff_name.toLowerCase() : ''

        return (
          customerName.includes(term) ||
          whatsapp.includes(term) ||
          serviceName.includes(term) ||
          staffName.includes(term)
        )
      })
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
        let valA: string | number = ''
        let valB: string | number = ''

        if (sortField === 'booking_date') {
          valA = typeof a.booking_date === 'string' ? a.booking_date : ''
          valB = typeof b.booking_date === 'string' ? b.booking_date : ''
        } else if (sortField === 'booking_time') {
          valA = typeof a.booking_time === 'string' ? a.booking_time : ''
          valB = typeof b.booking_time === 'string' ? b.booking_time : ''
        } else if (sortField === 'customer_name') {
          valA = typeof a.customer_name === 'string' ? a.customer_name.toLowerCase() : ''
          valB = typeof b.customer_name === 'string' ? b.customer_name.toLowerCase() : ''
        } else if (sortField === 'service_name') {
          valA = typeof a.service_name === 'string' ? a.service_name.toLowerCase() : ''
          valB = typeof b.service_name === 'string' ? b.service_name.toLowerCase() : ''
        } else if (sortField === 'staff_name') {
          valA = typeof a.staff_name === 'string' ? a.staff_name.toLowerCase() : ''
          valB = typeof b.staff_name === 'string' ? b.staff_name.toLowerCase() : ''
        } else if (sortField === 'price') {
          valA = getItemPrice(a)
          valB = getItemPrice(b)
        } else if (sortField === 'payment_method') {
          valA = typeof a.payment_method === 'string' ? a.payment_method.toLowerCase() : 'qris'
          valB = typeof b.payment_method === 'string' ? b.payment_method.toLowerCase() : 'qris'
        } else if (sortField === 'status') {
          valA = typeof a.status === 'string' ? a.status.toLowerCase() : 'pending'
          valB = typeof b.status === 'string' ? b.status.toLowerCase() : 'pending'
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [
    reservations,
    isSuperAdminToggleActive,
    subscriptionPlan,
    startDate,
    endDate,
    serviceFilter,
    searchTerm,
    statusFilter,
    paymentFilter,
    sortField,
    sortOrder,
    getItemPrice
  ])

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
  // 13. LIFECYCLE EFFECTS
  // ============================================================================
  useEffect(() => {
    const savedMode = localStorage.getItem('admin_theme_mode')
    if (savedMode === 'light' || savedMode === 'dark') {
      setSelectedMode(savedMode)
    }

    const savedTheme = localStorage.getItem('admin_color_theme')
    if (savedTheme) {
      setSelectedTheme(savedTheme as ThemeMode)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initSession = async () => {
      if (!tenantSlug) return
      
      try {
        setIsInitializing(true)
        
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('tenant_slug', tenantSlug)
          .maybeSingle()

        if (tenantError) {
          console.error("Error fetching tenant:", tenantError)
        }

        if (!tenantData) {
          if (isMounted) {
            setIsInitializing(false)
          }
          return
        }

        if (isMounted) {
          setCurrentTenant(tenantData)
          setTenantId(tenantData.id)
          setBrandTitle(tenantData.business_name || tenantData.name)
          setBusinessType((tenantData.category || 'barbershop').toLowerCase())
          setTenantCode(tenantData.tenant_slug)
          setControlCenterLabel(tenantData.control_center_label || 'Control Center')

          const savedColorTheme = typeof window !== 'undefined' ? localStorage.getItem('admin_color_theme') : null
          if (!savedColorTheme) {
            setSelectedTheme((tenantData.theme_color || 'purple') as ThemeMode)
          }

          setFinancialReportsEnabled(Boolean(tenantData.financial_reports))
          setBusinessPerformanceEnabled(Boolean(tenantData.business_performance ?? true))
          setSlotBlockingEnabled(tenantData.enable_slot_blocking ?? false)
          
          setEnableMaintenanceFeature(Boolean(tenantData.is_system_maintenance || tenantData.enable_maintenance_feature))
          setIsMaintenanceMode(Boolean(tenantData.is_maintenance_mode))
          setMaintenanceMessage(tenantData.maintenance_message || '')

          if (tenantData.subscription_plan) {
            setSubscriptionPlan(tenantData.subscription_plan.toUpperCase() === 'ULTIMATE' ? 'ULTIMATE' : 'PROFESIONAL')
          }

          const activeToggle = tenantData.super_admin_toggle ?? tenantData.is_super_admin_active ?? tenantData.is_active
          if (activeToggle !== undefined) {
            setIsSuperAdminToggleActive(Boolean(activeToggle))
          }

          if (tenantData.custom_dashboard_theme !== undefined) {
            setIsCustomThemeActive(Boolean(tenantData.custom_dashboard_theme))
          }
        }

        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const userEmail = user.email
          if (tenantData?.admin_email && tenantData.admin_email.toLowerCase() !== userEmail?.toLowerCase()) {
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
        console.error("Initialization error:", err)
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initSession()

    return () => {
      isMounted = false
    }
  }, [tenantSlug])

  useEffect(() => {
    if (tenantId) {
      fetchReservations()
      fetchBlockedSlots()
      fetchStaffList()
      fetchServices()
    }
  }, [tenantId, fetchReservations, fetchBlockedSlots, fetchStaffList, fetchServices])

  useEffect(() => {
    if (tenantSlug && !currentTenant) {
      fetchTenantDetail(tenantSlug)
    }
  }, [tenantSlug, currentTenant, fetchTenantDetail])

  // ============================================================================
  // 14. DYNAMIC THEME SYSTEM COMPUTATION
  // ============================================================================
  const isDark = selectedMode === 'dark'

  const getUltimateThemeStyles = () => {
    if (!isCustomThemeActive) {
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
      }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
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
          }
      }
    }
  }

  const currentTheme = getUltimateThemeStyles()

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
  
  // ============================================================================
  // 17. MAIN DASHBOARD UI (AUTHENTICATED)
  // ============================================================================
  return (
    <main className={`min-h-screen p-3 sm:p-6 md:p-8 font-sans relative transition-all duration-700 ${currentTheme.bg}`}>
      {/* BACKGROUND GLOW DECORATION */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute -top-[10%] -left-[10%] w-[650px] h-[650px] rounded-full blur-[180px] opacity-35 transition-all duration-700 ${isDark ? 'bg-purple-600/30' : 'bg-cyan-400/30'}`}></div>
        <div className={`absolute top-[40%] -right-[10%] w-[750px] h-[750px] rounded-full blur-[200px] opacity-35 transition-all duration-700 ${isDark ? 'bg-indigo-600/30' : 'bg-purple-300/40'}`}></div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">

        {/* ======================================================================== */}
        {/* 17.1 HEADER SECTION (STANDARDIZED WITH PERFORMANCE GRAPH STYLING)             */}
        {/* ======================================================================== */}
        <header className={'border p-5 sm:p-6 rounded-3xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.headerBg}>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span className="text-xl sm:text-2xl"></span>
              <h1 className={'text-xl sm:text-2xl md:text-3xl font-black tracking-tight uppercase flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                {controlCenterLabel || `${brandTitle} CONTROL CENTER`}
              </h1>
              <span className={'text-[9px] sm:text-[10px] font-black px-3.5 py-1.5 rounded-full border tracking-widest uppercase flex items-center gap-1.5 transition-all shadow-sm ' + (isCustomThemeActive ? currentTheme.badge : 'bg-zinc-900 text-zinc-400 border-zinc-800')}>
                {subscriptionPlan || 'ULTIMATE'} SYSTEM
              </span>
            </div>
            <p className={'text-[11px] sm:text-xs mt-1 font-medium ' + (isDark ? 'text-zinc-400' : 'text-slate-500')}>
              Kelola dan pantau pesanan masuk secara real-time untuk{' '}
              <span className={'font-bold ' + (isDark ? 'text-white' : 'text-slate-800')}>{brandTitle}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            <div className={'flex items-center gap-3 p-2 px-3.5 rounded-2xl border backdrop-blur-xl shadow-sm ' + (isDark ? 'bg-zinc-950/85 border-zinc-800' : 'bg-white/85 border-slate-200')}>
              {/* Dark / Light Mode Switcher */}
              <div className="flex items-center bg-black/10 dark:bg-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMode('dark')
                    localStorage.setItem('admin_theme_mode', 'dark')
                  }}
                  className={'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ' + (isDark ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800')}
                >
                  🌙 Dark
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMode('light')
                    localStorage.setItem('admin_theme_mode', 'light')
                  }}
                  className={'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ' + (!isDark ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-zinc-400 hover:text-zinc-200')}
                >
                  ☀️ Light
                </button>
              </div>

              {/* Color Theme Selector Circles */}
              {isCustomThemeActive && (
                <>
                  <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700"></div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setSelectedTheme('purple'); localStorage.setItem('admin_color_theme', 'purple'); }}
                      className={'w-5 h-5 rounded-full bg-purple-600 border-2 transition-all ' + (selectedTheme === 'purple' ? 'border-white scale-125 shadow-md ring-2 ring-purple-400' : 'border-transparent opacity-60 hover:opacity-100')}
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedTheme('pink'); localStorage.setItem('admin_color_theme', 'pink'); }}
                      className={'w-5 h-5 rounded-full bg-pink-500 border-2 transition-all ' + (selectedTheme === 'pink' ? 'border-white scale-125 shadow-md ring-2 ring-pink-400' : 'border-transparent opacity-60 hover:opacity-100')}
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedTheme('amber'); localStorage.setItem('admin_color_theme', 'amber'); }}
                      className={'w-5 h-5 rounded-full bg-amber-400 border-2 transition-all ' + (selectedTheme === 'amber' ? 'border-white scale-125 shadow-md ring-2 ring-amber-300' : 'border-transparent opacity-60 hover:opacity-100')}
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedTheme('emerald'); localStorage.setItem('admin_color_theme', 'emerald'); }}
                      className={'w-5 h-5 rounded-full bg-emerald-500 border-2 transition-all ' + (selectedTheme === 'emerald' ? 'border-white scale-125 shadow-md ring-2 ring-emerald-400' : 'border-transparent opacity-60 hover:opacity-100')}
                    />
                    <button
                      type="button"
                      onClick={() => { setSelectedTheme('blue'); localStorage.setItem('admin_color_theme', 'blue'); }}
                      className={'w-5 h-5 rounded-full bg-cyan-500 border-2 transition-all ' + (selectedTheme === 'blue' ? 'border-white scale-125 shadow-md ring-2 ring-cyan-300' : 'border-transparent opacity-60 hover:opacity-100')}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => { fetchReservations() }}
                className={'px-4 py-2.5 rounded-xl font-bold transition-all text-[11px] sm:text-xs border shadow-sm ' + (isDark ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200')}
              >
                Refresh
              </button>

              <LogoutButton onLogout={handleLogout} />
            </div>
          </div>
        </header>

        {/* ======================================================================== */}
        {/* 17.2 STATS OVERVIEW SECTION (5 TOP CARDS STANDARDIZED)                 */}
        {/* ======================================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: TOTAL OMZET */}
          <div className={'border p-5 rounded-3xl transition-all flex justify-between items-start relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
            <div>
              <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider">TOTAL OMZET</p>
              <p className={'text-2xl font-black mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                Rp {(stats.totalRevenue || 0).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {stats.completedCount || 0} transaksi selesai
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/30 to-amber-700/20 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-amber-500/20">
              💰
            </div>
          </div>

          {/* Card 2: TOTAL BOOKING */}
          <div className={'border p-5 rounded-3xl transition-all flex justify-between items-center relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
            <div>
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">TOTAL BOOKING</p>
              <p className={'text-2xl font-black mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>{stats.totalBookings || 0}</p>
            </div>
            <button 
              type="button"
              onClick={() => setLimit('all')} 
              className={'px-3 py-1.5 text-[11px] font-bold rounded-xl border transition shadow-sm ' + (isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300')}
            >
              Semua Data
            </button>
          </div>

          {/* Card 3: MENUNGGU */}
          <div className={'border p-5 rounded-3xl transition-all flex justify-between items-center relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
            <div>
              <p className="text-[11px] font-black text-amber-400 uppercase tracking-wider">MENUNGGU</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{stats.pendingCount || 0}</p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-extrabold text-amber-300 bg-amber-950/60 rounded-lg border border-amber-700/40 uppercase shadow-sm">
              Konfirmasi
            </span>
          </div>

          {/* Card 4: SELESAI */}
          <div className={'border p-5 rounded-3xl transition-all flex justify-between items-center relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
            <div>
              <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">SELESAI</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{stats.completedCount || 0}</p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-extrabold text-emerald-300 bg-emerald-950/60 rounded-lg border border-emerald-700/40 shadow-sm">
              {stats.totalBookings > 0 ? Math.round((stats.completedCount / stats.totalBookings) * 100) : 0}%
            </span>
          </div>

          {/* Card 5: PEMBATALAN */}
          <div className={'border p-5 rounded-3xl transition-all flex justify-between items-center relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
            <div>
              <p className="text-[11px] font-black text-rose-400 uppercase tracking-wider">PEMBATALAN</p>
              <p className="text-2xl font-black text-rose-400 mt-1">{stats.cancelledCount || 0}</p>
            </div>
            <span className="px-2.5 py-1 text-[10px] font-extrabold text-rose-300 bg-rose-950/60 rounded-lg border border-rose-700/40 shadow-sm">
              {stats.totalBookings > 0 ? Math.round((stats.cancelledCount / stats.totalBookings) * 100) : 0}%
            </span>
          </div>
        </section>

      {/* ======================================================================== */}
      {/* 17.3 PERFORMANCE & ANALYTICS SECTION (PERFORMA USAHA & STAFF)          */}
      {/* ======================================================================== */}
      {isSuperAdminToggleActive && businessPerformanceEnabled && (
        <section className="flex flex-col gap-6">
          {(() => {
            const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
            const dayNamesFull = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

            const formatCurrency = (amt: number) => {
              if (amt >= 1000000) return `Rp ${(amt / 1000000).toFixed(1)}jt`;
              if (amt >= 1000) return `Rp ${(amt / 1000).toFixed(0)}rb`;
              return `Rp ${amt}`;
            };

            const completedAllRes = reservations.filter(r => r.booking_date && isCompleted(r.status));

            // 1. LOGIKA DATA BUSINESS CHART
            let actualBusinessData: { label: string; subLabel?: string; count: number; amount: string; rawAmount: number }[] = [];

            if (businessFilter === 'harian') {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const last7Days: Date[] = [];
              for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                last7Days.push(d);
              }

              actualBusinessData = last7Days.map(dateObj => {
                const dateStr = toLocalDateStr(dateObj);

                const dayRes = completedAllRes.filter(r => {
                  const bookingDate = parseSafeDate(r.booking_date);
                  return bookingDate ? toLocalDateStr(bookingDate) === dateStr : false;
                });

                const totalAmt = dayRes.reduce((acc, r) => acc + getItemPrice(r), 0);

                return {
                  label: dayNamesShort[dateObj.getDay()],
                  subLabel: `${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
                  count: dayRes.length,
                  amount: formatCurrency(totalAmt),
                  rawAmount: totalAmt
                };
              });

            } else if (businessFilter === 'mingguan') {
              const selectedM = Number(businessMonth);
              const selectedY = Number(businessYear);
              const monthRes = completedAllRes.filter(r => {
                const d = parseSafeDate(r.booking_date);
                return d ? (d.getMonth() + 1) === selectedM && d.getFullYear() === selectedY : false;
              });
              const daysInMonth = new Date(selectedY, selectedM, 0).getDate();
              const totalWeeks = Math.ceil(daysInMonth / 7);
              const weekSums = Array(totalWeeks).fill(0);
              const weekCounts = Array(totalWeeks).fill(0);

              monthRes.forEach(r => {
                const d = parseSafeDate(r.booking_date);
                if (d) {
                  const dayNum = d.getDate();
                  const weekIdx = Math.min(Math.floor((dayNum - 1) / 7), totalWeeks - 1);
                  weekSums[weekIdx] += getItemPrice(r);
                  weekCounts[weekIdx] += 1;
                }
              });

              actualBusinessData = weekSums.map((amt, idx) => ({
                label: `Mgu ${idx + 1}`,
                subLabel: `Tgl ${idx * 7 + 1}-${Math.min((idx + 1) * 7, daysInMonth)}`,
                count: weekCounts[idx],
                amount: formatCurrency(amt),
                rawAmount: amt
              }));

            } else if (businessFilter === 'bulanan') {
              const selectedY = Number(businessYear);
              const yearRes = completedAllRes.filter(r => {
                const d = parseSafeDate(r.booking_date);
                return d ? d.getFullYear() === selectedY : false;
              });
              const monthSums = Array(12).fill(0);
              const monthCounts = Array(12).fill(0);

              yearRes.forEach(r => {
                const d = parseSafeDate(r.booking_date);
                if (d) {
                  const mIdx = d.getMonth();
                  monthSums[mIdx] += getItemPrice(r);
                  monthCounts[mIdx] += 1;
                }
              });

              actualBusinessData = monthSums.map((amt, idx) => ({
                label: monthNamesShort[idx],
                count: monthCounts[idx],
                amount: formatCurrency(amt),
                rawAmount: amt
              }));

            } else if (businessFilter === 'tahunan') {
              const currentYear = new Date().getFullYear();
              const startYear = currentYear - 4;
              const yearSums = Array(5).fill(0);
              const yearCounts = Array(5).fill(0);

              completedAllRes.forEach(r => {
                const d = parseSafeDate(r.booking_date);
                if (d) {
                  const rYear = d.getFullYear();
                  if (rYear >= startYear && rYear <= currentYear) {
                    const idx = rYear - startYear;
                    yearSums[idx] += getItemPrice(r);
                    yearCounts[idx] += 1;
                  }
                }
              });

              actualBusinessData = yearSums.map((amt, idx) => ({
                label: String(startYear + idx),
                count: yearCounts[idx],
                amount: formatCurrency(amt),
                rawAmount: amt
              }));
            }

            // 2. LOGIKA ANALYTICS & INSIGHT FORMULA
            const dayTrafficCounts = Array(7).fill(0);
            completedAllRes.forEach(r => {
              dayTrafficCounts[new Date(r.booking_date || '').getDay()] += 1;
            });
            const totalAllTrx = completedAllRes.length;
            const maxDayCount = Math.max(...dayTrafficCounts, 0);
            const busiestDayIndex = dayTrafficCounts.indexOf(maxDayCount);
            const busiestDayName = maxDayCount > 0 ? dayNamesFull[busiestDayIndex] : '-';
            const busiestDayPct = totalAllTrx > 0 ? ((maxDayCount / totalAllTrx) * 100).toFixed(1) : '0';

            const selectedYearNum = Number(businessYear);
            const selectedYearRes = completedAllRes.filter(r => new Date(r.booking_date || '').getFullYear() === selectedYearNum);
            const mCounts = Array(12).fill(0);
            selectedYearRes.forEach(r => {
              mCounts[new Date(r.booking_date || '').getMonth()] += 1;
            });
            const maxMonthCount = Math.max(...mCounts, 0);
            const peakMonthIndex = mCounts.indexOf(maxMonthCount);
            const peakMonthName = maxMonthCount > 0 ? monthNamesShort[peakMonthIndex] : '-';
            const peakMonthPct = selectedYearRes.length > 0 ? ((maxMonthCount / selectedYearRes.length) * 100).toFixed(1) : '0';

            const currentYearVal = new Date().getFullYear();
            const startYearVal = currentYearVal - 4;
            const yCounts = Array(5).fill(0);
            let total5YearTrx = 0;

            completedAllRes.forEach(r => {
              const y = new Date(r.booking_date || '').getFullYear();
              if (y >= startYearVal && y <= currentYearVal) {
                yCounts[y - startYearVal] += 1;
                total5YearTrx += 1;
              }
            });
            const maxYearCount = Math.max(...yCounts, 0);
            const peakYearIndex = yCounts.indexOf(maxYearCount);
            const peakYearVal = maxYearCount > 0 ? (startYearVal + peakYearIndex) : '-';
            const peakYearPct = total5YearTrx > 0 ? ((maxYearCount / total5YearTrx) * 100).toFixed(1) : '0';

            const maxCount = Math.max(1, ...actualBusinessData.map((i) => i.count));

            // WARNA GRADIENT BAR
            const barGradients = [
              { 
                bar: 'from-amber-400 to-orange-500', 
                glow: 'shadow-orange-500/40', 
                badge: isDark 
                  ? 'bg-amber-500/30 text-amber-200 border-amber-400/50' 
                  : 'bg-amber-100 text-amber-900 border-amber-400' 
              },
              { 
                bar: 'from-emerald-400 to-teal-500', 
                glow: 'shadow-emerald-500/40', 
                badge: isDark 
                  ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50' 
                  : 'bg-emerald-100 text-emerald-900 border-emerald-400' 
              },
              { 
                bar: 'from-cyan-400 to-blue-600', 
                glow: 'shadow-blue-500/40', 
                badge: isDark 
                  ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50' 
                  : 'bg-cyan-100 text-cyan-900 border-cyan-400' 
              },
              { 
                bar: 'from-purple-400 to-indigo-600', 
                glow: 'shadow-purple-500/40', 
                badge: isDark 
                  ? 'bg-purple-500/30 text-purple-200 border-purple-400/50' 
                  : 'bg-purple-100 text-purple-900 border-purple-400' 
              },
              { 
                bar: 'from-fuchsia-400 to-pink-600', 
                glow: 'shadow-pink-500/40', 
                badge: isDark 
                  ? 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/50' 
                  : 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-400' 
              },
              { 
                bar: 'from-rose-400 to-red-600', 
                glow: 'shadow-rose-500/40', 
                badge: isDark 
                  ? 'bg-rose-500/30 text-rose-200 border-rose-400/50' 
                  : 'bg-rose-100 text-rose-900 border-rose-400' 
              },
              { 
                bar: 'from-slate-300 to-zinc-500', 
                glow: 'shadow-zinc-500/40', 
                badge: isDark 
                  ? 'bg-zinc-500/30 text-zinc-200 border-zinc-400/50' 
                  : 'bg-zinc-200 text-zinc-900 border-zinc-400' 
              },
            ];

            // LOGIKA STAFF PERFORMANCE
            const currentStaffList: StaffItem[] = Array.isArray(staffList) ? (staffList as unknown as StaffItem[]) : []

            const registeredStaffNames = currentStaffList
              .map(s => (s?.name || s?.staff_name || s?.nama || '').trim())
              .filter(Boolean)

            const staffFilteredRes = reservations.filter((r: Reservation) => {
              if (!r?.booking_date || !isCompleted(r.status)) return false
              const d = new Date(r.booking_date)

              if (businessFilter === 'harian') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 6);
                const rDate = new Date(d);
                rDate.setHours(0, 0, 0, 0);
                return rDate >= sevenDaysAgo && rDate <= today;
              } else if (businessFilter === 'mingguan') {
                return String(d.getMonth() + 1) === String(businessMonth) && String(d.getFullYear()) === String(businessYear);
              } else if (businessFilter === 'bulanan') {
                return String(d.getFullYear()) === String(businessYear);
              } else if (businessFilter === 'tahunan') {
                const currentYear = new Date().getFullYear();
                const startYear = currentYear - 4;
                const rYear = d.getFullYear();
                return rYear >= startYear && rYear <= currentYear;
              }
              return true;
            });

            const staffMap: Record<string, number> = {}
            staffFilteredRes.forEach((r: Reservation) => {
              const staffName = r?.staff_name || (r as unknown as { staff?: string })?.staff || ''
              if (staffName) {
                staffMap[staffName] = (staffMap[staffName] || 0) + 1
              }
            })

            const combinedStaffSet = new Set<string>([...registeredStaffNames, ...Object.keys(staffMap)]);
            const allStaffKeys: string[] = combinedStaffSet.size > 0 ? Array.from(combinedStaffSet) : ['Unassigned Staff'];

            const staffData = allStaffKeys
              .map((name: string) => ({
                label: name,
                count: staffMap[name] || 0
              }))
              .sort((a, b) => b.count - a.count);

            const maxStaffVal = Math.max(1, ...staffData.map((s: { count: number }) => s.count));

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* KOLOM KIRI (7/12): PERFORMA USAHA (GRAFIK OMZET) */}
                <div className={'lg:col-span-7 border p-5 sm:p-6 rounded-3xl transition-all flex flex-col justify-between gap-6 relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
                  
                  {/* HEADER & FILTER */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-teal-700/30 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-emerald-500/10">
                        📊
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={'text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full border shadow-sm ' + currentTheme.badgeBg}>
                            Performa Usaha ({businessFilter})
                          </span>
                        </div>
                        <h3 className={'text-base sm:text-lg font-black mt-1 tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          Grafik Omzet & Transaksi
                        </h3>
                      </div>
                    </div>

                    {/* FILTER TABS */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={'flex items-center p-1 rounded-xl border backdrop-blur-md ' + (isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-200 border-slate-300')}>
                        {['harian', 'mingguan', 'bulanan', 'tahunan'].map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setBusinessFilter(tab)}
                            className={'px-3 py-1 text-xs font-black rounded-lg transition-all capitalize ' + (
                              businessFilter === tab 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' 
                                : (isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                            )}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ARENA CHART */}
                  <div className={'pt-8 border-t flex flex-col justify-end flex-1 min-h-[320px] relative px-2 ' + (isDark ? 'border-zinc-800/60' : 'border-slate-200')}>
                    <div className="absolute inset-x-0 top-6 bottom-12 flex flex-col justify-between pointer-events-none opacity-20">
                      <div className={'border-b border-dashed w-full ' + (isDark ? 'border-zinc-400' : 'border-slate-400')} />
                      <div className={'border-b border-dashed w-full ' + (isDark ? 'border-zinc-400' : 'border-slate-400')} />
                      <div className={'border-b border-dashed w-full ' + (isDark ? 'border-zinc-400' : 'border-slate-400')} />
                      <div className={'border-b border-dashed w-full ' + (isDark ? 'border-zinc-400' : 'border-slate-400')} />
                    </div>

                    <div className="w-full h-full flex items-end justify-between gap-1.5 sm:gap-3 z-10 pb-1 overflow-x-auto">
                      {actualBusinessData.map((item, idx: number) => {
                        const heightPct = item.count > 0 ? Math.max(Math.round((item.count / maxCount) * 80), 14) : 8;
                        const style = barGradients[idx % barGradients.length];

                        return (
                          <div key={idx} className="flex flex-col items-center h-full justify-end group relative flex-1 min-w-[32px]">
                            <div className="mb-2 flex flex-col items-center gap-1 whitespace-nowrap transition-all duration-300 group-hover:-translate-y-1">
                              <span className={'text-[11px] sm:text-[12px] font-black tracking-tight drop-shadow-sm ' + (
                                item.rawAmount > 0 
                                  ? (isDark ? 'text-white' : 'text-slate-900') 
                                  : (isDark ? 'text-zinc-500' : 'text-slate-500')
                              )}>
                                {item.rawAmount > 0 ? item.amount : 'Rp 0'}
                              </span>
                              <div className={`px-2 py-0.5 rounded-full border text-[9px] sm:text-[10px] font-black shadow-md backdrop-blur-md transition-all ${
                                item.count > 0 
                                  ? style.badge 
                                  : (isDark ? 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60' : 'bg-slate-200 text-slate-700 border-slate-300')
                              }`}>
                                {item.count} Trx
                              </div>
                            </div>

                            <div className={'w-full max-w-[32px] sm:max-w-[44px] rounded-t-2xl p-1 flex flex-col justify-end h-full border ' + (
                              isDark ? 'bg-zinc-800/40 border-zinc-700/30' : 'bg-slate-100 border-slate-300'
                            )}>
                              <div 
                                className={`w-full rounded-t-xl bg-gradient-to-t ${
                                  item.count > 0 
                                    ? style.bar 
                                    : (isDark ? 'from-zinc-800 to-zinc-700' : 'from-slate-300 to-slate-400')
                                } transition-all duration-500 shadow-lg group-hover:brightness-125 ${item.count > 0 ? style.glow : ''}`}
                                style={{ height: heightPct + '%' }}
                              />
                            </div>

                            <div className="mt-2.5 text-center flex flex-col items-center">
                              <span className={'text-[11px] sm:text-xs font-black uppercase tracking-wider transition-colors ' + (
                                isDark ? 'text-zinc-200 group-hover:text-emerald-400' : 'text-slate-900 group-hover:text-emerald-600'
                              )}>
                                {item.label}
                              </span>
                              {item.subLabel && (
                                <span className={'text-[9px] font-bold mt-0.5 ' + (isDark ? 'text-zinc-400' : 'text-slate-600')}>
                                  {item.subLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* KOLOM KANAN (5/12): STAFF PERFORMANCE & 3 CARD INSIGHT */}
                <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
                  
                  {/* CONTAINER PERFORMANCE STAFF */}
                  <div className={'border p-5 sm:p-6 rounded-3xl transition-all flex flex-col flex-1 justify-between gap-4 relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/30 to-amber-700/20 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-amber-500/20">
                            👑
                          </div>
                          <div>
                            <span className={'text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border shadow-sm ' + currentTheme.badgeBg}>
                              Performa Staff
                            </span>
                            <h3 className={'text-base font-black mt-0.5 tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                              Grafik Kinerja Staff
                            </h3>
                          </div>
                        </div>

                        {/* FILTER BULAN & TAHUN */}
                        <div className="flex items-center gap-1.5">
                          <select 
                            value={businessMonth} 
                            onChange={(e) => setBusinessMonth(e.target.value)}
                            className={'px-2.5 py-1 text-[11px] font-black rounded-xl border backdrop-blur-md outline-none cursor-pointer transition-all ' + (isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:border-amber-500' : 'bg-white border-slate-300 text-slate-800')}
                          >
                            {[
                              { v: '1', l: 'Jan' }, { v: '2', l: 'Feb' }, { v: '3', l: 'Mar' },
                              { v: '4', l: 'Apr' }, { v: '5', l: 'Mei' }, { v: '6', l: 'Jun' },
                              { v: '7', l: 'Jul' }, { v: '8', l: 'Ags' }, { v: '9', l: 'Sep' },
                              { v: '10', l: 'Okt' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Des' }
                            ].map(m => <option key={m.v} value={m.v} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{m.l}</option>)}
                          </select>

                          <select 
                            value={businessYear} 
                            onChange={(e) => setBusinessYear(e.target.value)}
                            className={'px-2.5 py-1 text-[11px] font-black rounded-xl border backdrop-blur-md outline-none cursor-pointer transition-all ' + (isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100 hover:border-amber-500' : 'bg-white border-slate-300 text-slate-800')}
                          >
                            {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y} className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>{y}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* LIST GRAFIK HORIZONTAL STAFF */}
                      <div className="flex flex-col gap-3.5 pt-4 overflow-y-auto pr-1">
                        {staffData.map((item: { label: string; count: number }, idx: number) => {
                          const widthPct = item.count > 0 ? Math.max(Math.round((item.count / maxStaffVal) * 100), 12) : 6;
                          const style = barGradients[idx % barGradients.length];

                          return (
                            <div key={idx} className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-xs font-extrabold">
                                <span className={isDark ? 'text-zinc-200' : 'text-slate-800'}>
                                  {item.label}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black ${
                                  item.count > 0 ? style.badge : 'bg-zinc-800/60 text-zinc-500 border-zinc-700/50'
                                }`}>
                                  {item.count} Transaksi
                                </span>
                              </div>

                              <div className="w-full h-3.5 bg-zinc-800/50 rounded-full p-0.5 border border-zinc-700/30 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full bg-gradient-to-r ${item.count > 0 ? style.bar : 'from-zinc-800 to-zinc-700'} transition-all duration-500 shadow-md`}
                                  style={{ width: widthPct + '%' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* BARIS 3 CARD INSIGHT */}
                  <div className="grid grid-cols-3 gap-3 shrink-0">
                    
                    {/* CARD 1: HARI TERAMAI */}
                    <div className={'border p-3.5 rounded-2xl backdrop-blur-xl flex flex-col justify-between gap-2 shadow-lg transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group ' + (isDark ? 'bg-gradient-to-br from-zinc-900/90 to-amber-950/20 border-amber-500/30 hover:border-amber-400/60 shadow-amber-500/5' : 'bg-gradient-to-br from-white to-amber-50 border-amber-200 hover:border-amber-400')}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">Hari Teramai</span>
                        <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-xs shrink-0">
                          🔥
                        </div>
                      </div>
                      <div>
                        <h4 className={'text-base font-black tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          {busiestDayName}
                        </h4>
                        <p className="text-[10px] font-bold text-amber-400 mt-0.5">
                          {busiestDayPct}% Total Trx
                        </p>
                      </div>
                    </div>

                    {/* CARD 2: BULAN PUNCAK */}
                    <div className={'border p-3.5 rounded-2xl backdrop-blur-xl flex flex-col justify-between gap-2 shadow-lg transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group ' + (isDark ? 'bg-gradient-to-br from-zinc-900/90 to-emerald-950/20 border-emerald-500/30 hover:border-emerald-400/60 shadow-emerald-500/5' : 'bg-gradient-to-br from-white to-emerald-50 border-emerald-200 hover:border-emerald-400')}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Bulan Puncak</span>
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xs shrink-0">
                          🚀
                        </div>
                      </div>
                      <div>
                        <h4 className={'text-base font-black tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          {peakMonthName}
                        </h4>
                        <p className="text-[10px] font-bold text-emerald-400 mt-0.5">
                          {peakMonthPct}% Thn Ini
                        </p>
                      </div>
                    </div>

                    {/* CARD 3: TAHUN PUNCAK */}
                    <div className={'border p-3.5 rounded-2xl backdrop-blur-xl flex flex-col justify-between gap-2 shadow-lg transition-all duration-300 hover:scale-[1.02] relative overflow-hidden group ' + (isDark ? 'bg-gradient-to-br from-zinc-900/90 to-cyan-950/20 border-cyan-500/30 hover:border-cyan-400/60 shadow-cyan-500/5' : 'bg-gradient-to-br from-white to-cyan-50 border-cyan-200 hover:border-cyan-400')}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-500">Tahun Puncak</span>
                        <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-xs shrink-0">
                          🏆
                        </div>
                      </div>
                      <div>
                        <h4 className={'text-base font-black tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          {peakYearVal}
                        </h4>
                        <p className="text-[10px] font-bold text-cyan-400 mt-0.5">
                          {peakYearPct}% Kontribusi
                        </p>
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

        </section>
      )}

      {/* ======================================================================== */}
      {/* 17.4 SLOT BLOCKING MANAGEMENT SECTION (PENGATURAN OPERASIONAL)           */}
      {/* ======================================================================== */}
      {slotBlockingEnabled && (
        <section className={'border p-5 sm:p-6 rounded-3xl transition-all flex flex-col gap-6 relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl border border-rose-400/50 bg-gradient-to-br from-rose-500/30 to-rose-700/20 flex items-center justify-center text-rose-300 shrink-0 shadow-lg shadow-rose-500/20">
                {/* 🟢 IKON SLIDERS OPERASIONAL */}
                <svg 
                  className="w-5 h-5" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="21" y1="4" x2="14" y2="4" />
                  <line x1="10" y1="4" x2="3" y2="4" />
                  <line x1="21" y1="12" x2="12" y2="12" />
                  <line x1="8" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="20" x2="16" y2="20" />
                  <line x1="12" y1="20" x2="3" y2="20" />
                  <line x1="14" y1="2" x2="14" y2="6" />
                  <line x1="8" y1="10" x2="8" y2="14" />
                  <line x1="16" y1="18" x2="16" y2="22" />
                </svg>
              </div>
              <div>
                <h2 className={'text-base sm:text-lg font-black tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                  Pengaturan Operasional
                </h2>
                <p className={'text-xs mt-0.5 ' + (isDark ? 'text-zinc-400' : 'text-slate-500')}>
                  Blokir rentang tanggal libur panjang (Lebaran, Cuti) atau jam istirahat tertentu secara fleksibel.
                </p>
              </div>
            </div>
            <span className="px-3.5 py-1 text-xs font-black text-rose-300 bg-rose-950/60 rounded-full border border-rose-800/50 shadow-sm">
              {blockedSlots.length} Slot Off
            </span>
          </div>

          <form onSubmit={handleAddBlockSlot} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
                  Tanggal Mulai:
                </label>
                <input
                  type="date"
                  required
                  value={blockStartDate}
                  onChange={(e) => setBlockStartDate(e.target.value)}
                  className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500')}
                />
              </div>

              <div>
                <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
                  Tanggal Selesai:
                </label>
                <input
                  type="date"
                  required
                  value={blockEndDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500')}
                />
              </div>

              <div>
                <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
                  Mode Waktu:
                </label>
                <select
                  value={blockMode}
                  onChange={(e) => setBlockMode(e.target.value)}
                  className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all cursor-pointer ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500')}
                >
                  <option value="fullday" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>Seharian Penuh (Full Day)</option>
                  <option value="custom_time" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>Jam Spesifik</option>
                </select>
              </div>

              <div>
                <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
                  Kategori Keterangan:
                </label>
                <select
                  value={reasonPreset}
                  onChange={(e) => setReasonPreset(e.target.value)}
                  className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all cursor-pointer ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500')}
                >
                  <option value="Libur Lebaran / Hari Raya" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>🥐 Libur Lebaran / Hari Raya</option>
                  <option value="Maintenance Salon" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>Maintenance Salon</option>
                  <option value="Acara Privat" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>Acara Privat</option>
                  <option value="Lainnya" className={isDark ? 'bg-zinc-900 text-white' : 'bg-white text-black'}>Lainnya</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
                  Catatan Tambahan:
                </label>
                <input
                  type="text"
                  placeholder="Opsional..."
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-rose-500' : 'bg-white border-slate-300 text-slate-900 focus:border-rose-500')}
                />
              </div>
              <button
                type="submit"
                disabled={isBlocking}
                className="w-full md:w-auto px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5"
              >
                <span>📌</span> {isBlocking ? 'Memproses...' : 'Block Slot / Tanggal Ini'}
              </button>
            </div>
          </form>

          {/* DAFTAR SLOT TER-BLOCK SAAT INI */}
          <div className="mt-2">
            <p className={'text-xs font-black uppercase tracking-wider mb-3 ' + (isDark ? 'text-zinc-400' : 'text-slate-500')}>
              DAFTAR SLOT TER-BLOCK SAAT INI:
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {blockedSlots.length === 0 ? (
                <p className={'text-xs py-2 ' + (isDark ? 'text-zinc-500' : 'text-slate-400')}>Belum ada slot yang diblokir saat ini.</p>
              ) : (
                blockedSlots.map((slot) => (
                  <div key={slot.id} className={'p-3 rounded-2xl border flex items-center justify-between text-xs backdrop-blur-md ' + (isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200' : 'bg-slate-100/80 border-slate-200 text-slate-800')}>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 text-[10px] font-black text-amber-300 bg-amber-950/60 rounded-lg border border-amber-700/40 shadow-sm">
                        {slot.reason || 'Libur'}
                      </span>
                      <span className="text-xs font-extrabold">
                        {slot.block_date} {slot.block_end_date ? `s/d ${slot.block_end_date}` : ''}
                      </span>
                      {slot.block_time && (
                        <span className="px-2 py-0.5 bg-purple-950/60 text-purple-300 rounded-lg text-[10px] font-bold border border-purple-800/40">
                          {slot.block_time} WIB
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlockSlot(slot.id)}
                      className="px-3 py-1 text-xs font-bold text-rose-300 bg-rose-950/50 hover:bg-rose-900/70 rounded-xl border border-rose-800/40 transition shadow-sm"
                    >
                      🗑 Batalkan Blokir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* ======================================================================== */}
      {/* 17.5 MAINTENANCE FEATURE CONTROL PANEL (MODE TUTUP & PEMELIHARAAN)       */}
      {/* ======================================================================== */}
      {enableMaintenanceFeature && (
        <section className={'border p-5 sm:p-6 rounded-3xl transition-all flex flex-col gap-4 relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/30 to-amber-700/20 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-amber-500/20">
                ⚠️
              </div>
              <div>
                <h2 className={'text-base sm:text-lg font-black tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>
                  Mode Tutup & Pemeliharaan Sistem
                </h2>
                <p className={'text-xs mt-0.5 ' + (isDark ? 'text-zinc-400' : 'text-slate-500')}>
                  Nyalakan tombol ini untuk mengunci halaman booking publik secara instan saat operasional tutup atau sedang pemeliharaan.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isMaintenanceMode}
                onChange={(e) => setIsMaintenanceMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 shadow-inner"></div>
            </label>
          </div>

          <div>
            <label className={'block text-xs font-bold mb-1 ' + (isDark ? 'text-zinc-300' : 'text-slate-700')}>
              Kustom Pesan Toko Tutup / Maintenance (Tampil di Halaman Publik):
            </label>
            <textarea
              rows={2}
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              placeholder="Mohon maaf, halaman pemesanan layanan saat ini sedang ditutup sementara."
              className={'w-full px-3 py-2 text-xs rounded-xl border outline-none transition-all ' + (isDark ? 'bg-zinc-900/90 border-zinc-700 text-white focus:border-amber-500' : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500')}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <p className={'text-[11px] ' + (isDark ? 'text-zinc-500' : 'text-slate-400')}>
              Pesan ini akan otomatis tampil menggantikan toko biasa saat halaman publik dikunci.
            </p>
            <button
              type="button"
              onClick={handleSaveMaintenanceMessage}
              disabled={isSavingMessage}
              className="px-5 py-2 text-xs font-black text-zinc-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              {isSavingMessage ? 'Menyimpan...' : 'Simpan Pesan'}
            </button>
          </div>
        </section>
      )}

      {/* ======================================================================== */}
      {/* 17.6 MANAJEMEN RESERVASI PELANGGAN (STANDARDIZED WITH DYNAMIC THEME)     */}
      {/* ======================================================================== */}
      <section className={'border p-5 sm:p-6 rounded-3xl transition-all relative overflow-hidden shadow-2xl backdrop-blur-xl ' + currentTheme.cardBg}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl border border-indigo-400/50 bg-gradient-to-br from-indigo-500/30 to-indigo-700/20 flex items-center justify-center text-xl shrink-0 shadow-lg shadow-indigo-500/20">
              📋
            </div>
            <div>
              <h2 className={'text-base sm:text-lg font-black tracking-tight flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                Manajemen Reservasi Pelanggan
              </h2>
              <p className={'text-xs mt-0.5 ' + (isDark ? 'text-zinc-400' : 'text-slate-500')}>
                Pantau slot jam yang otomatis ter-booking oleh pelanggan dari halaman publik.
              </p>
            </div>
          </div>

          {/* Tombol Aksi Gabungan (Lihat Daftar + Badge Cek Data) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                fetchCustomerReservations()
                if (typeof fetchReservations === 'function') fetchReservations()
                setIsReservationsModalOpen(true)
              }}
              className="px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 border border-indigo-500/30 active:scale-95 cursor-pointer"
            >
              <span className="flex items-center gap-1">📊 Lihat Daftar</span>
              <span className="px-2 py-0.5 bg-indigo-950/80 text-indigo-200 rounded-full text-[10px] border border-indigo-400/30 font-black">
                Cek Data
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/* 17.7 FINANCIAL REPORT PANEL                                            */}
      {/* ======================================================================== */}
      {isSuperAdminToggleActive && financialReportsEnabled && (
        <section className={`p-4 sm:p-6 md:p-7 rounded-3xl shadow-2xl space-y-4 sm:space-y-5 border transition-all ${currentTheme.cardBg}`}>
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
                    Rp {(reportData?.grossRevenue ?? 0).toLocaleString('id-ID')}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-rose-500 mt-1 font-bold">
                    Refund: -Rp {(reportData?.totalRefund ?? 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className={`text-right border-l pl-3 sm:pl-4 ${isDark ? 'border-zinc-800' : 'border-slate-300'}`}>
                  <p className="text-[10px] sm:text-[11px] font-black text-emerald-500 uppercase tracking-wider">OMZET NETTO</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                    Rp {(reportData?.netRevenue ?? 0).toLocaleString('id-ID')}
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
        </section>
      )}

      {/* ======================================================================== */}
      {/* 17.7 FILTER & SEARCH BAR SECTION                                       */}
      {/* ======================================================================== */}
      <section className={`border p-4 sm:p-5 rounded-3xl shadow-xl transition-all ${currentTheme.cardBg}`}>
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
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Layanan
              </label>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${
                  isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'
                } ${currentTheme?.focusBorder ?? ''}`}
              >
                <option value="all">Semua Layanan</option>
                {Array.isArray(uniqueServices) &&
                  uniqueServices.map((svc) => {
                    const serviceName = typeof svc === 'string' ? svc : String(svc ?? '')
                    if (!serviceName) return null
                    return (
                      <option key={serviceName} value={serviceName}>
                        {isEyelash ? '💅 ' : '✂️ '}{serviceName}
                      </option>
                    )
                  })}
              </select>
            </div>
          )}

          {isSuperAdminToggleActive && (
            <div className="w-full">
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Limit Data:
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  const val = e.target.value
                  setLimit(val === 'all' ? 'all' : Number(val))
                  setCurrentPage(1)
                }}
                className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${
                  isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'
                } ${currentTheme?.focusBorder ?? ''}`}
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
              <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                Metode Bayar
              </label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className={`w-full px-3 py-2 sm:py-2.5 border rounded-2xl text-xs font-semibold focus:outline-none cursor-pointer shadow-inner ${
                  isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-200' : 'bg-white border-slate-300 text-slate-800'
                } ${currentTheme?.focusBorder ?? ''}`}
              >
                <option value="all">Semua Metode</option>
                {Array.isArray(uniquePayments) &&
                  uniquePayments.map((pay) => {
                    const paymentName = typeof pay === 'string' ? pay : String(pay ?? '')
                    if (!paymentName) return null
                    return (
                      <option key={paymentName} value={paymentName}>
                        💳 {paymentName}
                      </option>
                    )
                  })}
              </select>
            </div>
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
                setCurrentPage(1)
              }}
              className={`px-3 py-2 sm:py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap h-[38px] sm:h-[42px] border ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'}`}
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* ======================================================================== */}
      {/* 17.8 RESERVATIONS DATA TABLE                                           */}
      {/* ======================================================================== */}
      <section className={`border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${currentTheme.cardBg}`}>
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
                    const rawStatus = (item.status || 'pending').toLowerCase()
                    const cleanWa = item.whatsapp_number ? item.whatsapp_number.replace(/[^0-9]/g, '').replace(/^0/, '62') : ''
                    const price = getItemPrice(item)

                    const waText = `Halo Kak ${item.customer_name}, kami dari ${brandTitle || 'Salon/Barbershop'}. Mau konfirmasi reservasi kamu tanggal ${formatDateID(item.booking_date || '')} jam ${item.booking_time} WIB untuk layanan ${item.service_name}. Terima kasih!`
                    const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waText)}`

                    const refundWaText = `Halo Kak ${item.customer_name}, terkait pembatalan reservasi layanan ${item.service_name} pada tanggal ${formatDateID(item.booking_date || '')}, mohon konfirmasikan nomor rekening atau e-wallet (Nama Bank/E-Wallet, No Rekening, dan Atas Nama) untuk proses pengembalian dana (refund) ya. Terima kasih!`
                    const refundWaUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(refundWaText)}`

                    const isNeedRefund = rawStatus === 'cancelled_need_refund'
                    const finalWaUrl = isNeedRefund ? refundWaUrl : waUrl

                    return (
                      <tr key={item.id} className={`transition-all ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}>
                        <td className={`py-3 px-3 font-semibold whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                          {formatDateID(item.booking_date || '')}
                        </td>
                        <td className={`py-3 px-3 font-bold whitespace-nowrap ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
                          {item.booking_time}
                        </td>
                        <td className="py-3 px-3">
                          <div className={`font-bold whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.customer_name}</div>
                          <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{item.whatsapp_number || '-'}</div>
                        </td>
                        <td className={`py-3 px-3 font-medium ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                          <span className="line-clamp-2">
                            {typeof item.service_name === 'string' ? item.service_name : '-'}
                          </span>
                        </td>

                        {isSuperAdminToggleActive && (
                          <td className={`py-3 px-3 font-medium whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                            {typeof item.staff_name === 'string' ? item.staff_name : '-'}
                          </td>
                        )}

                        {isSuperAdminToggleActive && (
                          <td className={`py-3 px-3 font-semibold whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                            <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${isDark ? 'bg-zinc-900 border-zinc-800' : ''}`}>
                              💳 {typeof item.payment_method === 'string' ? item.payment_method : 'QRIS'}
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

                            {(rawStatus === 'cancelled_need_refund' || rawStatus === 'cancelled_refunded') && (
                              <>
                                <option value="cancelled_need_refund" className="bg-zinc-900 text-amber-300 font-bold">
                                  🟠 Need Refund
                                </option>
                                <option value="cancelled_refunded" className="bg-zinc-900 text-purple-300 font-bold">
                                  💸 Refunded
                                </option>
                              </>
                            )}
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

            {/* ======================================================================== */}
            {/* PAGINATION CONTROLS (TAMPILAN ELEGAN, FUTURISTIK & DINAMIS TEMA)          */}
            {/* ======================================================================== */}
            {totalPages > 1 && (
              <div
                className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs transition-all duration-300 backdrop-blur-md ${
                  isDark
                    ? 'border-zinc-800/80 bg-zinc-950/40'
                    : 'border-slate-200/80 bg-slate-50/50'
                }`}
              >
                {/* Info Halaman & Total Data */}
                <div className="flex items-center gap-2">
                  <div
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md transition-all shadow-sm flex items-center gap-1.5 ${
                      isDark
                        ? 'bg-zinc-900/70 border-zinc-800/80 text-zinc-400'
                        : 'bg-white/80 border-slate-200/90 text-slate-600'
                    }`}
                  >
                    <span>Halaman</span>
                    <span
                      className={`font-black px-1.5 py-0.5 rounded-md ${
                        isDark ? 'text-rose-400' : 'text-rose-600'
                      }`}
                    >
                      {currentPage}
                    </span>
                    <span>dari</span>
                    <span className={`font-bold ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
                      {totalPages}
                    </span>
                  </div>
                </div>

                {/* Numbered & Navigasi Buttons */}
                <div className="flex items-center gap-2">
                  {/* Tombol Previous */}
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer shadow-sm ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-sm leading-none">‹</span>
                    <span>Prev</span>
                  </button>

                  {/* Page Number Indicators */}
                  <div className="hidden md:flex items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
                      )
                      .map((pageNum, index, arr) => {
                        const prevNum = arr[index - 1]
                        const showDots = prevNum && pageNum - prevNum > 1
                        const isActive = pageNum === currentPage

                        return (
                          <div key={pageNum} className="flex items-center gap-1.5">
                            {showDots && (
                              <span
                                className={`px-1 text-xs font-bold select-none ${
                                  isDark ? 'text-zinc-600' : 'text-slate-400'
                                }`}
                              >
                                •••
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-xl text-xs font-black transition-all duration-300 active:scale-95 border cursor-pointer flex items-center justify-center ${
                                isActive
                                  ? `${currentTheme.badge} !text-white border-white/40 shadow-lg scale-105 font-black`
                                  : isDark
                                  ? 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              {pageNum}
                            </button>
                          </div>
                        )
                      })}
                  </div>

                  {/* Tombol Next */}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer shadow-sm ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>Next</span>
                    <span className="text-sm leading-none">›</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ======================================================================== */}
      {/* 17.9 MODAL REFUND / BATAL (GAYA KARTU MODERN INFORMAL)                 */}
      {/* ======================================================================== */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`max-w-md w-full border rounded-3xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
              isDark
                ? 'bg-zinc-900 border-zinc-700/80 text-zinc-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase tracking-widest inline-block">
                Konfirmasi Pembatalan
              </span>
              <h3
                className={`text-lg font-black ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Batalkan Pesanan: {cancelModalItem.customer_name || 'Pelanggan'}?
              </h3>
              <p
                className={`text-xs ${
                  isDark ? 'text-zinc-300' : 'text-slate-600'
                }`}
              >
                Apakah pembatalan ini memerlukan pengembalian dana (refund) kepada
                pelanggan? Slot jam terkait juga akan otomatis dibuka kembali.
              </p>
            </div>

            {/* Info Card - Adaptif Light / Dark Mode */}
            <div
              className={`p-4 rounded-2xl space-y-1.5 text-xs font-mono border ${
                isDark
                  ? 'bg-zinc-950/60 border-zinc-800 text-zinc-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <p>
                <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>
                  Layanan:
                </span>{' '}
                {cancelModalItem.service_name || '-'}
              </p>
              <p>
                <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>
                  Jadwal:
                </span>{' '}
                {typeof formatDateID === 'function' ? formatDateID(cancelModalItem.booking_date || '') : (cancelModalItem.booking_date || '-')} -{' '}
                {cancelModalItem.booking_time || '-'} WIB
              </p>
              <p>
                <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>
                  Nominal:
                </span>{' '}
                <strong className="text-emerald-500 font-bold">
                  Rp {(typeof getItemPrice === 'function' ? getItemPrice(cancelModalItem) : (cancelModalItem.total_price || 0)).toLocaleString('id-ID')}
                </strong>
              </p>
            </div>

            {/* Tombol Opsi Pilihan (Tanpa Refund vs Ya, Perlu Refund) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmCancel(false)}
                className={`w-full font-bold py-3 rounded-2xl text-xs transition-all border active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                Tanpa Refund ❌
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCancel(true)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-lg shadow-rose-600/30 active:scale-95 cursor-pointer"
              >
                Ya, Perlu Refund 💸
              </button>
            </div>

            {/* Tombol Batal / Kembali */}
            <button
              type="button"
              onClick={() => setCancelModalItem(null)}
              className={`w-full text-center text-xs font-bold pt-1 transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Batal / Kembali
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* 17.10 MODAL AUTO-BLOCKED RESERVATIONS                                  */}
      {/* ======================================================================== */}
      {isReservationsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase">Daftar Slot Auto-Block (Booking Confirmed)</h3>
              <button
                onClick={() => setIsReservationsModalOpen(false)}
                className="text-zinc-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {isLoadingReservations ? (
                <p className="text-xs text-zinc-500 text-center py-4">Memuat data...</p>
              ) : customerReservations.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">Belum ada slot terblokir otomatis.</p>
              ) : (
                customerReservations.map((res) => (
                  <div key={res.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-purple-300">{res.block_date}</span>
                      {res.block_time && <span className="ml-2 px-2 py-0.5 bg-purple-900/40 text-purple-200 rounded-lg text-[10px] font-semibold">{res.block_time} WIB</span>}
                      <p className="text-[11px] text-zinc-400 mt-0.5">{res.reason}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  </main>
)
}