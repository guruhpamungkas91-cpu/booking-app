'use client'

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
  status: string
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)

  // GANTI PASSWORD ADMIN DI SINI (bebas kamu atur)
  const ADMIN_PASSWORD = 'adminrahasia123'

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_auth', 'true')
    } else {
      alert('Password salah, bro!')
    }
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

  useEffect(() => {
    const isAuth = sessionStorage.getItem('admin_auth')
    if (isAuth === 'true') {
      setIsAuthenticated(true)
    }
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
              <label className="block text-sm font-medium text-gray-700">Password Admin</label>
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
            >
              Masuk Dashboard
            </button>
          </form>
        </div>
      </main>
    )
  }

  // TAMPILAN JIKA SUDAH LOGIN
  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-800">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Admin Reservasi</h1>
            <p className="text-sm text-gray-500">Kelola dan pantau pesanan masuk secara real-time</p>
          </div>
          <div className="space-x-3">
            <button
              onClick={fetchReservations}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Refresh Data
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem('admin_auth')
                setIsAuthenticated(false)
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data reservasi...</div>
          ) : reservations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Belum ada reservasi masuk.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="p-4">Tanggal Booking</th>
                    <th className="p-4">Jam</th>
                    <th className="p-4">Nama Pelanggan</th>
                    <th className="p-4">Layanan</th>
                    <th className="p-4">WhatsApp</th>
                    <th className="p-4">Aksi / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {reservations.map((item) => (
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