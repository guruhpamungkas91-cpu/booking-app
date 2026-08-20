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
  
  // State untuk Login Supabase Auth
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  // State untuk Filter & Search
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // LOGIN MENGGUNAKAN SUPABASE AUTH
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

  // LOGOUT SUPABASE AUTH
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

  // FITUR HAPUS DATA RESERVASI
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

  // 1. KALKULASI STATISTIK (ANALYTICS)
    const stats = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7))

    // 1. Total seluruh reservasi di database
    const totalBookings = bookings.length

    // 2. Total pending murni (SEMUA yang pending tanpa batasan tanggal)
    const pendingCount = bookings.filter((b) => b.status === 'pending').length

    // 3. Total confirmed & completed
    const activeConfirmedCount = bookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed'
    ).length

    // 4. Masuk 7 hari terakhir (Berdasarkan booking_date atau created_at)
    const last7DaysCount = bookings.filter((b) => {
      const dateToCheck = new Date(b.created_at || b.booking_date)
      return dateToCheck >= sevenDaysAgo
    }).length

    return {
    totalBookings,
    pendingCount,
    activeConfirmedCount,
    last7DaysCount,
    }
  }, [reservations])

  // Progress Bar Helper untuk Statistik Mingguan
  const maxWeeklyTarget = Math.max(stats.thisWeekCount, 10)
  const weeklyPercentage = Math.min(Math.round((stats.thisWeekCount / maxWeeklyTarget) * 100), 100)

  // 2. LOGIKA FITUR FILTER (TANGGAL, SEARCH, & STATUS)
  useEffect(() => {
    let result = reservations

    if (startDate) {
      result = result.filter((item) => item.booking_date >= startDate)
    }
    if (endDate) {
      result = result.filter((item) => item.booking_date <= endDate)
    }
    if (statusFilter !== 'all') {
      result = result.filter((item) => (item.status || 'pending') === statusFilter)
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

  // LOGIKA FITUR EXPORT TO CSV / EXCEL
  const exportToCSV = () => {
    if (filteredReservations.length === 0) {
      alert('Tidak ada data untuk diexport!')
      return
    }

    const headers = ['Tanggal Booking,Jam,Nama Pelanggan,Layanan,Metode Bayar,WhatsApp,Status\n']
    const rows = filteredReservations.map(
      (item) =>
        `"${item.booking_date}","${item.booking_time}","${item.customer_name}","${item.service_name}","${item.payment_method || 'QRIS'}","${item.whatsapp_number}","${item.status || 'pending'}"`
    )

    const csvContent = 'data:text/csv;charset=utf-8,' + headers.concat(rows).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `reservasi_export_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CEK SESSION AKTIF DARI SUPABASE
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

  // TAMPILAN JIKA BELUM LOGIN
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

  // TAMPILAN JIKA SUDAH LOGIN
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

        {/* --- STATISTIK & ANALYTICS WIDGET --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Masuk Minggu Ini */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Masuk Minggu Ini
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.thisWeekCount} <span className="text-xs text-zinc-400 font-normal">booking</span>
                </h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                📈
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>Progress Mingguan</span>
                <span>{weeklyPercentage}%</span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                <div 
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${weeklyPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card 2: Pending */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Menunggu (Pending)
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.pending}
                </h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                ⏳
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-4">Perlu konfirmasi admin segera</p>
          </div>

          {/* Card 3: Confirmed & Completed */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Dikonfirmasi / Selesai
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.confirmed + stats.completed}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                ✅
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-4">
              Confirmed: {stats.confirmed} | Selesai: {stats.completed}
            </p>
          </div>

          {/* Card 4: Total Keseluruhan */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Total Semua Reservasi
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.total}
                </h3>
              </div>
              <div className="p-2.5 bg-zinc-800 rounded-xl text-zinc-300 border border-zinc-700">
                👥
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-4">
              Batal: {stats.cancelled}
            </p>
          </div>

        </div>

        {/* --- CONTROL BOX (FILTER & SEARCH BAR) --- */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-3 items-end w-full lg:w-auto">
            {/* Search Input */}
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Pencarian:</label>
              <input
                type="text"
                placeholder="Cari nama, WA, atau layanan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter Status */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Status:</label>
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

            {/* Filter Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Dari Tanggal:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Sampai Tanggal:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              />
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

          <button
            onClick={exportToCSV}
            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/30 px-4 py-2 rounded-xl font-bold transition text-xs flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <span>📥 Export Excel (CSV)</span>
          </button>
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
                    <th className="p-4">Metode Bayar</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {filteredReservations.map((item) => {
                    const currentStatus = item.status || 'pending'
                    const cleanPhone = item.whatsapp_number.replace(/^0/, '62')

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
                                ? 'text-emerald-400 border-emerald-500/40'
                                : currentStatus === 'completed'
                                ? 'text-blue-400 border-blue-500/40'
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