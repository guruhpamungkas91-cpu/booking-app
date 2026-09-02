'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Reservation {
  id: number
  created_at: string
  customer_name: string
  whatsapp_number: string
  service_name: string
  staff_name?: string
  booking_date: string
  booking_time: string
  payment_method?: string
  status: string
  client_code?: string
  tenant_slug?: string
}

interface BlockedSlot {
  id?: number
  created_at?: string
  client_code: string
  tenant_slug?: string
  block_date: string
  block_time: string
  reason?: string
}

type SortField = 'booking_date' | 'booking_time' | 'customer_name' | 'service_name' | 'staff_name' | 'price' | 'payment_method' | 'status'
type SortOrder = 'asc' | 'desc'
type SubscriptionPlanType = 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
type BusinessType = 'eyelash' | 'barber'
type ThemeMode = 'purple' | 'pink' | 'amber' | 'emerald' | 'blue'

const detectBrandFromHostname = (): { brand: string; type: BusinessType } => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('sem')) return { brand: 'SEM BARBERSHOP', type: 'barber' }
    if (host.includes('fitrifeb') || host.includes('lashes') || host.includes('eyelash')) {
      return { brand: 'FITRIFEB', type: 'eyelash' }
    }
    if (host.includes('mcut') || host.includes('barber')) {
      return { brand: 'MCUT', type: 'barber' }
    }
  }
  return { brand: 'DASHBOARD ADMIN', type: 'barber' }
}

export default function AdminDashboard() {
  const [isInitializing, setIsInitializing] = useState<boolean>(true)

  const [brandTitle, setBrandTitle] = useState<string>(() => detectBrandFromHostname().brand)
  const [businessType, setBusinessType] = useState<BusinessType>(() => detectBrandFromHostname().type)
  const [staffLabel, setStaffLabel] = useState<string>(() => 
    detectBrandFromHostname().type === 'eyelash' ? 'Lash Artist' : 'Capster / Staff'
  )

  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(() => 
    detectBrandFromHostname().type === 'eyelash' ? 'pink' : 'purple'
  )

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tenantCode, setTenantCode] = useState<string>('')
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanType>('PROFESIONAL')

  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  // STATE BLOCK SLOT DETAILED LOGIC
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [blockDateInput, setBlockDateInput] = useState('')
  const [blockTimeInput, setBlockTimeInput] = useState('10:00')
  const [reasonPreset, setReasonPreset] = useState('Libur Lebaran')
  const [blockReasonInput, setBlockReasonInput] = useState('')
  const [isBlocking, setIsBlocking] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const [autoWaReminder, setAutoWaReminder] = useState<boolean>(true)
  const [isUpdatingWaToggle, setIsUpdatingWaToggle] = useState<boolean>(false)

  // STATE FEATURE BOOKING TOGGLES
  const [preventDoubleBooking, setPreventDoubleBooking] = useState<boolean>(true)
  const [hideBookedSlots, setHideBookedSlots] = useState<boolean>(true)
  const [isUpdatingBookingToggle, setIsUpdatingBookingToggle] = useState<boolean>(false)

  const [limit, setLimit] = useState<number | 'all'>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const [sortField, setSortField] = useState<SortField>('booking_date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [cancelModalItem, setCancelModalItem] = useState<Reservation | null>(null)

  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  const sanitizeClientCode = (code?: string) => {
    if (!code) return ''
    return code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  }

  const determineCategory = (slugOrEmail: string): BusinessType => {
    const text = slugOrEmail.toLowerCase()
    if (text.includes('fitri') || text.includes('lash') || text.includes('eyelash')) {
      return 'eyelash'
    }
    return 'barber'
  }

  const fetchTenantDetail = useCallback(async (cleanCode: string, detectedBrandHint: string = '') => {
    try {
      let tenantData = null

      if (cleanCode) {
        const { data } = await supabase
          .from('Tenants')
          .select('subscription_plan, staff_label, tenant_slug, auto_wa_reminder, prevent_double_booking, hide_booked_slots')
          .ilike('tenant_slug', `%${cleanCode}%`)
          .maybeSingle()
        tenantData = data
      }

      if (!tenantData && detectedBrandHint) {
        const { data } = await supabase
          .from('Tenants')
          .select('subscription_plan, staff_label, tenant_slug, auto_wa_reminder, prevent_double_booking, hide_booked_slots')
          .ilike('tenant_slug', `%${detectedBrandHint.toLowerCase()}%`)
          .maybeSingle()
        tenantData = data
      }

      if (tenantData) {
        const rawPlan = String(tenantData.subscription_plan || '').trim().toUpperCase()

        if (rawPlan.includes('PROFESIONAL') || rawPlan.includes('PROFESSIONAL') || rawPlan.includes('PRO')) {
          setSubscriptionPlan('PROFESIONAL')
        } else if (rawPlan.includes('PREMIUM')) {
          setSubscriptionPlan('PREMIUM')
        } else {
          setSubscriptionPlan('BASIC')
        }

        const category = determineCategory(tenantData.tenant_slug || cleanCode || detectedBrandHint)
        setBusinessType(category)

        if (tenantData.staff_label) {
          setStaffLabel(tenantData.staff_label)
        } else {
          setStaffLabel(category === 'eyelash' ? 'Lash Artist' : 'Capster / Staff')
        }

        if (tenantData.tenant_slug) {
          setBrandTitle(tenantData.tenant_slug.toUpperCase())
          setTenantCode(tenantData.tenant_slug)
        }

        if (typeof tenantData.auto_wa_reminder === 'boolean') {
          setAutoWaReminder(tenantData.auto_wa_reminder)
        }
        if (typeof tenantData.prevent_double_booking === 'boolean') {
          setPreventDoubleBooking(tenantData.prevent_double_booking)
        }
        if (typeof tenantData.hide_booked_slots === 'boolean') {
          setHideBookedSlots(tenantData.hide_booked_slots)
        }
      }     
    } catch (err) {
      console.error('Error fetching tenant details:', err)
    }
  }, [])

  // HANDLER API UNTUK TOGGLE SWITCH WA REMINDER (DINAMIS Sesuai Tenant Active)
  const handleToggleWaReminder = async (newStatus: boolean) => {
    if (!tenantCode) {
      alert('Tenant code tidak ditemukan.')
      return
    }

    const previousStatus = autoWaReminder
    setAutoWaReminder(newStatus)
    setIsUpdatingWaToggle(true)

    try {
      const response = await fetch('/api/tenant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantCode,
          auto_wa_reminder: newStatus,
        }),
      })

      const text = await response.text()
      const resData = text ? JSON.parse(text) : {}

      if (!response.ok || (resData && resData.success === false)) {
        throw new Error(resData?.message || 'Gagal mengubah status WA Reminder')
      }
    } catch (error: any) {
      alert(`Gagal mengupdate pengingat WhatsApp: ${error.message}`)
      setAutoWaReminder(previousStatus)
    } finally {
       setIsUpdatingWaToggle(false)
     }
  }

  // HANDLER API UNTUK TOGGLE FITUR BOOKING (DINAMIS Sesuai Tenant Active)
  const handleToggleBookingSetting = async (field: 'prevent_double_booking' | 'hide_booked_slots', newStatus: boolean) => {
    if (!tenantCode) {
      alert('Tenant code tidak ditemukan.')
      return
    }

    const prevDoubleBooking = preventDoubleBooking
    const prevHideSlots = hideBookedSlots

    if (field === 'prevent_double_booking') setPreventDoubleBooking(newStatus)
    if (field === 'hide_booked_slots') setHideBookedSlots(newStatus)

    setIsUpdatingBookingToggle(true)

    try {
      const response = await fetch('/api/tenant', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_slug: tenantCode,
          [field]: newStatus,
        }),
      })

      const text = await response.text()
      const resData = text ? JSON.parse(text) : {}

      if (!response.ok || (resData && resData.success === false)) {
        throw new Error(resData?.message || `Error status: ${response.status}`)
      }
    } catch (error: any) {
      alert(`Gagal mengupdate pengaturan booking: ${error.message}`)
      setPreventDoubleBooking(prevDoubleBooking)
      setHideBookedSlots(prevHideSlots)
      } finally {
      setIsUpdatingBookingToggle(false)
      }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    })

    if (error) {
      alert('Login gagal: ' + error.message)
    } else if (data.session) {
      setIsAuthenticated(true)
      const rawCode = data.session.user.app_metadata?.client_code || data.session.user.app_metadata?.tenant_slug || emailInput
      const cleanCode = sanitizeClientCode(rawCode)
      setTenantCode(cleanCode)

      const category = determineCategory(emailInput || cleanCode)
      setBusinessType(category)
      setStaffLabel(category === 'eyelash' ? 'Lash Artist' : 'Capster / Staff')
      if (category === 'eyelash') setSelectedTheme('pink')

      await fetchTenantDetail(cleanCode)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  const fetchBlockedSlots = useCallback(async () => {
    if (!tenantCode) return
    const { data, error } = await supabase
      .from('blocked_slots')
      .select('*')
      .or(`client_code.eq.${tenantCode},tenant_slug.eq.${tenantCode}`)
      .order('block_date', { ascending: true })

    if (!error && data) {
      setBlockedSlots(data)
    }
  }, [tenantCode])

  const handleAddBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!blockDateInput || !blockTimeInput) {
      alert('Pilih tanggal dan jam yang ingin diblokir!')
      return
    }

    if (!tenantCode) {
      alert('Tenant code belum teridentifikasi!')
      return
    }

    const finalReason = reasonPreset === 'Lainnya' 
      ? (blockReasonInput || 'Di-block Admin') 
      : reasonPreset

    setIsBlocking(true)
    const { error } = await supabase
      .from('blocked_slots')
      .insert([
        {
          client_code: tenantCode,
          tenant_slug: tenantCode,
          block_date: blockDateInput,
          block_time: blockTimeInput,
          reason: finalReason
        }
      ])

    if (error) {
      alert('Gagal memblokir slot: ' + error.message)
    } else {
      alert(`Berhasil memblokir slot jam ${blockTimeInput} WIB pada tanggal ${blockDateInput} (${finalReason})`)
      setBlockReasonInput('')
      fetchBlockedSlots()
    }
    setIsBlocking(false)
  }

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

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const { data: tenantData } = await supabase
      .from('Tenants')
      .select('client_code, tenant_slug')
      .or(`admin_email.eq.${user.email},client_code.eq.${tenantCode},tenant_slug.eq.${tenantCode}`)
      .maybeSingle()

    const activeClientCode = tenantData?.client_code || user?.app_metadata?.client_code || tenantCode
    const activeTenantSlug = tenantData?.tenant_slug || user?.app_metadata?.tenant_slug || tenantCode

    if (activeClientCode || activeTenantSlug) {
      await fetchTenantDetail(activeClientCode || activeTenantSlug)
    }

    let query = supabase.from('Reservations').select('*')
    if (activeClientCode || activeTenantSlug) {
      query = query.or(`client_code.eq.${activeClientCode},tenant_slug.eq.${activeTenantSlug},client_code.ilike.%${activeClientCode}%`)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      alert('Gagal mengambil data: ' + error.message)
    } else {
      setReservations(data || [])
      setFilteredReservations(data || [])
    }
    setLoading(false)
  }, [tenantCode, fetchTenantDetail])

  const syncConfirmedSlotsToBlocked = useCallback(async () => {
    if (!tenantCode) return

    const confirmedList = reservations.filter((r) => {
      const s = (r.status || '').toLowerCase()
      return s === 'confirmed' || s === 'dikonfirmasi'
    })

    if (confirmedList.length === 0) return

    for (const item of confirmedList) {
      const exists = blockedSlots.some(
        (b) => b.block_date === item.booking_date && b.block_time === item.booking_time
      )

      if (!exists) {
        await supabase.from('blocked_slots').insert([
          {
            client_code: tenantCode,
            tenant_slug: tenantCode,
            block_date: item.booking_date,
            block_time: item.booking_time,
            reason: `Otomatis: Booking Confirmed (${item.customer_name})`
          }
        ])
      }
    }
    fetchBlockedSlots()
  }, [reservations, blockedSlots, tenantCode, fetchBlockedSlots])

  const updateStatusInDB = async (id: number, newStatus: string) => {
    const { error } = await supabase
      .from('Reservations')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert('Gagal update status: ' + error.message)
    } else {
      await fetchReservations()
      if (newStatus === 'confirmed') {
        syncConfirmedSlotsToBlocked()
      }
    }
  }

  const handleStatusChange = (item: Reservation, newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancelModalItem(item)
    } else {
      updateStatusInDB(item.id, newStatus)
    }
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

  const handleDelete = async (id: number, customerName: string) => {
    const isConfirmed = window.confirm(
      `Apakah kamu yakin ingin menghapus data reservasi atas nama "${customerName}"?`
    )

    if (!isConfirmed) return

    const { error } = await supabase
      .from('Reservations')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus data: ' + error.message)
    } else {
      setReservations((prev) => prev.filter((item) => item.id !== id))
      alert('Data reservasi berhasil dihapus!')
    }
  }

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

  const getServicePrice = (serviceName?: string): number => {
    if (!serviceName) return businessType === 'eyelash' ? 120000 : 50000
    if (serviceName.includes(',')) {
      const parts = serviceName.split(',').map((s) => s.trim())
      return parts.reduce((acc, curr) => acc + (SERVICE_PRICES[curr] || (businessType === 'eyelash' ? 120000 : 50000)), 0)
    }
    return SERVICE_PRICES[serviceName] ?? (businessType === 'eyelash' ? 120000 : 50000)
  }

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

  const stats = useMemo(() => {
    const totalBookings = reservations.length

    const totalRevenue = reservations.reduce((sum, item) => {
      if (isCompleted(item.status)) {
        return sum + getServicePrice(item.service_name)
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
        staffPerformance[item.staff_name] = (staffPerformance[item.staff_name] || 0) + 1
      }
    })

    let topStaffName = '-'
    let topStaffCount = 0
    Object.entries(staffPerformance).forEach(([name, count]) => {
      if (count > topStaffCount) {
        topStaffCount = count
        topStaffName = name
      }
    })

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
    }
  }, [reservations, businessType])

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
      const price = getServicePrice(item.service_name)
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
  }, [reservations, reportPeriod, reportDate, reportStartDate, reportEndDate, businessType])

  const exportReportToCSV = () => {
    if (subscriptionPlan === 'BASIC') {
      alert('Fitur Penarikan Laporan Excel hanya tersedia untuk Paket Premium & Profesional.')
      return
    }

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
                const harga = getServicePrice(item.service_name)
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
                  <td class="num">
                    Rp ${harga.toLocaleString('id-ID')}
                  </td>
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
    if (subscriptionPlan !== 'PROFESIONAL') {
      alert('Fitur Cetak / PDF Laporan eksklusif hanya tersedia untuk Paket Profesional.')
      return
    }

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
                const harga = getServicePrice(item.service_name)
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
                  <td class="right bold">
                    Rp ${harga.toLocaleString('id-ID')}
                  </td>
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
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(printHtml)
    printWindow.document.close()
  }

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

    if (subscriptionPlan !== 'BASIC') {
      if (startDate) result = result.filter((item) => item.booking_date >= startDate)
      if (endDate) result = result.filter((item) => item.booking_date <= endDate)
      if (serviceFilter !== 'all') result = result.filter((item) => item.service_name === serviceFilter)
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        result = result.filter((item) =>
          item.customer_name?.toLowerCase().includes(term) ||
          item.whatsapp_number?.includes(term) ||
          item.service_name?.toLowerCase().includes(term) ||
          item.staff_name?.toLowerCase().includes(term)
        )
      }
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
        valA = getServicePrice(a.service_name)
        valB = getServicePrice(b.service_name)
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

    setFilteredReservations(result)
    setCurrentPage(1)
  }, [startDate, endDate, statusFilter, serviceFilter, paymentFilter, searchTerm, sortField, sortOrder, reservations, subscriptionPlan])

  const totalPages = useMemo(() => {
    if (limit === 'all') return 1
    return Math.ceil(filteredReservations.length / limit) || 1
  }, [filteredReservations.length, limit])

  const displayedReservations = useMemo(() => {
    if (limit === 'all') return filteredReservations
    const startIndex = (currentPage - 1) * limit
    return filteredReservations.slice(startIndex, startIndex + limit)
  }, [filteredReservations, currentPage, limit])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  useEffect(() => {
    const initSession = async () => {
      setIsInitializing(true)
      const info = detectBrandFromHostname()
      const { data } = await supabase.auth.getSession()
      
      if (data?.session) {
        setIsAuthenticated(true)
        const rawCode = data.session.user.app_metadata?.client_code || data.session.user.app_metadata?.tenant_slug || data.session.user.email || ''
        const cleanCode = sanitizeClientCode(rawCode)
        setTenantCode(cleanCode)

        const category = determineCategory(data.session.user.email || cleanCode)
        setBusinessType(category)
        setStaffLabel(category === 'eyelash' ? 'Lash Artist' : 'Capster / Staff')
        if (category === 'eyelash') setSelectedTheme('pink')

        await fetchTenantDetail(cleanCode, info.brand)
      } else {
        await fetchTenantDetail('', info.brand)
      }
      setIsInitializing(false)
    }

    initSession()
  }, [fetchTenantDetail])

  useEffect(() => {
    if (isAuthenticated) {
      fetchReservations()
      fetchBlockedSlots()
    }
  }, [isAuthenticated, fetchReservations, fetchBlockedSlots])

  useEffect(() => {
    if (isAuthenticated && reservations.length > 0) {
      syncConfirmedSlotsToBlocked()
    }
  }, [reservations, isAuthenticated, syncConfirmedSlotsToBlocked])

  const themeStyles = useMemo(() => {
    if (subscriptionPlan === 'BASIC') {
      return {
        mainBg: 'bg-zinc-950',
        bgGlow: 'hidden',
        bgGlowSecondary: 'hidden',
        cardBg: 'bg-zinc-900/90 border-zinc-800',
        textAccent: 'text-purple-300',
        borderAccent: 'border-purple-500/20',
        focusBorder: 'focus:border-purple-500',
        badgeBg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        buttonPrimary: 'bg-purple-600 hover:bg-purple-500 text-white',
        btnActivePeriod: 'bg-purple-600 text-white',
        headerGradient: 'bg-zinc-950 border-zinc-800',
      }
    }

    const isPro = subscriptionPlan === 'PROFESIONAL'

    switch (selectedTheme) {
      case 'pink':
        return {
          mainBg: isPro ? 'bg-[#0f040b]' : 'bg-[#0b0510]',
          bgGlow: isPro ? 'bg-pink-600/30' : 'bg-pink-600/10',
          bgGlowSecondary: isPro ? 'bg-rose-500/20' : 'hidden',
          cardBg: isPro 
            ? 'bg-gradient-to-b from-pink-950/30 via-zinc-950/80 to-zinc-950/90 backdrop-blur-3xl border-pink-500/30 shadow-[0_8px_32px_0_rgba(236,72,153,0.15)] ring-1 ring-pink-500/20' 
            : 'bg-zinc-950/70 border-pink-500/30',
          textAccent: 'text-pink-400',
          borderAccent: isPro ? 'border-pink-500/40 shadow-pink-950/50' : 'border-pink-500/30',
          focusBorder: 'focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20',
          badgeBg: 'bg-pink-500/15 text-pink-300 border-pink-500/40 shadow-sm shadow-pink-500/20',
          buttonPrimary: isPro 
            ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-400 text-white font-black shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50' 
            : 'bg-pink-600 hover:bg-pink-500 text-white',
          btnActivePeriod: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/30',
          headerGradient: isPro 
            ? 'bg-gradient-to-r from-pink-950/90 via-zinc-950/90 to-rose-950/70 border-pink-500/50 shadow-2xl shadow-pink-950/50 ring-1 ring-pink-500/30' 
            : 'bg-gradient-to-r from-pink-950/40 via-zinc-950/90 to-rose-950/20 border-pink-500/30',
        }
      case 'amber':
        return {
          mainBg: isPro ? 'bg-[#0d0a03]' : 'bg-[#090702]',
          bgGlow: isPro ? 'bg-amber-500/25' : 'bg-amber-600/10',
          bgGlowSecondary: isPro ? 'bg-yellow-600/15' : 'hidden',
          cardBg: isPro 
            ? 'bg-gradient-to-b from-amber-950/30 via-zinc-950/80 to-zinc-950/90 backdrop-blur-3xl border-amber-500/30 shadow-[0_8px_32px_0_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20' 
            : 'bg-zinc-950/70 border-amber-500/30',
          textAccent: 'text-amber-400',
          borderAccent: isPro ? 'border-amber-500/40 shadow-amber-950/50' : 'border-amber-500/30',
          focusBorder: 'focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20',
          buttonPrimary: isPro 
            ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-zinc-950 font-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50' 
            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950',
          btnActivePeriod: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950 font-extrabold shadow-md shadow-amber-500/30',
          headerGradient: isPro 
            ? 'bg-gradient-to-r from-amber-950/90 via-zinc-950/90 to-yellow-950/70 border-amber-500/50 shadow-2xl shadow-amber-950/50 ring-1 ring-amber-500/30' 
            : 'bg-gradient-to-r from-amber-950/40 via-zinc-950/90 to-amber-950/20 border-amber-500/30',
        }
      case 'emerald':
        return {
          mainBg: isPro ? 'bg-[#020d08]' : 'bg-[#020805]',
          bgGlow: isPro ? 'bg-emerald-500/25' : 'bg-emerald-600/10',
          bgGlowSecondary: isPro ? 'bg-teal-600/15' : 'hidden',
          cardBg: isPro 
            ? 'bg-gradient-to-b from-emerald-950/30 via-zinc-950/80 to-zinc-950/90 backdrop-blur-3xl border-emerald-500/30 shadow-[0_8px_32px_0_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20' 
            : 'bg-zinc-950/70 border-emerald-500/30',
          textAccent: 'text-emerald-400',
          borderAccent: isPro ? 'border-emerald-500/40 shadow-emerald-950/50' : 'border-emerald-500/30',
          focusBorder: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20',
          buttonPrimary: isPro 
            ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white',
          btnActivePeriod: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30',
          headerGradient: isPro 
            ? 'bg-gradient-to-r from-emerald-950/90 via-zinc-950/90 to-teal-950/70 border-emerald-500/50 shadow-2xl shadow-emerald-950/50 ring-1 ring-emerald-500/30' 
            : 'bg-gradient-to-r from-emerald-950/40 via-zinc-950/90 to-teal-950/20 border-emerald-500/30',
        }
      case 'blue':
        return {
          mainBg: isPro ? 'bg-[#030914]' : 'bg-[#02050b]',
          bgGlow: isPro ? 'bg-blue-600/30' : 'bg-blue-600/10',
          bgGlowSecondary: isPro ? 'bg-indigo-600/20' : 'hidden',
          cardBg: isPro 
            ? 'bg-gradient-to-b from-blue-950/30 via-zinc-950/80 to-zinc-950/90 backdrop-blur-3xl border-blue-500/30 shadow-[0_8px_32px_0_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20' 
            : 'bg-zinc-950/70 border-blue-500/30',
          textAccent: 'text-blue-400',
          borderAccent: isPro ? 'border-blue-500/40 shadow-blue-950/50' : 'border-blue-500/30',
          focusBorder: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
          badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/20',
          buttonPrimary: isPro 
            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50' 
            : 'bg-blue-600 hover:bg-blue-500 text-white',
          btnActivePeriod: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30',
          headerGradient: isPro 
            ? 'bg-gradient-to-r from-blue-950/90 via-zinc-950/90 to-indigo-950/70 border-blue-500/50 shadow-2xl shadow-blue-950/50 ring-1 ring-blue-950/30' 
            : 'bg-gradient-to-r from-blue-950/40 via-zinc-950/90 to-indigo-950/20 border-blue-500/30',
        }
      case 'purple':
      default:
        return {
          mainBg: isPro ? 'bg-[#09040e]' : 'bg-[#06040a]',
          bgGlow: isPro ? 'bg-purple-600/30' : 'bg-purple-600/10',
          bgGlowSecondary: isPro ? 'bg-indigo-600/20' : 'hidden',
          cardBg: isPro 
            ? 'bg-gradient-to-b from-purple-950/30 via-zinc-950/80 to-zinc-950/90 backdrop-blur-3xl border-purple-500/30 shadow-[0_8px_32px_0_rgba(168,85,247,0.15)] ring-1 ring-purple-500/20' 
            : 'bg-zinc-950/70 border-purple-500/30',
          textAccent: 'text-purple-300',
          borderAccent: isPro ? 'border-purple-500/40 shadow-purple-950/50' : 'border-purple-500/30',
          focusBorder: 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20',
          badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-400/50 shadow-sm shadow-purple-500/20',
          buttonPrimary: isPro 
            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-black shadow-lg shadow-purple-600/40 hover:shadow-purple-600/60' 
            : 'bg-purple-600 hover:bg-purple-500 text-white',
          btnActivePeriod: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30',
          headerGradient: isPro 
            ? 'bg-gradient-to-r from-purple-950/90 via-zinc-950/90 to-indigo-950/70 border-purple-500/50 shadow-2xl shadow-purple-950/50 ring-1 ring-purple-500/30' 
            : 'bg-gradient-to-r from-purple-950/40 via-zinc-950/90 to-indigo-950/20 border-purple-500/30',
        }
    }
  }, [selectedTheme, subscriptionPlan])

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
              {isEyelash ? '✨ Eyelash Control Center' : '💈 Barber Control Center'}
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

  return (
    <div className={`min-h-screen p-3 sm:p-6 md:p-8 text-zinc-100 font-sans relative transition-colors duration-700 ${themeStyles.mainBg}`}>
      {isProfesional && (
        <>
          <div className={`fixed -top-40 left-1/4 w-[450px] sm:w-[750px] h-[450px] sm:h-[750px] rounded-full blur-[140px] sm:blur-[180px] pointer-events-none transition-all duration-1000 animate-pulse ${themeStyles.bgGlow}`}></div>
          <div className={`fixed bottom-0 right-10 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full blur-[140px] pointer-events-none transition-all duration-1000 ${themeStyles.bgGlowSecondary}`}></div>
        </>
      )}

      <div className="w-full max-w-[1400px] mx-auto space-y-4 sm:space-y-6 relative z-10">

        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl transition-all duration-300 gap-4 ${themeStyles.headerGradient}`}>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span className="text-xl sm:text-2xl">{isEyelash ? '✨' : '💈'}</span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight uppercase bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                {brandTitle || tenantCode || (isEyelash ? 'EYELASH SALON' : 'BARBERSHOP')}
              </h1>
              
              <span className={`text-[9px] sm:text-[10px] font-black px-3.5 py-1.5 rounded-full border tracking-widest transition-all uppercase flex items-center gap-1.5 ${
                isProfesional
                  ? 'bg-gradient-to-r from-amber-400/20 via-yellow-500/20 to-amber-600/30 border-amber-400/80 text-amber-300 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40 animate-pulse'
                  : subscriptionPlan === 'PREMIUM'
                  ? themeStyles.badgeBg
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
              }`}>
                {isProfesional && '👑 '}
                {subscriptionPlan === 'PREMIUM' && '⭐ '}
                {subscriptionPlan} PLAN
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-300 mt-1 font-medium">
              {isEyelash ? 'Kelola janji temu eyelash & beauty salon secara real-time' : 'Kelola dan pantau pesanan masuk secara real-time'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
            {subscriptionPlan !== 'BASIC' && (
              <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-700/80 p-1.5 px-3 rounded-2xl shadow-inner backdrop-blur-xl">
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-wider hidden sm:inline">Theme:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedTheme('purple')}
                    className={`w-6 h-6 rounded-full bg-purple-600 border-2 transition-all ${selectedTheme === 'purple' ? 'border-white scale-110 shadow-lg shadow-purple-500/80 ring-2 ring-purple-400' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    title="Tema Ungu (Luxury Purple)"
                  />
                  <button
                    onClick={() => setSelectedTheme('pink')}
                    className={`w-6 h-6 rounded-full bg-pink-500 border-2 transition-all ${selectedTheme === 'pink' ? 'border-white scale-110 shadow-lg shadow-pink-500/80 ring-2 ring-pink-400' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    title="Tema Pink (Glamour Pink)"
                  />
                  <button
                    onClick={() => setSelectedTheme('amber')}
                    className={`w-6 h-6 rounded-full bg-amber-400 border-2 transition-all ${selectedTheme === 'amber' ? 'border-white scale-110 shadow-lg shadow-amber-500/80 ring-2 ring-amber-300' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    title="Tema Amber/Gold (Royale Gold)"
                  />
                  <button
                    onClick={() => setSelectedTheme('emerald')}
                    className={`w-6 h-6 rounded-full bg-emerald-500 border-2 transition-all ${selectedTheme === 'emerald' ? 'border-white scale-110 shadow-lg shadow-emerald-500/80 ring-2 ring-emerald-400' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    title="Tema Hijau Emerald (Cyber Emerald)"
                  />
                  <button
                    onClick={() => setSelectedTheme('blue')}
                    className={`w-6 h-6 rounded-full bg-blue-500 border-2 transition-all ${selectedTheme === 'blue' ? 'border-white scale-110 shadow-lg shadow-blue-500/80 ring-2 ring-blue-400' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    title="Tema Biru (Neon Sapphire)"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  fetchReservations()
                  fetchBlockedSlots()
                }}
                className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:border-zinc-500 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 shadow-lg active:scale-95"
              >
                <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${themeStyles.textAccent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all text-[11px] sm:text-xs active:scale-95"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* KARTU PENGATURAN FITUR BOOKING */}
        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all space-y-4 shadow-xl ${themeStyles.cardBg}`}>
          <div className="border-b border-zinc-800/80 pb-3">
            <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${themeStyles.textAccent}`}>
              <span>⚙️ Pengaturan Fitur Booking Tenant ({brandTitle})</span>
            </h3>
            <p className="text-[11px] text-zinc-300 font-medium">
              Aktifkan atau nonaktifkan pembatasan booking dan visibilitas jam pada halaman pelanggan secara instan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TOGGLE 1: PREVENT DOUBLE BOOKING */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl">
              <div className="pr-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Batasi Double Booking</h4>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                  Mencegah pelanggan memesan jam & tanggal yang sudah diisi oleh orang lain.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  disabled={isUpdatingBookingToggle}
                  checked={preventDoubleBooking} 
                  onChange={(e) => handleToggleBookingSetting('prevent_double_booking', e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-emerald-500 peer-checked:to-teal-600"></div>
                <span className="ml-2.5 text-xs font-black text-zinc-200 min-w-[55px]">
                  {isUpdatingBookingToggle ? '...' : preventDoubleBooking ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* TOGGLE 2: HIDE BOOKED SLOTS */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl">
              <div className="pr-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Sembunyikan Jam Terisi</h4>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                  Sembunyikan jam yang sudah terisi sepenuhnya dari pilihan jadwal pelanggan.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  disabled={isUpdatingBookingToggle}
                  checked={hideBookedSlots} 
                  onChange={(e) => handleToggleBookingSetting('hide_booked_slots', e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-emerald-500 peer-checked:to-teal-600"></div>
                <span className="ml-2.5 text-xs font-black text-zinc-200 min-w-[55px]">
                  {isUpdatingBookingToggle ? '...' : hideBookedSlots ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {isProfesional && (
          <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl ${themeStyles.cardBg}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">💬</span>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Pengaturan WhatsApp Reminder Otomatis</h4>
                <p className="text-[11px] text-zinc-300 font-medium">Kirim pengingat otomatis ke WhatsApp pelanggan sebelum jadwal reservasi.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                disabled={isUpdatingWaToggle}
                checked={autoWaReminder} 
                onChange={(e) => handleToggleWaReminder(e.target.checked)} 
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-indigo-600"></div>
              <span className="ml-2.5 text-xs font-black text-zinc-200">
                {isUpdatingWaToggle ? 'PROSES...' : autoWaReminder ? 'AKTIF' : 'NONAKTIF'}
              </span>
            </label>
          </div>
        )}

        <div className={`grid grid-cols-2 sm:grid-cols-3 ${
          subscriptionPlan === 'BASIC' ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
        } gap-3 sm:gap-4`}>
          
          {(subscriptionPlan === 'PREMIUM' || isProfesional) && (
            <div className={`col-span-2 sm:col-span-1 border p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all relative overflow-hidden group ${themeStyles.cardBg}`}>
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="text-4xl sm:text-6xl">{isEyelash ? '💄' : '💰'}</span>
              </div>
              <p className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${themeStyles.textAccent}`}>Total Omzet</p>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Rp {stats.totalRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] sm:text-xs font-bold mt-1.5 flex items-center gap-1.5 text-emerald-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {stats.completedCount} transaksi selesai
                </p>
              </div>
            </div>
          )}

          <div className={`border p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all ${themeStyles.cardBg}`}>
            <p className="text-[10px] sm:text-xs font-bold text-zinc-300 uppercase tracking-wider">Total Booking</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{stats.totalBookings}</h3>
              <span className={`w-fit text-[9px] sm:text-[11px] font-black px-2.5 py-1 rounded-full border ${themeStyles.badgeBg}`}>Semua Data</span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all ${themeStyles.cardBg}`}>
            <p className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider">Menunggu</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">{stats.pendingCount}</h3>
              <span className="w-fit text-[9px] sm:text-[11px] text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">Konfirmasi</span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all ${themeStyles.cardBg}`}>
            <p className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider">Selesai</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{stats.completedCount}</h3>
              <span className="w-fit text-[9px] sm:text-xs font-extrabold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                {stats.completedPercentage}%
              </span>
            </div>
          </div>

          <div className={`border p-4 sm:p-6 rounded-2xl sm:rounded-3xl transition-all ${themeStyles.cardBg}`}>
            <p className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider">Pembatalan</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">{stats.cancelledCount}</h3>
              {stats.needRefundCount > 0 ? (
                <span className="w-fit text-[9px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                  {stats.needRefundCount} Refund
                </span>
              ) : (
                <span className="w-fit text-[9px] sm:text-xs font-extrabold text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/30">
                  {stats.cancelledPercentage}%
                </span>
              )}
            </div>
          </div>

        </div>

        {isProfesional && (
          <div className={`border p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden ${themeStyles.cardBg}`}>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border border-amber-400/50 bg-amber-500/20 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-lg shadow-amber-500/20">
                👑
              </div>
              <div className="min-w-0">
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${themeStyles.badgeBg}`}>
                  Performa Staff Terbaik ({staffLabel})
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1 truncate">
                  {stats.topStaffName !== '-' ? stats.topStaffName : 'Belum Ada Data'}
                </h3>
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t border-zinc-800 sm:border-t-0 pt-2 sm:pt-0">
              <span className={`text-xl sm:text-2xl font-black font-mono ${themeStyles.textAccent}`}>
                {stats.topStaffCount}
              </span>
              <p className="text-[10px] sm:text-[11px] text-zinc-300 font-bold uppercase tracking-wider">Transaksi Selesai</p>
            </div>
          </div>
        )}

        {subscriptionPlan === 'BASIC' && (
          <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-950/80 ${themeStyles.borderAccent}`}>
            <div className="space-y-1">
              <span className={`text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${themeStyles.badgeBg}`}>Upgrade Fitur Premium</span>
              <h3 className="text-sm sm:text-base font-black text-white">Buka Fitur Laporan Keuangan, Total Omzet, & Manajemen Staff!</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">Tingkatkan operasional bisnis kamu ke Paket Premium atau Profesional sekarang.</p>
            </div>
            <button onClick={() => alert('Silakan hubungi customer support untuk upgrade paket bisnis kamu!')} className={`w-full md:w-auto font-black px-5 py-2.5 rounded-xl sm:rounded-2xl text-xs whitespace-nowrap shadow-lg transition-all active:scale-95 ${themeStyles.buttonPrimary}`}>
              Upgrade Sekarang ⭐
            </button>
          </div>
        )}

        {/* KOMPONEN UI BLOCK SLOT */}
        <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl border transition-all space-y-4 ${themeStyles.cardBg}`}>
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${themeStyles.textAccent}`}>
                <span>🚫 Manajemen Block Slot / Jam Tutup Off (Detail Keterangan)</span>
              </h3>
              <p className="text-[11px] text-zinc-300 font-medium">
                Blokir jam tertentu dengan alasan khusus (Libur Hari Raya, Istirahat, dll) & sinkronisasi otomatis dengan jam yang sudah di-confirm.
              </p>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
              {blockedSlots.length} Slot Off
            </span>
          </div>

          <form onSubmit={handleAddBlockSlot} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">Tanggal Off:</label>
              <input 
                type="date" 
                required 
                value={blockDateInput} 
                onChange={(e) => setBlockDateInput(e.target.value)} 
                className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none ${themeStyles.focusBorder}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">Jam Off:</label>
              <select 
                value={blockTimeInput} 
                onChange={(e) => setBlockTimeInput(e.target.value)} 
                className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none cursor-pointer ${themeStyles.focusBorder}`}
              >
                {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map((time) => (
                  <option key={time} value={time}>{time} WIB</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">Kategori Keterangan:</label>
              <select 
                value={reasonPreset} 
                onChange={(e) => setReasonPreset(e.target.value)} 
                className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none cursor-pointer ${themeStyles.focusBorder}`}
              >
                <option value="Libur Lebaran">🌙 Libur Lebaran</option>
                <option value="Libur Nasional">🇮🇩 Libur Nasional / Tanggal Merah</option>
                <option value="Istirahat Staff">☕ Istirahat Staff / Capster</option>
                <option value="Maintenance Salon">🧹 Maintenance / Sterilisasi</option>
                <option value="Lainnya">✏️ Lainnya (Tulis Manual)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                {reasonPreset === 'Lainnya' ? 'Keterangan Detail:' : 'Catatan Tambahan:'}
              </label>
              <input 
                type="text" 
                placeholder={reasonPreset === 'Lainnya' ? "Misal: Ada Acara Keluar" : "Opsional..."}
                value={blockReasonInput} 
                onChange={(e) => setBlockReasonInput(e.target.value)} 
                className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none ${themeStyles.focusBorder}`}
              />
            </div>
            <button 
              type="submit" 
              disabled={isBlocking} 
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 h-[38px]"
            >
              {isBlocking ? 'Memproses...' : '🔒 Block Slot Ini'}
            </button>
          </form>

          {blockedSlots.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-800/60">
              <p className="text-[11px] font-bold text-zinc-400 mb-2 uppercase tracking-wider">Daftar Slot Ter-block Saat Ini:</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {blockedSlots.map((bs) => (
                  <div key={bs.id || `${bs.block_date}-${bs.block_time}`} className="flex items-center gap-2 bg-zinc-900 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs text-rose-300 shadow-sm">
                    <span className="font-bold">{formatDateID(bs.block_date)} - {bs.block_time} WIB</span>
                    {bs.reason && <span className="text-[10px] text-zinc-400">({bs.reason})</span>}
                    <button 
                      type="button"
                      onClick={() => handleDeleteBlockSlot(bs.id)} 
                      className="text-zinc-500 hover:text-white ml-1 font-bold transition-colors" 
                      title="Buka kembali slot jam ini"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {subscriptionPlan !== 'BASIC' && (
          <div className={`p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5 border transition-all ${themeStyles.cardBg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-2">
              <div>
                <h2 className={`text-base sm:text-lg font-black flex items-center gap-2 ${themeStyles.textAccent}`}>
                  <span>📊 Laporan Keuangan & Omzet Netto</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-zinc-300 font-medium">
                  Data siap diexport ke Excel atau dicetak langsung/disimpan sebagai PDF resmi.
                </p>
              </div>
              
              {subscriptionPlan === 'PREMIUM' && (
                <span className={`text-[9px] sm:text-[10px] font-black border px-3 py-1 rounded-full flex items-center gap-1.5 w-max ${themeStyles.badgeBg}`}>
                  ⭐ Premium Plan (Export Excel Only)
                </span>
              )}
              {isProfesional && (
                <span className="text-[9px] sm:text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-400/50 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 w-max shadow-lg shadow-amber-500/10">
                  👑 Profesional Plan (Excel + Cetak PDF)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className="md:col-span-6 space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-2">Tipe Laporan:</label>
                  <div className="grid grid-cols-4 gap-1 sm:gap-2 p-1 bg-zinc-950/80 rounded-xl sm:rounded-2xl border border-zinc-800">
                    {(['daily', 'weekly', 'monthly', 'custom'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setReportPeriod(mode)}
                        className={`py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all capitalize ${
                          reportPeriod === mode
                            ? themeStyles.btnActivePeriod
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                        }`}
                      >
                        {mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : mode === 'monthly' ? 'Bulanan' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>

                {reportPeriod !== 'custom' ? (
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5 sm:mb-2">
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
                      className={`w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none shadow-inner ${themeStyles.focusBorder}`}
                    />

                    {reportPeriod === 'weekly' && reportData.weekInfo && (
                      <p className={`text-[10px] sm:text-[11px] font-bold mt-2 flex items-center gap-1 ${themeStyles.textAccent}`}>
                        <span>📅</span> Periode: {formatDateID(reportData.weekInfo.startStr)} s/d {formatDateID(reportData.weekInfo.endStr)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-zinc-300 mb-1.5">Dari Tanggal:</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none shadow-inner ${themeStyles.focusBorder}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-zinc-300 mb-1.5">Sampai Tanggal:</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none shadow-inner ${themeStyles.focusBorder}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-6 space-y-3 sm:space-y-4">
                <div className="bg-zinc-950/90 border border-zinc-800/80 p-4 sm:p-5 rounded-xl sm:rounded-2xl grid grid-cols-2 gap-3 sm:gap-4 text-xs shadow-inner">
                  <div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">OMZET BRUTO</p>
                    <p className="text-lg sm:text-xl font-black text-white mt-1">
                      Rp {reportData.grossRevenue.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-rose-400 mt-1 font-bold">
                      Refund: -Rp {reportData.totalRefund.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right border-l border-zinc-800 pl-3 sm:pl-4">
                    <p className="text-[10px] sm:text-[11px] font-black text-emerald-400 uppercase tracking-wider">OMZET NETTO</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                      Rp {reportData.netRevenue.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>

                {subscriptionPlan === 'PREMIUM' && (
                  <div className="space-y-2">
                    <button
                      onClick={exportReportToCSV}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                    >
                      <span>📥 Export Laporan Excel</span>
                    </button>
                  </div>
                )}

                {isProfesional && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={exportReportToCSV}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                    >
                      <span>📥 Export Excel</span>
                    </button>

                    <button
                      onClick={handlePrintPDF}
                      className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 active:scale-[0.98] ${themeStyles.buttonPrimary}`}
                    >
                      <span>🖨️ Cetak / PDF</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        <div className={`border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl transition-all ${themeStyles.cardBg}`}>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${
            subscriptionPlan === 'BASIC' ? 'md:grid-cols-3 lg:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-7'
          } gap-3 sm:gap-4 items-end w-full`}>
            
            {subscriptionPlan !== 'BASIC' && (
              <div className="w-full lg:col-span-1">
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Pencarian Data:</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari nama, WA, atau layanan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-3.5 pr-8 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all shadow-inner ${themeStyles.focusBorder}`}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-all"
                      title="Clear Search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {subscriptionPlan !== 'BASIC' && (
              <div className="w-full">
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Dari Tanggal:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none shadow-inner ${themeStyles.focusBorder}`}
                />
              </div>
            )}

            {subscriptionPlan !== 'BASIC' && (
              <div className="w-full">
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Sampai Tanggal:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none shadow-inner ${themeStyles.focusBorder}`}
                />
              </div>
            )}

            <div className="w-full">
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${themeStyles.focusBorder}`}
              >
                <option value="all">Semua Status</option>
                <option value="pending">🟡 Pending</option>
                <option value="confirmed">🟢 Confirmed</option>
                <option value="completed">🔵 Completed</option>
                <option value="cancelled">🔴 Cancelled</option>
                <option value="cancelled_need_refund">⚠️ Need Refund</option>
              </select>
            </div>

            {subscriptionPlan !== 'BASIC' && (
              <div className="w-full">
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Layanan:</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${themeStyles.focusBorder}`}
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

            <div className="w-full">
              <label className="block text-xs font-bold text-zinc-300 mb-1.5">Limit Data:</label>
              <select
                value={limit}
                onChange={(e) => {
                  const val = e.target.value
                  setLimit(val === 'all' ? 'all' : Number(val))
                  setCurrentPage(1)
                }}
                className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${themeStyles.focusBorder}`}
              >
                <option value={10}>10 Baris</option>
                <option value={25}>25 Baris</option>
                <option value={50}>50 Baris</option>
                <option value="all">Semua Data</option>
              </select>
            </div>

            <div className="w-full flex gap-2 items-end">
              <div className="w-full">
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Metode Bayar:</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`w-full px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${themeStyles.focusBorder}`}
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
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all whitespace-nowrap h-[38px] sm:h-[42px]"
                >
                  Reset
                </button>
              )}
            </div>

          </div>
        </div>

        <div className={`border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all ${themeStyles.cardBg}`}>
          {loading ? (
            <div className="p-12 text-center text-zinc-400 text-xs font-semibold">Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 text-xs font-semibold">Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/90 text-[10px] font-black uppercase tracking-widest text-zinc-400 select-none">
                      <th onClick={() => handleSort('booking_date')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Tanggal</span>
                          {sortField === 'booking_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th onClick={() => handleSort('booking_time')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Jam</span>
                          {sortField === 'booking_time' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th onClick={() => handleSort('customer_name')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Pelanggan</span>
                          {sortField === 'customer_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th onClick={() => handleSort('service_name')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Layanan</span>
                          {sortField === 'service_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      {(subscriptionPlan === 'PREMIUM' || isProfesional) && (
                        <th onClick={() => handleSort('staff_name')} className={`py-3.5 px-3 cursor-pointer transition ${themeStyles.textAccent}`}>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span>{staffLabel}</span>
                            {sortField === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                          </div>
                        </th>
                      )}

                      <th onClick={() => handleSort('price')} className={`py-3.5 px-3 cursor-pointer transition text-emerald-400 hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Harga</span>
                          {sortField === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th onClick={() => handleSort('payment_method')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Metode</span>
                          {sortField === 'payment_method' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th className="py-3.5 px-3 whitespace-nowrap">WhatsApp</th>

                      <th onClick={() => handleSort('status')} className={`py-3.5 px-3 cursor-pointer transition hover:${themeStyles.textAccent}`}>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span>Status</span>
                          {sortField === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>

                      <th className="py-3.5 px-3 pr-4 text-center whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-[11px] font-medium">
                    {displayedReservations.map((item) => {
                      const currentStatus = item.status || 'pending'
                      const cleanPhone = item.whatsapp_number ? item.whatsapp_number.replace(/^0/, '62') : ''
                      const displayBrand = brandTitle || tenantCode || 'BISNIS'
                      
                      const refundWaMsg = encodeURIComponent(
                        `Halo Kak ${item.customer_name}, mohon maaf reservasi Kamu di ${displayBrand} pada tanggal ${formatDateID(item.booking_date)} jam ${item.booking_time} WIB kami batalkan.\n\n` +
                        `Karena Kakak sudah melakukan pembayaran, mohon infokan Nomor Rekening / E-Wallet Kakak agar dana sebesar Rp ${getServicePrice(item.service_name).toLocaleString('id-ID')} bisa kami refund segera ya. Terima kasih!`
                      )

                      return (
                        <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-zinc-200 whitespace-nowrap">{item.booking_date}</td>
                          <td className={`py-3 px-3 font-mono font-bold whitespace-nowrap ${themeStyles.textAccent}`}>{item.booking_time} WIB</td>
                          <td className="py-3 px-3 font-black text-white whitespace-nowrap">
                            {item.customer_name}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-block whitespace-nowrap border ${themeStyles.badgeBg}`}>
                              {item.service_name}
                            </span>
                          </td>

                          {(subscriptionPlan === 'PREMIUM' || isProfesional) && (
                            <td className="py-3 px-3 font-bold text-zinc-200">
                              {item.staff_name ? (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold inline-block bg-zinc-800 border border-zinc-700">
                                  👤 {item.staff_name}
                                </span>
                              ) : (
                                <span className="text-zinc-500 italic text-[10px]">Belum Dipilih</span>
                              )}
                            </td>
                          )}

                          <td className="py-3 px-3 font-black text-emerald-400 whitespace-nowrap">
                            Rp {getServicePrice(item.service_name).toLocaleString('id-ID')}
                          </td>

                          <td className="py-3 px-3 font-semibold text-zinc-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px]">
                              💳 {item.payment_method || 'QRIS'}
                            </span>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {cleanPhone ? (
                              <a
                                href={`https://wa.me/${cleanPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1 hover:underline"
                              >
                                <span>💬</span> {item.whatsapp_number}
                              </a>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <select
                              value={currentStatus}
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer focus:outline-none transition-all ${
                                currentStatus === 'confirmed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : isCompleted(currentStatus)
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : currentStatus === 'cancelled_need_refund'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                  : currentStatus.startsWith('cancelled')
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              <option value="pending" className="bg-zinc-900 text-amber-300">🟡 Pending</option>
                              <option value="confirmed" className="bg-zinc-900 text-emerald-300">🟢 Confirmed</option>
                              <option value="completed" className="bg-zinc-900 text-blue-300">🔵 Completed</option>
                              <option value="cancelled" className="bg-zinc-900 text-rose-300">🔴 Cancelled</option>
                              <option value="cancelled_need_refund" className="bg-zinc-900 text-amber-300">⚠️ Need Refund</option>
                              <option value="cancelled_refunded" className="bg-zinc-900 text-zinc-400">✅ Refunded</option>
                            </select>
                          </td>

                          <td className="py-3 px-3 pr-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {currentStatus === 'cancelled_need_refund' && (
                                <>
                                  <a
                                    href={`https://wa.me/${cleanPhone}?text=${refundWaMsg}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1"
                                    title="Minta Rekening Pelanggan via WA"
                                  >
                                    <span>💬 WA Refund</span>
                                  </a>
                                  <button
                                    onClick={() => handleCompleteRefund(item.id)}
                                    className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg font-bold text-[10px] transition-all"
                                    title="Tandai Refund Selesai"
                                  >
                                    Selesai Refund
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => handleDelete(item.id, item.customer_name)}
                                className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
                                title="Hapus Data Reservasi"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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
              {limit !== 'all' && totalPages > 1 && (
                <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="text-zinc-400 font-medium">
                    Menampilkan <strong className="text-zinc-200">{(currentPage - 1) * limit + 1}</strong> - <strong className="text-zinc-200">{Math.min(currentPage * limit, filteredReservations.length)}</strong> dari <strong className="text-zinc-200">{filteredReservations.length}</strong> reservasi
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-all font-bold"
                    >
                      Sebelumnya
                    </button>

                    <div className="flex items-center gap-1 px-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            currentPage === pageNum
                              ? `${themeStyles.buttonPrimary}`
                              : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-all font-bold"
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

      {/* MODAL CANCEL CONFIRMATION */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span className="text-rose-400">⚠️</span> Konfirmasi Pembatalan
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Kamu akan membatalkan pesanan atas nama <strong className="text-white">{cancelModalItem.customer_name}</strong>.
              Apakah pelanggan ini membutuhkan pengembalian dana (refund)?
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleConfirmCancel(true)}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold py-2.5 px-3 rounded-2xl text-xs transition-all"
              >
                Ya, Perlu Refund ⚠️
              </button>
              <button
                onClick={() => handleConfirmCancel(false)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-3 rounded-2xl text-xs transition-all shadow-md"
              >
                Tidak Perlu Refund 🚫
              </button>
            </div>

            <button
              onClick={() => setCancelModalItem(null)}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 font-bold pt-2 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

    </div>
  )
}