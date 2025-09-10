import React from 'react'

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const role = typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null
  if (role !== 'admin') return null
  return <>{children}</>
}

export default AdminOnly
