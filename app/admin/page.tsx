'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

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

type SortField = 'booking_date' | 'booking_time' | 'customer_name' | 'service_name' | 'staff_name' | 'price' | 'payment_method' | 'status'
type SortOrder = 'asc' | 'desc'
type SubscriptionPlanType = 'BASIC' | 'PREMIUM' | 'PROFESIONAL'
type BusinessType = 'eyelash' | 'barber'

// HELPER: Deteksi Brand & Tipe Bisnis Synchronous langsung dari Hostname
const detectBrandFromHostname = (): { brand: string; type: BusinessType } => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (host.includes('mcut')) return { brand: 'MCUT', type: 'barber' }
    if (host.includes('sem')) return { brand: 'SEM BARBERSHOP', type: 'barber' }
    if (host.includes('fitrifeb') || host.includes('lashes') || host.includes('eyelash')) {
      return { brand: 'FITRIFEB', type: 'eyelash' }
    }
  }
  return { brand: 'FITRIFEB', type: 'eyelash' } // Default Fallback
}

export default function AdminDashboard() {
  // State indikator inisialisasi awal (Mencegah Delay Flash Tampilan)
  const [isInitializing, setIsInitializing] = useState<boolean>(true)

  const [brandTitle, setBrandTitle] = useState<string>(() => detectBrandFromHostname().brand)
  const [businessType, setBusinessType] = useState<BusinessType>(() => detectBrandFromHostname().type)
  const [staffLabel, setStaffLabel] = useState<string>(() => 
    detectBrandFromHostname().type === 'eyelash' ? 'Lash Artist' : 'Capster / Staff'
  )

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tenantCode, setTenantCode] = useState<string>('')
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanType>('BASIC')

  // State Login Supabase
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter Tabel Utama
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  // State Sorting Tabel
  const [sortField, setSortField] = useState<SortField>('booking_date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // State Modal Refund
  const [cancelModalItem, setCancelModalItem] = useState<Reservation | null>(null)

  // State Laporan Keuangan / Report
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  // Helper Sanitasi Client Code / Slug
  const sanitizeClientCode = (code?: string) => {
    if (!code) return ''
    return code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  }

  // DETEKSI KATEGORI BISNIS DARI SLUG ATAU EMAIL
  const determineCategory = (slugOrEmail: string): BusinessType => {
    const text = slugOrEmail.toLowerCase()
    if (text.includes('fitri') || text.includes('lash') || text.includes('eyelash')) {
      return 'eyelash'
    }
    return 'barber'
  }

  // AMBIL DATA TENANT SUPABASE DENGAN OVERRIDE DINAMIS
  const fetchTenantDetail = useCallback(async (cleanCode: string, detectedBrandHint: string = '') => {
    try {
      let tenantData = null

      if (cleanCode) {
        const { data } = await supabase
          .from('Tenants')
          .select('subscription_plan, staff_label, tenant_slug')
          .ilike('tenant_slug', `%${cleanCode}%`)
          .maybeSingle()
        tenantData = data
      }

      if (!tenantData && detectedBrandHint) {
        const { data } = await supabase
          .from('Tenants')
          .select('subscription_plan, staff_label, tenant_slug')
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
      }     
    } catch (err) {
      console.error('Error fetching tenant details:', err)
    }
  }, [])

  // Login Handler
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

      await fetchTenantDetail(cleanCode)
    }
    setLoading(false)
  }

  // Logout Handler
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  // Fetch Reservations DENGAN ISOLASI TENANT (Mencegah Data Usaha Lain Muncul)
  const fetchReservations = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const rawClientCode = user?.app_metadata?.client_code || user?.app_metadata?.tenant_slug || user?.email || tenantCode
    const userClientCode = rawClientCode ? sanitizeClientCode(rawClientCode) : ''

    await fetchTenantDetail(userClientCode)

    // Mulai Query Supabase dengan filter tenant
    let query = supabase.from('Reservations').select('*')

    if (userClientCode) {
      // Filter berdasarkan tenant_slug ATAU client_code akun yang sedang aktif
      query = query.or(`tenant_slug.ilike.%${userClientCode}%,client_code.ilike.%${userClientCode}%`)
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

  // Update Status
  const updateStatusInDB = async (id: number, newStatus: string) => {
    const { error } = await supabase
      .from('Reservations')
      .update({ status: newStatus })
      .eq('id', id)

    if (error) {
      alert('Gagal update status: ' + error.message)
    } else {
      fetchReservations()
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

  // MAPPING HARGA LAYANAN BARBER & EYELASH
  const SERVICE_PRICES: Record<string, number> = {
    // Barber Services
    'Potong Rambut': 50000,
    'Coloring': 120000,
    'Creambath': 75000,
    'Shaving': 35000,
    // Eyelash Services
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

  // STATISTIK CARDS & TOP PERFORMER STAFF
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

  // LAPORAN KEUANGAN LOGIC
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

  // EXPORT EXCEL
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

    const displayBrand = brandTitle || tenantCode || (businessType === 'eyelash' ? 'FITRIFEB LASHES' : 'BARBERSHOP')
    const themeColor = businessType === 'eyelash' ? '#ec4899' : '#f59e0b'

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

  // CETAK PDF
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

    const displayBrand = brandTitle || tenantCode || (businessType === 'eyelash' ? 'FITRIFEB LASHES' : 'BARBERSHOP')
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

  // Dropdown list
  const uniqueServices = useMemo(() => {
    const list = new Set(reservations.map((r) => r.service_name).filter(Boolean))
    return Array.from(list)
  }, [reservations])

  const uniquePayments = useMemo(() => {
    const list = new Set(reservations.map((r) => r.payment_method || 'QRIS').filter(Boolean))
    return Array.from(list)
  }, [reservations])

  // FILTER & SORTING TABEL RESERVASI
  useEffect(() => {
    let result = [...reservations]

    if (startDate) result = result.filter((item) => item.booking_date >= startDate)
    if (endDate) result = result.filter((item) => item.booking_date <= endDate)

    if (statusFilter !== 'all') {
      result = result.filter((item) => {
        const s = (item.status || 'pending').toLowerCase()
        if (statusFilter === 'cancelled') return s.startsWith('cancelled')
        if (statusFilter === 'cancelled_need_refund') return s === 'cancelled_need_refund'
        return s === statusFilter.toLowerCase()
      })
    }

    if (serviceFilter !== 'all') result = result.filter((item) => item.service_name === serviceFilter)
    if (paymentFilter !== 'all') result = result.filter((item) => (item.payment_method || 'QRIS') === paymentFilter)

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item) =>
        item.customer_name?.toLowerCase().includes(term) ||
        item.whatsapp_number?.includes(term) ||
        item.service_name?.toLowerCase().includes(term) ||
        item.staff_name?.toLowerCase().includes(term)
      )
    }

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
  }, [startDate, endDate, statusFilter, serviceFilter, paymentFilter, searchTerm, sortField, sortOrder, reservations])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // INITIALIZER UNTUK CEK SESSION SUPABASE SAAT AWAL LOAD
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

        await fetchTenantDetail(cleanCode, info.brand)
      } else {
        await fetchTenantDetail('', info.brand)
      }
      setIsInitializing(false)
    }

    initSession()
  }, [fetchTenantDetail])

  useEffect(() => {
    if (isAuthenticated) fetchReservations()
  }, [isAuthenticated, fetchReservations])

  // PRE-RENDER LOADER: Cegah Delay / Flashing tampilan default sebelum session siap
  if (isInitializing) {
    return (
      <main className="min-h-screen bg-[#09090b] flex items-center justify-center font-sans text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-200 rounded-full animate-spin"></div>
          <span className="text-xs font-medium tracking-wide">Memuat Sistem Dashboard...</span>
        </div>
      </main>
    )
  }

  // RENDERING HALAMAN LOGIN DENGAN PERBEDAAAN THEME UI
  if (!isAuthenticated) {
    const isEyelash = businessType === 'eyelash'

    return (
      <main className={`min-h-screen flex items-center justify-center p-4 font-sans text-zinc-100 relative overflow-hidden transition-colors duration-300 ${
        isEyelash ? 'bg-[#0f0914]' : 'bg-[#09090b]'
      }`}>
        {/* Glow ambient effect dinamis */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isEyelash ? 'bg-pink-500/15' : 'bg-amber-500/10'
        }`}></div>

        <div className={`max-w-md w-full backdrop-blur-xl border rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative z-10 transition-all duration-300 ${
          isEyelash 
            ? 'bg-pink-950/20 border-pink-500/30 shadow-pink-950/30' 
            : 'bg-zinc-900/90 border-zinc-800 shadow-amber-500/5'
        }`}>
          <div className="text-center space-y-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border tracking-widest uppercase shadow-inner ${
              isEyelash 
                ? 'bg-gradient-to-r from-pink-500/20 to-rose-600/10 text-pink-300 border-pink-500/30' 
                : 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isEyelash ? 'bg-pink-400' : 'bg-amber-400'}`}></span>
              {isEyelash ? '✨ Eyelash Control Center' : '💈 Barber Control Center'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent mt-2">
              {brandTitle || (isEyelash ? 'FITRIFEB LASHES' : 'BARBERSHOP PORTAL')}
            </h1>
            <p className="text-xs text-zinc-400 font-medium">Masuk untuk mengakses dasbor manajemen reservasi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email Admin</label>
              <input
                type="email"
                required
                placeholder={isEyelash ? "admin@fitrieyelash.com" : "admin@barbershop.com"}
                className={`w-full px-4 py-3 bg-zinc-950/80 border rounded-2xl text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none transition-all shadow-inner ${
                  isEyelash ? 'border-pink-900/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20' : 'border-zinc-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
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
                  isEyelash ? 'border-pink-900/50 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20' : 'border-zinc-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
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
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/20'
              }`}
            >
              {loading ? 'Memproses Authentikasi...' : 'MASUK DASHBOARD'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  // VARIAN KATEGORI BISNIS KHUSUS DASHBOARD (EYELASH vs BARBER)
  const isEyelash = businessType === 'eyelash'
  const primaryAccent = isEyelash ? 'text-pink-400' : 'text-amber-400'

  return (
    <div className={`min-h-screen p-3 sm:p-6 md:p-8 text-zinc-100 font-sans relative transition-colors duration-500 ${
      isEyelash 
        ? subscriptionPlan === 'PROFESIONAL' ? 'bg-[#0f0714]' : subscriptionPlan === 'PREMIUM' ? 'bg-[#120814]' : 'bg-[#0f0914]'
        : subscriptionPlan === 'PROFESIONAL' ? 'bg-[#0a0712]' : subscriptionPlan === 'PREMIUM' ? 'bg-[#0d0a07]' : 'bg-[#09090b]'
    }`}>
      {/* Glow Ambient Dynamic Background */}
      <div className={`fixed top-0 left-1/4 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] rounded-full blur-[100px] sm:blur-[140px] pointer-events-none transition-all duration-700 ${
        isEyelash
          ? subscriptionPlan === 'PROFESIONAL' ? 'bg-purple-600/15' : 'bg-pink-600/15'
          : subscriptionPlan === 'PROFESIONAL' ? 'bg-purple-600/10' : 'bg-amber-600/10'
      }`}></div>

      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 relative z-10">

        {/* Header Dashboard Dynamic UI */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl border shadow-2xl transition-all duration-300 gap-4 ${
          isEyelash 
            ? subscriptionPlan === 'PROFESIONAL' 
              ? 'bg-gradient-to-r from-purple-950/50 via-pink-950/40 to-zinc-900 border-pink-500/40 shadow-pink-950/30'
              : 'bg-gradient-to-r from-pink-950/40 via-zinc-900/90 to-rose-950/30 border-pink-500/30 shadow-pink-950/20'
            : subscriptionPlan === 'PROFESIONAL'
              ? 'bg-gradient-to-r from-purple-950/40 via-zinc-900/80 to-purple-950/20 border-purple-500/30 shadow-purple-950/30'
              : 'bg-gradient-to-r from-amber-950/40 via-zinc-900/80 to-amber-950/20 border-amber-500/30 shadow-amber-950/30'
        }`}>
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span className="text-xl sm:text-2xl">{isEyelash ? '✨' : '💈'}</span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight uppercase">
                {brandTitle || tenantCode || (isEyelash ? 'FITRIFEB LASHES' : 'BARBERSHOP')}
              </h1>
              {/* BADGE PAKET LANGGANAN */}
              <span className={`text-[9px] sm:text-[10px] font-black px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border tracking-wider transition-all uppercase shadow-lg flex items-center gap-1.5 ${
                subscriptionPlan === 'PROFESIONAL'
                  ? 'bg-purple-500/10 border-purple-500/50 text-purple-300 shadow-purple-500/10 animate-pulse'
                  : subscriptionPlan === 'PREMIUM'
                  ? isEyelash ? 'bg-pink-500/10 border-pink-500/50 text-pink-300 shadow-pink-500/10' : 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-amber-500/10'
                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
              }`}>
                {subscriptionPlan === 'PROFESIONAL' && '👑 '}
                {subscriptionPlan === 'PREMIUM' && '⭐ '}
                {subscriptionPlan} PLAN
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 font-medium">
              {isEyelash ? 'Kelola janji temu eyelash & beauty salon secara real-time' : 'Kelola dan pantau pesanan masuk secara real-time'}
            </p>
          </div>

          <div className="space-x-2 sm:space-x-3 w-full md:w-auto flex justify-end items-center">
            <button
              onClick={fetchReservations}
              className="flex-1 md:flex-initial justify-center bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 hover:shadow-lg active:scale-95"
            >
              <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${primaryAccent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all text-[11px] sm:text-xs active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>

        {/* STATS CARDS GRID DYNAMIC THEME */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${
          subscriptionPlan === 'BASIC' ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
        } gap-3 sm:gap-4`}>
          
          {/* Card 1: Total Omzet */}
          {(subscriptionPlan === 'PREMIUM' || subscriptionPlan === 'PROFESIONAL') && (
            <div className={`col-span-2 sm:col-span-1 border p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-2xl transition-all relative overflow-hidden group ${
              isEyelash
                ? 'bg-gradient-to-br from-pink-950/40 via-zinc-900/90 to-zinc-900 border-pink-500/40'
                : 'bg-gradient-to-br from-emerald-950/40 via-zinc-900/90 to-zinc-900 border-emerald-500/40'
            }`}>
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="text-3xl sm:text-5xl">{isEyelash ? '💄' : '💰'}</span>
              </div>
              <p className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${
                isEyelash ? 'text-pink-300' : 'text-emerald-400'
              }`}>Total Omzet</p>
              <div className="mt-2 sm:mt-3">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Rp {stats.totalRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[10px] sm:text-xs font-bold mt-1 flex items-center gap-1 text-emerald-400/80">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {stats.completedCount} transaksi selesai
                </p>
              </div>
            </div>
          )}

          {/* Card 2: Total Booking */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl hover:border-zinc-700 transition-all">
            <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Booking</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{stats.totalBookings}</h3>
              <span className={`w-fit text-[9px] sm:text-[11px] font-extrabold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
                isEyelash ? 'text-pink-300 bg-pink-500/10 border-pink-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              }`}>Semua Data</span>
            </div>
          </div>

          {/* Card 3: Menunggu */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl hover:border-amber-500/40 transition-all">
            <p className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider">Menunggu</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">{stats.pendingCount}</h3>
              <span className="w-fit text-[9px] sm:text-[11px] text-amber-400/90 font-bold bg-amber-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-amber-500/20">Konfirmasi</span>
            </div>
          </div>

          {/* Card 4: Selesai */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl hover:border-emerald-500/40 transition-all">
            <p className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider">Selesai</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{stats.completedCount}</h3>
              <span className="w-fit text-[9px] sm:text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-emerald-500/20">
                {stats.completedPercentage}%
              </span>
            </div>
          </div>

          {/* Card 5: Pembatalan */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl hover:border-rose-500/40 transition-all">
            <p className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider">Pembatalan</p>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mt-2 sm:mt-3 gap-1">
              <h3 className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight">{stats.cancelledCount}</h3>
              {stats.needRefundCount > 0 ? (
                <span className="w-fit text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                  {stats.needRefundCount} Refund
                </span>
              ) : (
                <span className="w-fit text-[9px] sm:text-xs font-extrabold text-rose-400 bg-rose-500/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-rose-500/20">
                  {stats.cancelledPercentage}%
                </span>
              )}
            </div>
          </div>

        </div>

        {/* WIDGET HIGHLIGHT TOP STAFF (PROFESIONAL ONLY) */}
        {subscriptionPlan === 'PROFESIONAL' && (
          <div className={`border p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden ${
            isEyelash 
              ? 'bg-gradient-to-r from-pink-950/50 via-zinc-900/90 to-purple-950/30 border-pink-500/40' 
              : 'bg-gradient-to-r from-purple-950/50 via-zinc-900/90 to-purple-950/30 border-purple-500/40'
          }`}>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border flex items-center justify-center text-xl sm:text-2xl shrink-0 ${
                isEyelash ? 'bg-pink-500/20 border-pink-500/40' : 'bg-purple-500/20 border-purple-500/40'
              }`}>
                {isEyelash ? '👑' : '🏆'}
              </div>
              <div className="min-w-0">
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                  isEyelash ? 'text-pink-300 bg-pink-500/10 border-pink-500/30' : 'text-purple-300 bg-purple-500/10 border-purple-500/30'
                }`}>
                  Performa Staff Terbaik ({staffLabel})
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-1 truncate">
                  {stats.topStaffName !== '-' ? stats.topStaffName : 'Belum Ada Data'}
                </h3>
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t border-zinc-800 sm:border-t-0 pt-2 sm:pt-0">
              <span className={`text-xl sm:text-2xl font-black font-mono ${isEyelash ? 'text-pink-300' : 'text-purple-300'}`}>
                {stats.topStaffCount}
              </span>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 font-bold uppercase tracking-wider">Transaksi Selesai</p>
            </div>
          </div>
        )}

        {/* PROMOTION / UPSELL BANNER (BASIC) */}
        {subscriptionPlan === 'BASIC' && (
          <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isEyelash 
              ? 'bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-zinc-900 border-pink-500/30' 
              : 'bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-zinc-900 border-amber-500/30'
          }`}>
            <div className="space-y-1">
              <span className={`text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                isEyelash ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>Upgrade Fitur Premium</span>
              <h3 className="text-sm sm:text-base font-black text-white">Buka Fitur Laporan Keuangan, Total Omzet, & Manajemen Staff!</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">Tingkatkan operasional bisnis kamu ke Paket Premium atau Profesional sekarang.</p>
            </div>
            <button onClick={() => alert('Silakan hubungi customer support untuk upgrade paket bisnis kamu!')} className={`w-full md:w-auto font-black px-5 py-2.5 rounded-xl sm:rounded-2xl text-xs whitespace-nowrap shadow-lg transition-all active:scale-95 ${
              isEyelash 
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-pink-500/20' 
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/20'
            }`}>
              Upgrade Sekarang ⭐
            </button>
          </div>
        )}

        {/* PENARIKAN LAPORAN KEUANGAN (PREMIUM & PROFESIONAL) */}
        {subscriptionPlan !== 'BASIC' && (
          <div className={`p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5 border backdrop-blur-xl transition-all ${
            isEyelash 
              ? 'bg-zinc-900/90 border-pink-500/30 shadow-pink-950/20' 
              : 'bg-zinc-900/90 border-amber-500/30 shadow-amber-950/20'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-2">
              <div>
                <h2 className={`text-base sm:text-lg font-black flex items-center gap-2 ${
                  isEyelash ? 'text-pink-300' : 'text-amber-400'
                }`}>
                  <span>📊 Laporan Keuangan & Omzet Netto</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-zinc-400 font-medium">
                  Data siap diexport ke Excel atau dicetak langsung/disimpan sebagai PDF resmi.
                </p>
              </div>
              
              {subscriptionPlan === 'PREMIUM' && (
                <span className={`text-[9px] sm:text-[10px] font-black border px-3 py-1 rounded-full flex items-center gap-1.5 w-max ${
                  isEyelash ? 'bg-pink-500/10 text-pink-300 border-pink-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  ⭐ Premium Plan (Export Excel Only)
                </span>
              )}
              {subscriptionPlan === 'PROFESIONAL' && (
                <span className="text-[9px] sm:text-[10px] font-black bg-purple-500/10 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full flex items-center gap-1.5 w-max">
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
                            ? isEyelash 
                              ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                              : 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/30'
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
                      className={`w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none shadow-inner ${
                        isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                      }`}
                    />

                    {reportPeriod === 'weekly' && reportData.weekInfo && (
                      <p className={`text-[10px] sm:text-[11px] font-bold mt-2 flex items-center gap-1 ${isEyelash ? 'text-pink-300' : 'text-amber-400'}`}>
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
                        className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none shadow-inner ${
                          isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-zinc-300 mb-1.5">Sampai Tanggal:</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className={`w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none shadow-inner ${
                          isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                        }`}
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
                    <p className="text-[10px] sm:text-[11px] text-center text-zinc-500 font-medium">
                      💡 Upgrade ke <strong className="text-purple-400 font-bold">Paket Profesional</strong> untuk membuka fitur Cetak / Download PDF.
                    </p>
                  </div>
                )}

                {subscriptionPlan === 'PROFESIONAL' && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={exportReportToCSV}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                    >
                      <span>📥 Export Excel</span>
                    </button>

                    <button
                      onClick={handlePrintPDF}
                      className="w-full bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-[0.98]"
                    >
                      <span>🖨️ Cetak / PDF</span>
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* SEARCH & FILTER TABEL DATA */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-end justify-between">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 items-end w-full">
            <div className="w-full sm:w-60">
              <label className="block text-xs font-bold text-zinc-400 mb-1.5">Pencarian Data:</label>
              <input
                type="text"
                placeholder="Cari nama, WA, atau layanan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all shadow-inner ${
                  isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-zinc-400 mb-1.5">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full sm:w-auto px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${
                    isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                  }`}
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">🟡 Pending</option>
                  <option value="confirmed">🟢 Confirmed</option>
                  <option value="completed">🔵 Completed</option>
                  <option value="cancelled">🔴 Cancelled</option>
                  <option value="cancelled_need_refund">⚠️ Need Refund</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-bold text-zinc-400 mb-1.5">Layanan:</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className={`w-full sm:w-auto px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${
                    isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                  }`}
                >
                  <option value="all">Semua Layanan</option>
                  {uniqueServices.map((svc) => (
                    <option key={svc} value={svc}>
                      {isEyelash ? '💅' : '✂️'} {svc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-auto">
                <label className="block text-[11px] sm:text-xs font-bold text-zinc-400 mb-1.5">Metode Bayar:</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`w-full sm:w-auto px-3 py-2 sm:py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl sm:rounded-2xl text-xs text-zinc-200 focus:outline-none font-semibold cursor-pointer shadow-inner ${
                    isEyelash ? 'focus:border-pink-500' : 'focus:border-amber-500'
                  }`}
                >
                  <option value="all">Semua Metode</option>
                  {uniquePayments.map((pay) => (
                    <option key={pay} value={pay}>
                      💳 {pay}
                    </option>
                  ))}
                </select>
              </div>

              {(startDate || endDate || statusFilter !== 'all' || serviceFilter !== 'all' || paymentFilter !== 'all' || searchTerm) && (
                <button
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                    setStatusFilter('all')
                    setServiceFilter('all')
                    setPaymentFilter('all')
                    setSearchTerm('')
                  }}
                  className="mt-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABEL DATA RESERVASI DYNAMIC ACCENT */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs font-semibold">Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs font-semibold">Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-950/90 border-b border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-widest select-none">
                    
                    <th onClick={() => handleSort('booking_date')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Tanggal</span>
                        {sortField === 'booking_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('booking_time')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Jam</span>
                        {sortField === 'booking_time' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('customer_name')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Pelanggan</span>
                        {sortField === 'customer_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('service_name')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Layanan</span>
                        {sortField === 'service_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    {(subscriptionPlan === 'PREMIUM' || subscriptionPlan === 'PROFESIONAL') && (
                      <th onClick={() => handleSort('staff_name')} className={`p-3.5 sm:p-4.5 cursor-pointer transition ${
                        isEyelash ? 'text-pink-300' : 'text-amber-400'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span>{staffLabel}</span>
                          {sortField === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                    )}

                    <th onClick={() => handleSort('price')} className={`p-3.5 sm:p-4.5 cursor-pointer transition text-emerald-400 hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Harga</span>
                        {sortField === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('payment_method')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Metode</span>
                        {sortField === 'payment_method' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th className="p-3.5 sm:p-4.5">WhatsApp</th>

                    <th onClick={() => handleSort('status')} className={`p-3.5 sm:p-4.5 cursor-pointer transition hover:${primaryAccent}`}>
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {sortField === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th className="p-3.5 sm:p-4.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-xs font-medium">
                  {filteredReservations.map((item) => {
                    const currentStatus = item.status || 'pending'
                    const cleanPhone = item.whatsapp_number ? item.whatsapp_number.replace(/^0/, '62') : ''
                    const displayBrand = brandTitle || tenantCode || (isEyelash ? 'FITRIFEB LASHES' : 'BARBERSHOP')
                    
                    const refundWaMsg = encodeURIComponent(
                      `Halo Kak ${item.customer_name}, mohon maaf reservasi Kamu di ${displayBrand} pada tanggal ${formatDateID(item.booking_date)} jam ${item.booking_time} WIB kami batalkan.\n\n` +
                      `Karena Kakak sudah melakukan pembayaran, mohon infokan Nomor Rekening / E-Wallet Kakak agar dana sebesar Rp ${getServicePrice(item.service_name).toLocaleString('id-ID')} bisa kami refund segera ya. Terima kasih!`
                    )

                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-3.5 sm:p-4.5 font-bold text-zinc-200">{item.booking_date}</td>
                        <td className={`p-3.5 sm:p-4.5 font-mono font-bold ${primaryAccent}`}>{item.booking_time} WIB</td>
                        <td className="p-3.5 sm:p-4.5 font-black text-white">
                          {item.customer_name}
                        </td>
                        <td className="p-3.5 sm:p-4.5">
                          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold inline-block whitespace-nowrap border ${
                            isEyelash ? 'bg-pink-500/10 text-pink-300 border-pink-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {item.service_name}
                          </span>
                        </td>

                        {(subscriptionPlan === 'PREMIUM' || subscriptionPlan === 'PROFESIONAL') && (
                          <td className="p-3.5 sm:p-4.5 font-bold text-zinc-200">
                            {item.staff_name ? (
                              <span className={`px-2.5 py-1 rounded-xl text-[11px] border whitespace-nowrap ${
                                isEyelash
                                  ? 'bg-pink-950/40 border-pink-800/50 text-pink-200'
                                  : 'bg-zinc-800 border-zinc-700'
                              }`}>
                                👤 {item.staff_name}
                              </span>
                            ) : (
                              <span className="text-zinc-600 font-mono text-[10px]">-</span>
                            )}
                          </td>
                        )}

                        <td className="p-3.5 sm:p-4.5 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          Rp {getServicePrice(item.service_name).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5 sm:p-4.5">
                          <span className="bg-zinc-800/80 text-zinc-300 border border-zinc-700/80 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap">
                            {item.payment_method || 'QRIS'}
                          </span>
                        </td>
                        <td className="p-3.5 sm:p-4.5">
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <span>{item.whatsapp_number}</span>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                            </svg>
                          </a>
                        </td>
                        <td className="p-3.5 sm:p-4.5">
                          <div className="space-y-1.5">
                            <select
                              value={
                                currentStatus.startsWith('cancelled')
                                  ? 'cancelled'
                                  : currentStatus
                              }
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black border bg-zinc-950 focus:outline-none cursor-pointer transition-all ${
                                currentStatus === 'confirmed'
                                  ? 'text-blue-400 border-blue-500/40 bg-blue-500/10'
                                  : currentStatus === 'completed'
                                  ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                                  : currentStatus.startsWith('cancelled')
                                  ? 'text-rose-400 border-rose-500/40 bg-rose-500/10'
                                  : 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                              }`}
                            >
                              <option value="pending">🟡 Pending</option>
                              <option value="confirmed">🟢 Confirmed</option>
                              <option value="completed">🔵 Completed</option>
                              <option value="cancelled">🔴 Cancelled</option>
                            </select>

                            {currentStatus === 'cancelled_need_refund' && (
                              <div className="flex flex-col gap-1.5 mt-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 w-max">
                                  <span>⚠️</span> PERLU REFUND
                                </span>
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${refundWaMsg}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl text-[10px] font-bold text-center block transition-all"
                                >
                                  💬 Minta Rekening (WA)
                                </a>
                                <button
                                  onClick={() => handleCompleteRefund(item.id)}
                                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all"
                                >
                                  ✅ Selesai Refund
                                </button>
                              </div>
                            )}

                            {currentStatus === 'cancelled_refunded' && (
                              <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2.5 py-1 rounded-xl text-[10px] font-bold block w-max">
                                ✓ Refund Selesai
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 sm:p-4.5 text-center">
                          <button
                            onClick={() => handleDelete(item.id, item.customer_name)}
                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border border-rose-500/30 transition-all active:scale-95 whitespace-nowrap"
                          >
                            🗑️ Hapus
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL REFUND */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 max-w-md w-full space-y-4 sm:space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center space-y-2">
              <span className="text-3xl sm:text-4xl inline-block mb-1">💸</span>
              <h3 className="text-base sm:text-lg font-black text-white">Konfirmasi Pembatalan & Refund</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Kamu membatalkan reservasi atas nama <strong className={`${primaryAccent} font-bold`}>{cancelModalItem.customer_name}</strong>. Apakah transaksi ini perlu refund uang pelanggan?
              </p>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl text-xs space-y-2 shadow-inner">
              <div className="flex justify-between text-zinc-400 font-medium">
                <span>Layanan:</span>
                <span className="text-zinc-200 font-bold">{cancelModalItem.service_name}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-medium">
                <span>Metode Bayar:</span>
                <span className="text-zinc-200 font-bold">{cancelModalItem.payment_method || 'QRIS'}</span>
              </div>
              <div className="flex justify-between text-zinc-400 font-medium">
                <span>Nominal:</span>
                <span className="text-emerald-400 font-black">
                  Rp {getServicePrice(cancelModalItem.service_name).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleConfirmCancel(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl text-xs transition-all border border-zinc-700/80 active:scale-95"
              >
                Tidak (Belum Bayar)
              </button>
              <button
                onClick={() => handleConfirmCancel(true)}
                className={`font-black py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl text-xs transition-all shadow-lg active:scale-95 ${
                  isEyelash 
                    ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white shadow-pink-500/20' 
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/20'
                }`}
              >
                Ya, Perlu Refund 💸
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}