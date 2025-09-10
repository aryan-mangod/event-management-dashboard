import { DashboardLayout } from "@/components/DashboardLayout"
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { FileUploadModal } from "@/components/FileUploadModal"
// Simplified: upload-only screen for feedback screenshots

export default function ParticipantFeedbackPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null
  const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    ;(async () => {
      try {
        const base = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'
        const res = await fetch(`${base}/api/data`)
        const data = await res.json()
        const reviews = Array.isArray(data.reviews) ? data.reviews : []
        setItems(reviews)
      } catch (e) { }
    })()
    const onChanged = (e: any) => {
      if (e && e.detail) setItems(e.detail)
    }
    window.addEventListener('reviews:changed', onChanged as EventListener)
    return () => window.removeEventListener('reviews:changed', onChanged as EventListener)
  }, [])
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Reviews</h1>
            <p className="text-muted-foreground">Upload screenshots of feedbacks received</p>
          </div>
          {role === 'admin' && (
            <FileUploadModal
              trigger={
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Upload File
                </Button>
              }
              accept=".png,.jpg,.jpeg"
              uploadTo="/api/upload-review"
            />
          )}
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="border rounded-md p-3 bg-card/50">
              <div className="text-sm text-muted-foreground mb-2">{it.originalName}</div>
              {String(it.mime || '').startsWith('image/') ? (
                <img src={`${(import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'}${it.path}`} alt={it.originalName} className="w-full h-48 object-cover rounded" />
              ) : (
                <a href={`${(import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000'}${it.path}`} target="_blank" className="text-primary text-sm underline">Open file</a>
              )}
            </div>
            ))}
          </div>
      </div>
    </DashboardLayout>
  )
}