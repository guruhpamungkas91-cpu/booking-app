import React from 'react'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-layout-container">
      <main>{children}</main>
    </div>
  )
}