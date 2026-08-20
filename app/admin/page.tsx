import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Trash2, 
  Search, 
  Filter 
} from 'lucide-react';

export default function ReservationAdmin({ 
  reservations = [], 
  handleStatusChange, 
  handleDelete 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 1. Kalkulasi Statistik & Catatan Mingguan (Analytics)
  const stats = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter(r => r.status === 'pending').length;
    const confirmed = reservations.filter(r => r.status === 'confirmed').length;
    const completed = reservations.filter(r => r.status === 'completed').length;
    const cancelled = reservations.filter(r => r.status === 'cancelled').length;

    // Filter reservasi masuk dalam 7 hari terakhir (Minggu ini)
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const thisWeekReservations = reservations.filter(item => {
      const createdDate = new Date(item.created_at || item.booking_date);
      return createdDate >= sevenDaysAgo;
    });

    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      thisWeekCount: thisWeekReservations.length
    };
  }, [reservations]);

  // 2. Filter & Search Data Reservasi
  const filteredReservations = useMemo(() => {
    return reservations.filter(item => {
      const matchSearch = 
        item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customer_phone?.includes(searchTerm) ||
        item.service?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [reservations, searchTerm, statusFilter]);

  // Visual Bar Helper untuk Mini Chart Minggu Ini
  const maxWeeklyTarget = Math.max(stats.thisWeekCount, 10);
  const weeklyPercentage = Math.min(Math.round((stats.thisWeekCount / maxWeeklyTarget) * 100), 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Calendar className="w-8 h-8 text-indigo-500" />
              Dashboard Reservasi
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Kelola jadwal booking masuk dari WhatsApp & Google Bisnis
            </p>
          </div>
        </div>

        {/* --- STATS & CHART WIDGET SECTION --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card: Total Reservasi Minggu Ini */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Masuk Minggu Ini
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.thisWeekCount} <span className="text-xs text-slate-400 font-normal">reservasi</span>
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            {/* Visual Mini Chart Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress Mingguan</span>
                <span>{weeklyPercentage}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${weeklyPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card: Pending / Menunggu Konfirmasi */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Menunggu (Pending)
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.pending}
                </h3>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">Perlu konfirmasi admin segera</p>
          </div>

          {/* Card: Dikonfirmasi */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Dikonfirmasi / Selesai
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.confirmed + stats.completed}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Confirmed: {stats.confirmed} | Selesai: {stats.completed}
            </p>
          </div>

          {/* Card: Total Keseluruhan */}
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Semua Reservasi
                </p>
                <h3 className="text-3xl font-extrabold text-white mt-2">
                  {stats.total}
                </h3>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl text-slate-300">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Batal: {stats.cancelled}
            </p>
          </div>

        </div>

        {/* --- FILTER & SEARCH BAR --- */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama, WA, atau layanan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition w-full md:w-auto"
            >
              <option value="all">Semua Status</option>
              <option value="pending">🟡 Pending</option>
              <option value="confirmed">🟢 Confirmed</option>
              <option value="completed">🔵 Completed</option>
              <option value="cancelled">🔴 Cancelled</option>
            </select>
          </div>
        </div>

        {/* --- TABLE SECTION (DENGAN FUNGSI LAMA KAMU) --- */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Belum ada data reservasi yang sesuai.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider bg-slate-950/50">
                    <th className="p-4">Pelanggan</th>
                    <th className="p-4">No. WhatsApp</th>
                    <th className="p-4">Layanan</th>
                    <th className="p-4">Tanggal & Jam</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {filteredReservations.map((item) => {
                    // Penentuan warna badge status
                    let statusBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    if (item.status === 'confirmed') statusBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    if (item.status === 'completed') statusBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (item.status === 'cancelled') statusBg = "bg-red-500/10 text-red-400 border-red-500/20";

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-semibold text-white">
                          {item.customer_name}
                        </td>
                        <td className="p-4 text-slate-400 font-mono text-xs">
                          {item.customer_phone || '-'}
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-medium">
                            {item.service}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300">
                          {item.booking_date} {item.booking_time && `• ${item.booking_time}`}
                        </td>
                        
                        {/* SELECT STATUS (FUNGSI UTAMA LAMA) */}
                        <td className="p-4 text-center">
                          <select
                            value={item.status}
                            onChange={(e) => handleStatusChange(item.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border focus:outline-none transition cursor-pointer ${statusBg}`}
                          >
                            <option value="pending" className="bg-slate-900 text-slate-200">🟡 Pending</option>
                            <option value="confirmed" className="bg-slate-900 text-slate-200">🟢 Confirmed</option>
                            <option value="completed" className="bg-slate-900 text-slate-200">🔵 Completed</option>
                            <option value="cancelled" className="bg-slate-900 text-slate-200">🔴 Cancelled</option>
                          </select>
                        </td>

                        {/* BUTTON DELETE (FUNGSI UTAMA LAMA) */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDelete(item.id, item.customer_name)}
                            className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 p-2 rounded-xl border border-red-500/20 transition flex items-center justify-center gap-1 mx-auto text-xs font-semibold"
                            title="Hapus Reservasi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}