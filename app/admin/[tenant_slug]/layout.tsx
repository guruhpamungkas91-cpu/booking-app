import React from 'react'

// Pastikan ada 'export default' dan mengembalikan JSX
export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { tenant_slug: string }
}) {
  return (
    <div className="admin-layout-container">
      {/* Sidebar atau Header admin bisa ditaruh di sini */}
      <main>{children}</main>
    </div>
  )
}