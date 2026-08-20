'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
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

  // State untuk Filter Tanggal
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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

  // LOGIKA FITUR FILTER TANGGAL
  useEffect(() => {
    let result = reservations

    if (startDate) {
      result = result.filter((item) => item.booking_date >= startDate)
    }
    if (endDate) {
      result = result.filter((item) => item.booking_date <= endDate)
    }

    setFilteredReservations(result)
  }, [startDate, endDate, reservations])

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
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-800 text-center">
            🔒 Login Admin Dashboard
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Admin</label>
              <input
                type="email"
                required
                placeholder="Masukkan email..."
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                required
                placeholder="Masukkan password..."
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-gray-800"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition disabled:bg-gray-400"
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-gray-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm gap-4">
          <div>
            <h1 className="text-2xl font-bold">M CUT BARBERSHOP</h1>
            <p className="text-sm text-gray-500">Kelola dan pantau pesanan masuk secara real-time</p>
          </div>
          <div className="space-x-3 w-full md:w-auto flex justify-end">
            <button
              onClick={fetchReservations}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              Refresh Data
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Control Box */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dari Tanggal:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sampai Tanggal:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                Reset Filter
              </button>
            )}
          </div>

          <button
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm flex items-center gap-2"
          >
            📥 Export Excel (CSV)
          </button>
        </div>

        {/* Tabel Data */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data reservasi...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Belum ada reservasi masuk / sesuai filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
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
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredReservations.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{item.booking_date}</td>
                      <td className="p-4">{item.booking_time}</td>
                      <td className="p-4 font-semibold">{item.customer_name}</td>
                      <td className="p-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-medium">
                          {item.service_name}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs font-medium">
                          {item.payment_method || 'QRIS'}
                        </span>
                      </td>
                      <td className="p-4">
                        <a
                          href={`https://wa.me/${item.whatsapp_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline font-medium"
                        >
                          {item.whatsapp_number}
                        </a>
                      </td>
                      <td className="p-4">
                        <select
                          value={item.status || 'pending'}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          className="p-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
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
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 transition"
                        >
                          🗑️ Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}