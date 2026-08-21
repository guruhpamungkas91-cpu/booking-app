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
  booking_date: string
  booking_time: string
  payment_method?: string
  status: string
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // State Login Supabase
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  // State Filter & Search Tabel Utama
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // State Khusus Penarikan Laporan / Report
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')

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
    }
    setLoading(false)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
  }

  const fetchReservations = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('Reservations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Gagal mengambil data: ' + error.message)
    } else {
      setReservations(data || [])
      setFilteredReservations(data || [])
    }
    setLoading(false)
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
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

  // 1. MAPPING HARGA LAYANAN
  const SERVICE_PRICES: Record<string, number> = {
    'Potong Rambut': 50000,
    'Coloring': 120000,
    'Creambath': 75000,
    'Shaving': 35000,
  }

  const getServicePrice = (serviceName?: string): number => {
    if (!serviceName) return 50000
    return SERVICE_PRICES[serviceName] ?? 50000
  }

  // Helper Format Tanggal Indonesia (DD/MM/YYYY)
  const formatDateID = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  // 2. HELPER UNTUK MENGHITUNG RENTANG MINGGUAN (Senin s/d Minggu)
  const getWeekRange = (dateString: string) => {
    if (!dateString) return { startStr: '', endStr: '' }
    const [year, month, day] = dateString.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day)

    const currentDay = targetDate.getDay() // 0: Minggu, 1: Senin, dst.
    const diffToMonday = targetDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1)

    const monday = new Date(targetDate)
    monday.setDate(diffToMonday)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const formatYMD = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const date = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${date}`
    }

    return {
      startStr: formatYMD(monday),
      endStr: formatYMD(sunday),
    }
  }

  // 3. STATISTIK CARDS UTAMA
  const stats = useMemo(() => {
    const totalBookings = reservations.length

    const totalRevenue = reservations.reduce((sum, item) => {
      const s = (item.status || '').toString().trim().toLowerCase()
      // Menghitung omzet dari transaksi yang tidak dibatalkan
      if (s !== 'cancelled' && s !== 'batal') {
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

    const completedCount = reservations.filter((b) => {
      const s = (b.status || '').toString().trim().toLowerCase()
      return s === 'completed' || s === 'selesai'
    }).length

    const cancelledCount = reservations.filter((b) => {
      const s = (b.status || '').toString().trim().toLowerCase()
      return s === 'cancelled' || s === 'batal'
    }).length

    return {
      totalBookings,
      pendingCount,
      confirmedCount,
      completedCount,
      cancelledCount,
      completedPercentage: totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0,
      cancelledPercentage: totalBookings > 0 ? Math.round((cancelledCount / totalBookings) * 100) : 0,
      totalRevenue,
    }
  }, [reservations])

  // 4. LOGIKA PENARIKAN LAPORAN (REPORT FILTER AKURAT TANPA BUG TIMEZONE)
  const reportData = useMemo(() => {
    let weekInfo = { startStr: '', endStr: '' }

    const filtered = reservations.filter((item) => {
      const itemDate = item.booking_date // Format String: YYYY-MM-DD

      if (reportPeriod === 'daily') {
        return itemDate === reportDate
      }

      if (reportPeriod === 'weekly') {
        weekInfo = getWeekRange(reportDate)
        return itemDate >= weekInfo.startStr && itemDate <= weekInfo.endStr
      }

      if (reportPeriod === 'monthly') {
        const selectedYearMonth = reportDate.substring(0, 7) // "YYYY-MM"
        return itemDate.startsWith(selectedYearMonth)
      }

      if (reportPeriod === 'custom') {
        if (!reportStartDate || !reportEndDate) return true
        return itemDate >= reportStartDate && itemDate <= reportEndDate
      }

      return true
    })

    // Hitung total omzet laporan (Abaikan transaksi yang dibatalkan)
    const totalRevenue = filtered.reduce((sum, item) => {
      const s = (item.status || '').toString().trim().toLowerCase()
      if (s !== 'cancelled' && s !== 'batal') {
        return sum + getServicePrice(item.service_name)
      }
      return sum
    }, 0)

    return {
      items: filtered,
      totalRevenue,
      count: filtered.length,
      weekInfo: reportPeriod === 'weekly' ? getWeekRange(reportDate) : null,
    }
  }, [reservations, reportPeriod, reportDate, reportStartDate, reportEndDate])

  // EXPORT LAPORAN KHUSUS PERIODE KE CSV
  const exportReportToCSV = () => {
    if (reportData.items.length === 0) {
      alert('Tidak ada data transaksi pada periode laporan ini!')
      return
    }

    const headers = ['Tanggal Booking,Jam,Nama Pelanggan,Layanan,Harga,Metode Bayar,WhatsApp,Status\n']
    const rows = reportData.items.map(
      (item) =>
        `"${item.booking_date}","${item.booking_time}","${item.customer_name}","${item.service_name}","${getServicePrice(item.service_name)}","${item.payment_method || 'QRIS'}","${item.whatsapp_number}","${item.status || 'pending'}"`
    )

    const csvContent = 'data:text/csv;charset=utf-8,' + headers.concat(rows).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Omzet_${reportPeriod.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 5. LOGIKA FILTER TABEL UTAMA
  useEffect(() => {
    let result = [...reservations]

    if (startDate) {
      result = result.filter((item) => item.booking_date >= startDate)
    }
    if (endDate) {
      result = result.filter((item) => item.booking_date <= endDate)
    }
    if (statusFilter !== 'all') {
      result = result.filter((item) => (item.status || 'pending').toLowerCase() === statusFilter.toLowerCase())
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter((item) =>
        item.customer_name?.toLowerCase().includes(term) ||
        item.whatsapp_number?.includes(term) ||
        item.service_name?.toLowerCase().includes(term)
      )
    }

    setFilteredReservations(result)
  }, [startDate, endDate, statusFilter, searchTerm, reservations])

  // Cek Session Auth Supabase
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setIsAuthenticated(true)
      }
    }
    checkSession()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchReservations()
    }
  }, [isAuthenticated])

  // Tampilan Belum Login
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-100">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20 tracking-wider">
              ADMIN DASHBOARD
            </span>
            <h1 className="text-2xl font-black text-white tracking-wide uppercase mt-2">
              M CUT Barbershop
            </h1>
            <p className="text-xs text-zinc-400">Silakan login untuk mengelola sistem reservasi</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email Admin</label>
              <input
                type="email"
                required
                placeholder="admin@mcutbarbershop.com"
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

  // Tampilan Sudah Login
  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 text-zinc-100 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                PANEL UTAMA
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">
                M CUT Barbershop
              </h1>
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
                {stats.totalBookings - stats.cancelledCount} transaksi aktif
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
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                {stats.cancelledPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* --- FITUR PENARIKAN LAPORAN & OMZET --- */}
        <div className="bg-zinc-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
                <span>📊 Penarikan Laporan & Omzet</span>
              </h2>
              <p className="text-xs text-zinc-400">Pilih periode laporan untuk menghitung omzet dan mengunduh file CSV/Excel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Opsi Tipe Laporan */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Tipe Laporan:</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
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

            {/* Input Tanggal / Rentang Berdasarkan Tipe Laporan */}
            {reportPeriod !== 'custom' ? (
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  {reportPeriod === 'daily' && 'Pilih Tanggal:'}
                  {reportPeriod === 'weekly' && 'Pilih Tanggal dalam Minggu Ini:'}
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

                {/* INFO EKSPLISIT RENTANG MINGGUAN */}
                {reportPeriod === 'weekly' && reportData.weekInfo && (
                  <p className="text-[11px] text-amber-400 font-semibold mt-1">
                    📅 Periode: {formatDateID(reportData.weekInfo.startStr)} s/d {formatDateID(reportData.weekInfo.endStr)}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Dari Tanggal:</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Sampai Tanggal:</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </>
            )}

            {/* Box Omzet & Total Transaksi */}
            <div className="md:col-span-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Omzet Periode Ini</p>
                <p className="text-lg font-black text-emerald-400">
                  Rp {reportData.totalRevenue.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Total Transaksi</p>
                <p className="text-sm font-extrabold text-white">{reportData.count} Booking</p>
              </div>
            </div>

            {/* Tombol Export CSV */}
            <div className="md:col-span-2">
              <button
                onClick={exportReportToCSV}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
              >
                <span>📥 Download CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- SEARCH & FILTER TABEL DATA --- */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end w-full lg:w-auto">
            <div className="w-full sm:w-64">
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
                <option value="cancelled">🔴 Cancelled</option>
              </select>
            </div>

            {(startDate || endDate || statusFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setStatusFilter('all')
                  setSearchTerm('')
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-3 py-2 rounded-xl text-xs font-medium transition"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* --- TABEL DATA --- */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs">Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="p-4">Tanggal Booking</th>
                    <th className="p-4">Jam</th>
                    <th className="p-4">Nama Pelanggan</th>
                    <th className="p-4">Layanan</th>
                    <th className="p-4 text-emerald-400">Harga</th>
                    <th className="p-4">Metode Bayar</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {filteredReservations.map((item) => {
                    const currentStatus = item.status || 'pending'
                    const cleanPhone = item.whatsapp_number ? item.whatsapp_number.replace(/^0/, '62') : ''

                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                        <td className="p-4 font-semibold text-zinc-200">{item.booking_date}</td>
                        <td className="p-4 font-mono text-zinc-400">{item.booking_time} WIB</td>
                        <td className="p-4 font-bold text-white">{item.customer_name}</td>
                        <td className="p-4">
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-[11px] font-semibold">
                            {item.service_name}
                          </span>
                        </td>
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
                          <select
                            value={currentStatus}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className={`p-1.5 rounded-lg text-xs font-bold border bg-zinc-950 focus:outline-none cursor-pointer ${
                              currentStatus === 'confirmed'
                                ? 'text-blue-400 border-blue-500/40'
                                : currentStatus === 'completed'
                                ? 'text-emerald-400 border-emerald-500/40'
                                : currentStatus === 'cancelled'
                                ? 'text-red-400 border-red-500/40'
                                : 'text-amber-400 border-amber-500/40'
                            }`}
                          >
                            <option value="pending">🟡 Pending</option>
                            <option value="confirmed">🟢 Confirmed</option>
                            <option value="completed">🔵 Completed</option>
                            <option value="cancelled">🔴 Cancelled</option>
                          </select>
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
    </div>
  )
}