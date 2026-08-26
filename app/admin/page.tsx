'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
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
}

type SortField = 'booking_date' | 'booking_time' | 'customer_name' | 'service_name' | 'staff_name' | 'price' | 'payment_method' | 'status'
type SortOrder = 'asc' | 'desc'
type SubscriptionPlanType = 'BASIC' | 'PREMIUM' | 'PROFESIONAL'

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tenantCode, setTenantCode] = useState<string>('')
  const [brandTitle, setBrandTitle] = useState<string>('BARBERSHOP')

  // STATE UNTUK KONTROL PAKET LANGGANAN & STAFF LABEL
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanType>('BASIC')
  const [staffLabel, setStaffLabel] = useState<string>('Capster / Staff')

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

  // State Khusus Penarikan Laporan / Report
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('monthly')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

  // Helper Sanitasi Client Code
  const sanitizeClientCode = (code?: string) => {
    if (!code) return ''
    return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  }

  // Deteksi Nama Brand/Tenant Berdasarkan Hostname URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase()
      if (hostname.includes('sem')) {
        setBrandTitle('SEM')
      } else if (hostname.includes('mcut')) {
        setBrandTitle('MCUT')
      }
    }
  }, [])

  
  // AMBIL DATA TENANT (PAKET LANGGANAN & STAFF LABEL)
  const fetchTenantDetail = async (cleanCode: string) => {
    // 1. Coba cari berdasarkan client_code dulu
    let { data, error } = await supabase
      .from('Tenants')
      .select('subscription_plan, staff_label, name, client_code')
      .eq('client_code', cleanCode)
      .maybeSingle()

    // 2. Fallback: Ambil data row pertama jika client_code tidak cocok
    if (!data) {
      const { data: firstRow, error: fallbackError } = await supabase
        .from('Tenants')
        .select('subscription_plan, staff_label, name, client_code')
        .limit(1)
        .maybeSingle()
      
      data = firstRow
      error = fallbackError
    }

    if (error) {
      console.error('Error Supabase Tenant:', error.message)
      return
    }

    if (data) {
      console.log('Data Tenant Berhasil Diambil:', data)
      
      if (data.subscription_plan) {
        const planUpper = data.subscription_plan.trim().toUpperCase()
        if (planUpper.includes('PRO')) {
          setSubscriptionPlan('PROFESIONAL')
        } else if (planUpper.includes('PREMIUM')) {
          setSubscriptionPlan('PREMIUM')
        } else {
          setSubscriptionPlan('BASIC')
        }
      }
      if (data.staff_label) setStaffLabel(data.staff_label)
      if (data.name) setBrandTitle(data.name)
    }
  }

  // Login
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
      const rawCode = data.session.user.app_metadata?.client_code || ''
      const cleanCode = sanitizeClientCode(rawCode)
      setTenantCode(cleanCode)
      fetchTenantDetail(cleanCode)
    }
    setLoading(false)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  // Fetch Reservations
  const fetchReservations = async () => {
  setLoading(true)
  const { data: { user } } = await supabase.auth.getUser()
  
  const rawClientCode = user?.app_metadata?.client_code || tenantCode
  const userClientCode = rawClientCode ? sanitizeClientCode(rawClientCode) : null

  if (userClientCode) {
    // Ambil ulang detail tenant (termasuk status paket terbaru dari Supabase)
    await fetchTenantDetail(userClientCode)
  }

  let query = supabase
    .from('Reservations')
    .select('*')
    .order('created_at', { ascending: false })

  if (userClientCode) {
    query = query.eq('client_code', userClientCode)
  }

  const { data, error } = await query

  if (error) {
    alert('Gagal mengambil data: ' + error.message)
  } else {
    setReservations(data || [])
    setFilteredReservations(data || [])
  }
  setLoading(false)
}

  // Function Mengubah Status Umum
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

  // Handler Keputusan Modal Refund
  const handleConfirmCancel = async (needRefund: boolean) => {
    if (!cancelModalItem) return
    const statusText = needRefund ? 'cancelled_need_refund' : 'cancelled'
    await updateStatusInDB(cancelModalItem.id, statusText)
    setCancelModalItem(null)
  }

  // Handler Selesai Refund
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

  // MAPPING HARGA LAYANAN
  const SERVICE_PRICES: Record<string, number> = {
    'Potong Rambut': 50000,
    'Coloring': 120000,
    'Creambath': 75000,
    'Shaving': 35000,
  }

  const getServicePrice = (serviceName?: string): number => {
    if (!serviceName) return 50000
    if (serviceName.includes(',')) {
      const parts = serviceName.split(',').map((s) => s.trim())
      return parts.reduce((acc, curr) => acc + (SERVICE_PRICES[curr] || 50000), 0)
    }
    return SERVICE_PRICES[serviceName] ?? 50000
  }

  // Helper Format Tanggal Indonesia (DD/MM/YYYY)
  const formatDateID = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  // Helper Cek Status Selesai
  const isCompleted = (status?: string) => {
    const s = (status || '').toString().trim().toLowerCase()
    return s === 'completed' || s === 'selesai'
  }

  // HELPER MINGGUAN
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

  // STATISTIK CARDS UTAMA
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
  }, [reservations])

  // LOGIKA PENARIKAN LAPORAN KEUANGAN
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
  }, [reservations, reportPeriod, reportDate, reportStartDate, reportEndDate])

  // EXPORT LAPORAN KEUANGAN UNTUK EXCEL (.XLS)
  const exportReportToCSV = () => {
    if (subscriptionPlan !== 'PROFESIONAL') {
      alert('Fitur Penarikan Laporan Excel hanya tersedia di Paket Profesional.')
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

    const displayBrand = brandTitle || tenantCode || 'BARBERSHOP'

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th { background-color: #f59e0b; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #cccccc; padding: 8px; }
          td { border: 1px solid #cccccc; padding: 6px 10px; text-align: left; }
          .num { text-align: right; font-weight: font-semibold; }
          .center { text-align: center; }
          .total-row { background-color: #fef3c7; font-weight: bold; }
          .net-row { background-color: #d1fae5; font-weight: bold; font-size: 13px; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #555555; margin-bottom: 12px; }
          .status-completed { color: #059669; font-weight: bold; }
          .status-refund { color: #dc2626; font-weight: bold; }
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
                  <td class="center ${isRefund ? 'status-refund' : 'status-completed'}">
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
              <td colspan="8" style="text-align: right;">TOTAL OMZET BRUTO (UANG MASUK):</td>
              <td class="num" style="color: #059669;">Rp ${reportData.grossRevenue.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="total-row">
              <td colspan="8" style="text-align: right; color: #dc2626;">TOTAL PENGEMBALIAN DANA (REFUND):</td>
              <td class="num" style="color: #dc2626;">- Rp ${reportData.totalRefund.toLocaleString('id-ID')}</td>
            </tr>
            <tr class="net-row">
              <td colspan="8" style="text-align: right; font-weight: bold; color: #065f46;">TOTAL OMZET NETTO (PENDAPATAN BERSIH):</td>
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

  // FITUR CETAK / SIMPAN KE PDF
  const handlePrintPDF = () => {
    if (subscriptionPlan !== 'PROFESIONAL') {
      alert('Fitur Cetak / PDF Laporan hanya tersedia di Paket Profesional.')
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

    const displayBrand = brandTitle || tenantCode || 'BARBERSHOP'
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
          .text-red { color: #dc2626; }
          .text-green { color: #059669; }
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
                  <td class="center bold ${isRefund ? 'text-red' : 'text-green'}">
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
              <td>Omzet Bruto (Uang Masuk):</td>
              <td class="right bold text-green">Rp ${reportData.grossRevenue.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Total Refund (Uang Keluar):</td>
              <td class="right bold text-red">- Rp ${reportData.totalRefund.toLocaleString('id-ID')}</td>
            </tr>
            <tr style="border-top: 2px solid #000; font-size: 12px;">
              <td class="bold">Omzet Netto:</td>
              <td class="right bold text-green">Rp ${reportData.netRevenue.toLocaleString('id-ID')}</td>
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

  // Dropdown filter
  const uniqueServices = useMemo(() => {
    const list = new Set(reservations.map((r) => r.service_name).filter(Boolean))
    return Array.from(list)
  }, [reservations])

  const uniquePayments = useMemo(() => {
    const list = new Set(reservations.map((r) => r.payment_method || 'QRIS').filter(Boolean))
    return Array.from(list)
  }, [reservations])

  // FILTER + SORTING TABEL
  useEffect(() => {
    let result = [...reservations]

    if (startDate) result = result.filter((item) => item.booking_date >= startDate)
    if (endDate) result = result.filter((item) => item.booking_date <= endDate)

    if (statusFilter !== 'all') {
      result = result.filter((item) => {
        const s = (item.status || 'pending').toLowerCase()
        if (statusFilter === 'cancelled') return s.startsWith('cancelled')
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

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsAuthenticated(true)
        const rawCode = data.session.user.app_metadata?.client_code || ''
        const cleanCode = sanitizeClientCode(rawCode)
        setTenantCode(cleanCode)
        fetchTenantDetail(cleanCode)
      }
    }
    checkSession()
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchReservations()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-100">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-wider">
              ADMIN DASHBOARD
            </span>
            <h1 className="text-2xl font-black text-white tracking-wide uppercase mt-2">
              {brandTitle ? `${brandTitle}` : 'BARBERSHOP PORTAL'}
            </h1>
            <p className="text-xs text-zinc-400">Silakan login untuk mengelola sistem reservasi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email Admin</label>
              <input
                type="email"
                required
                placeholder="admin@barbershop.com"
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
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
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition text-xs shadow-lg shadow-amber-500/10 disabled:opacity-50 mt-2"
            >
              {loading ? 'Memproses...' : 'Masuk Dashboard'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 text-zinc-100 font-sans relative">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Dashboard Clean + BADGE PAKET */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                {brandTitle || tenantCode || 'BARBERSHOP'}
              </h1>
              {/* BADGE PENANDA PAKET */}
              <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full border tracking-wider ${
                subscriptionPlan === 'PROFESIONAL'
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : subscriptionPlan === 'PREMIUM'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}>
                {subscriptionPlan} PLAN
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Kelola dan pantau pesanan masuk secara real-time</p>
          </div>

          <div className="space-x-3 w-full md:w-auto flex justify-end">
            <button
              onClick={fetchReservations}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2 rounded-xl font-semibold transition text-xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Data</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 px-4 py-2 rounded-xl font-semibold transition text-xs"
            >
              Logout
            </button>
          </div>
        </div>

        {/* STATS CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-gradient-to-br from-emerald-950/80 to-zinc-900 border border-emerald-500/40 p-5 rounded-2xl shadow-xl">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Total Omzet</p>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-white">
                Rp {stats.totalRevenue.toLocaleString('id-ID')}
              </h3>
              <p className="text-[10px] text-emerald-400/80 font-medium mt-1">
                {stats.completedCount} transaksi selesai
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Booking</p>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-white">{stats.totalBookings}</h3>
              <span className="text-xs text-amber-500 font-medium">Semua data</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Menunggu</p>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-amber-400">{stats.pendingCount}</h3>
              <span className="text-xs text-amber-500/80 font-medium">Perlu Konfirmasi</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Dikonfirmasi</p>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-blue-400">{stats.confirmedCount}</h3>
              <span className="text-xs text-blue-500/80 font-medium">Siap dilayani</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Selesai</p>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-emerald-400">{stats.completedCount}</h3>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {stats.completedPercentage}%
              </span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Pembatalan</p>
            <div className="flex items-baseline justify-between mt-2">
              <h3 className="text-3xl font-black text-rose-400">{stats.cancelledCount}</h3>
              {stats.needRefundCount > 0 ? (
                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 animate-pulse">
                  {stats.needRefundCount} Perlu Refund
                </span>
              ) : (
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {stats.cancelledPercentage}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PENARIKAN LAPORAN KEUANGAN */}
        <div className="bg-zinc-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                <span>📊 Penarikan Laporan Keuangan (Omzet Netto)</span>
              </h2>
              <p className="text-xs text-zinc-400">
                Data siap diexport ke Excel atau dicetak langsung/disimpan sebagai PDF resmi.
              </p>
            </div>
            {subscriptionPlan !== 'PROFESIONAL' && (
              <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span>🔒</span> Khusus Paket Profesional
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div className="md:col-span-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Tipe Laporan:</label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
                  {(['daily', 'weekly', 'monthly', 'custom'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setReportPeriod(mode)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                        reportPeriod === mode
                          ? 'bg-amber-500 text-zinc-950 shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {mode === 'daily' ? 'Harian' : mode === 'weekly' ? 'Mingguan' : mode === 'monthly' ? 'Bulanan' : 'Custom'}
                    </button>
                  ))}
                </div>
              </div>

              {reportPeriod !== 'custom' ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
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
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />

                  {reportPeriod === 'weekly' && reportData.weekInfo && (
                    <p className="text-[11px] text-amber-400 font-semibold mt-1">
                      📅 Periode: {formatDateID(reportData.weekInfo.startStr)} s/d {formatDateID(reportData.weekInfo.endStr)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Dari Tanggal:</label>
                    <input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Sampai Tanggal:</label>
                    <input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-6 space-y-3">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">OMZET BRUTO</p>
                  <p className="text-xl font-black text-white mt-1">
                    Rp {reportData.grossRevenue.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-red-400 mt-0.5 font-medium">
                    Refund: -Rp {reportData.totalRefund.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-right border-l border-zinc-800 pl-4">
                  <p className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">OMZET NETTO</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    Rp {reportData.netRevenue.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* TOMBOL EXPORT / LOCK STATE */}
              {subscriptionPlan === 'PROFESIONAL' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={exportReportToCSV}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/10"
                  >
                    <span>📥 Excel</span>
                  </button>

                  <button
                    onClick={handlePrintPDF}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    <span>🖨️ Cetak / PDF</span>
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <span>🔒</span> Export Excel & Cetak PDF dikunci.
                  </span>
                  <a
                    href="https://wa.me/628123456789?text=Halo%20Admin,%20saya%20ingin%20upgrade%20ke%20Paket%20Profesional"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-lg transition"
                  >
                    Upgrade Paket
                  </a>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SEARCH & FILTER TABEL DATA */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end w-full">
            <div className="w-full sm:w-52">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Pencarian Tabel:</label>
              <input
                type="text"
                placeholder="Cari nama, WA, atau layanan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Filter Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Status</option>
                <option value="pending">🟡 Pending</option>
                <option value="confirmed">🟢 Confirmed</option>
                <option value="completed">🔵 Completed</option>
                <option value="cancelled">🔴 Cancelled (Semua)</option>
                <option value="cancelled_need_refund">⚠️ Cancelled (Need Refund)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Filter Layanan:</label>
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Semua Layanan</option>
                {uniqueServices.map((svc) => (
                  <option key={svc} value={svc}>
                    ✂️ {svc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Filter Metode Bayar:</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
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
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-3 py-2 rounded-xl text-xs font-medium transition"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* TABEL DATA RESERVASI */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs">Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider select-none">
                    
                    <th onClick={() => handleSort('booking_date')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Tanggal Booking</span>
                        {sortField === 'booking_date' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('booking_time')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Jam</span>
                        {sortField === 'booking_time' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('customer_name')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Nama Pelanggan</span>
                        {sortField === 'customer_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('service_name')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Layanan</span>
                        {sortField === 'service_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    {/* KOLOM STAFF / CAPSTER (PAKET PREMIUM & PROFESIONAL) */}
                    {(subscriptionPlan === 'PREMIUM' || subscriptionPlan === 'PROFESIONAL') && (
                      <th onClick={() => handleSort('staff_name')} className="p-4 cursor-pointer hover:text-amber-400 transition text-amber-400">
                        <div className="flex items-center gap-1">
                          <span>{staffLabel}</span>
                          {sortField === 'staff_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                    )}

                    <th onClick={() => handleSort('price')} className="p-4 cursor-pointer hover:text-amber-400 transition text-emerald-400">
                      <div className="flex items-center gap-1">
                        <span>Harga</span>
                        {sortField === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th onClick={() => handleSort('payment_method')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Metode Bayar</span>
                        {sortField === 'payment_method' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th className="p-4">WhatsApp</th>

                    <th onClick={() => handleSort('status')} className="p-4 cursor-pointer hover:text-amber-400 transition">
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {sortField === 'status' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                    </th>

                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {filteredReservations.map((item) => {
                    const currentStatus = item.status || 'pending'
                    const cleanPhone = item.whatsapp_number ? item.whatsapp_number.replace(/^0/, '62') : ''
                    const displayBrand = brandTitle || tenantCode || 'BARBERSHOP'
                    
                    const refundWaMsg = encodeURIComponent(
                      `Halo Kak ${item.customer_name}, mohon maaf reservasi Kamu di ${displayBrand} pada tanggal ${formatDateID(item.booking_date)} jam ${item.booking_time} WIB kami batalkan.\n\n` +
                      `Karena Kakak sudah melakukan pembayaran, mohon infokan Nomor Rekening / E-Wallet Kakak agar dana sebesar Rp ${getServicePrice(item.service_name).toLocaleString('id-ID')} bisa kami refund segera ya. Terima kasih!`
                    )

                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                        <td className="p-4 font-semibold text-zinc-200">{item.booking_date}</td>
                        <td className="p-4 font-mono text-zinc-400">{item.booking_time} WIB</td>
                        <td className="p-4 font-bold text-white">
                          {item.customer_name}
                        </td>
                        <td className="p-4">
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            {item.service_name}
                          </span>
                        </td>

                        {/* MUNCULKAN NAMA STAFF / CAPSTER JIKA PAKET PREMIUM / PROFESIONAL */}
                        {(subscriptionPlan === 'PREMIUM' || subscriptionPlan === 'PROFESIONAL') && (
                          <td className="p-4 font-medium text-zinc-200">
                            {item.staff_name ? (
                              <span className="bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-md text-[11px]">
                                👤 {item.staff_name}
                              </span>
                            ) : (
                              <span className="text-zinc-600 font-mono text-[10px]">-</span>
                            )}
                          </td>
                        )}

                        <td className="p-4 font-semibold text-emerald-400">
                          Rp {getServicePrice(item.service_name).toLocaleString('id-ID')}
                        </td>
                        <td className="p-4">
                          <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded-md text-[11px] font-medium">
                            {item.payment_method || 'QRIS'}
                          </span>
                        </td>
                        <td className="p-4">
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1.5"
                          >
                            <span>{item.whatsapp_number}</span>
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                            </svg>
                          </a>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5">
                            <select
                              value={
                                currentStatus.startsWith('cancelled')
                                  ? 'cancelled'
                                  : currentStatus
                              }
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                              className={`p-1.5 rounded-lg text-xs font-bold border bg-zinc-950 focus:outline-none cursor-pointer ${
                                currentStatus === 'confirmed'
                                  ? 'text-blue-400 border-blue-500/40'
                                  : currentStatus === 'completed'
                                  ? 'text-emerald-400 border-emerald-500/40'
                                  : currentStatus.startsWith('cancelled')
                                  ? 'text-red-400 border-red-500/40'
                                  : 'text-amber-400 border-amber-500/40'
                              }`}
                            >
                              <option value="pending">🟡 Pending</option>
                              <option value="confirmed">🟢 Confirmed</option>
                              <option value="completed">🔵 Completed</option>
                              <option value="cancelled">🔴 Cancelled</option>
                            </select>

                            {currentStatus === 'cancelled_need_refund' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">
                                  <span>⚠️</span> PERLU REFUND
                                </span>
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${refundWaMsg}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded text-[10px] font-bold text-center block transition"
                                >
                                  💬 Minta Rekening (WA)
                                </a>
                                <button
                                  onClick={() => handleCompleteRefund(item.id)}
                                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-[10px] font-bold transition"
                                >
                                  ✅ Selesai Refund
                                </button>
                              </div>
                            )}

                            {currentStatus === 'cancelled_refunded' && (
                              <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-semibold block w-max">
                                ✓ Refund Selesai
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDelete(item.id, item.customer_name)}
                            className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-500/20 transition"
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

      {/* MODAL POP-UP KONFIRMASI PEMBATALAN & REFUND */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="text-center space-y-2">
              <span className="text-3xl">💸</span>
              <h3 className="text-base font-extrabold text-white">Konfirmasi Pembatalan & Refund</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kamu membatalkan reservasi atas nama <strong className="text-amber-400">{cancelModalItem.customer_name}</strong>. Apakah transaksi ini perlu refund uang pelanggan?
              </p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Layanan:</span>
                <span className="text-zinc-200 font-semibold">{cancelModalItem.service_name}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Metode Bayar:</span>
                <span className="text-zinc-200 font-semibold">{cancelModalItem.payment_method || 'QRIS'}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Nominal:</span>
                <span className="text-emerald-400 font-bold">
                  Rp {getServicePrice(cancelModalItem.service_name).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleConfirmCancel(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 px-4 rounded-xl text-xs transition border border-zinc-700"
              >
                Tidak (Belum Bayar)
              </button>
              <button
                onClick={() => handleConfirmCancel(true)}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-lg shadow-amber-500/10"
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