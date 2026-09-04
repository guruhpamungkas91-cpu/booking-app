import React from 'react'

// Pastikan ada 'export default' dan mengembalikan JSX
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant_slug: string }>; // <--- UBAH JADI PROMISE
}) {
  // Jika kamu butuh memakai nilai tenant_slug di dalam layout, wajib di-await dulu:
  // const resolvedParams = await params;
  // const slug = resolvedParams.tenant_slug;

  return (
    <div className="admin-layout-container">
      {/* Sidebar atau Header admin bisa ditaruh di sini */}
      <main>{children}</main>
    </div>
  )
}