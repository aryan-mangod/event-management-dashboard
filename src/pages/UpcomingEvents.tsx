import { DashboardLayout } from "@/components/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/MetricCard"
import { Button } from "@/components/ui/button"
import { Calendar, Plus } from "lucide-react"
import { RevenueChart } from "@/components/charts/RevenueChart"
import { FileUploadModal } from "@/components/FileUploadModal"
import api from "@/lib/api"
import eventsService from '@/lib/services/eventsService'
import { useState, useEffect, useRef } from "react"
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash2 } from "lucide-react"
import InlineMetric from '@/components/InlineMetric'

export default function UpcomingEvents() {
  // role determined by auth; rely on localStorage set by login flow
  const role = typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvError, setCsvError] = useState("")
  const [events, setEvents] = useState<{ id: number; title: string; language: string }[]>([])
  const [editing, setEditing] = useState<{ id: number; title: string; language: string } | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const list = await eventsService.list()
        if (!mounted) return
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.Title || e.trackTitle || e.name || e.Name || '', language: e.language || e.Language || 'English' })))
      } catch (err) {
        // ignore
      }
    })()
    const onChanged = () => {
      ;(async () => {
        const list = await eventsService.list()
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.Title || e.trackTitle || e.name || e.Name || '', language: e.language || e.Language || 'English' })))
      })()
    }
    window.addEventListener('events:changed', onChanged as EventListener)
    return () => { mounted = false; window.removeEventListener('events:changed', onChanged as EventListener) }
  }, [])

  const openEdit = (item: { id: number; title: string; language: string } | null) => {
    setEditing(item)
    setIsEditOpen(true)
  }

  const saveEdit = () => {
    if (!editing) return
    if (!editing.title || editing.title.trim().length < 3) {
      toast({ title: 'Validation', description: 'Title is required (min 3 chars)', variant: 'destructive' })
      return
    }
    ;(async () => {
      try {
        const payload = { title: editing.title, language: editing.language }
        if (editing.id && editing.id > 0) {
          await eventsService.update(editing.id, payload)
          setEvents(prev => prev.map(e => e.id === editing.id ? { ...e, ...editing } : e))
        } else {
          const item = await eventsService.create(payload)
          const newId = Number(item && (item.sr || item.id) || Date.now())
          setEvents(prev => [...prev, { ...editing, id: newId }])
        }
        setIsEditOpen(false)
        setEditing(null)
        toast({ title: 'Saved', description: 'Event saved' })
      } catch (err) {
        toast({ title: 'Save failed', description: 'Could not save event', variant: 'destructive' })
      }
    })()
  }

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete event?')) return
    ;(async () => {
      try {
        await eventsService.remove(id)
        setEvents(prev => prev.filter(e => e.id !== id))
        toast({ title: 'Deleted', description: 'Event deleted' })
      } catch (err) {
        toast({ title: 'Delete failed', description: 'Could not delete event', variant: 'destructive' })
      }
    })()
  }

  // Bulk CSV upload
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("")
    setCsvUploading(true)
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    try {
  const res = await api.post(`/api/upload-csv?resource=events`, formData, { headers: { "Content-Type": "multipart/form-data" } })
      if (res.data && Array.isArray(res.data.tracks)) {
        const listRes = await api.get('/api/events')
        const list = Array.isArray(listRes.data) ? listRes.data : []
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.Title || e.trackTitle || e.name || e.Name || '', language: e.language || e.Language || 'English' })))
      }
    } catch (err) {
      setCsvError("Failed to upload CSV")
    }
    setCsvUploading(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Upcoming Events</h1>
            <p className="text-muted-foreground">
              Upcoming events and language coverage
            </p>
          </div>
          <div className="flex gap-2">
            {role === 'admin' && (
              <>
                <Button size="sm" className="flex items-center gap-2" onClick={() => openEdit({ id: 0, title: '', language: 'English' })}>
                  <Plus className="h-4 w-4" />
                  Add Track
                </Button>
                <Button size="sm" variant="outline" disabled={csvUploading} onClick={() => fileInputRef.current?.click()}>
                  Bulk Upload (.csv)
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCsvUpload} />
              </>
            )}
            {/* No global edit metrics button; inline edits only */}
          </div>
          {csvError && <div className="text-red-500 text-sm">{csvError}</div>}
        </div>

        {/* Upcoming Events Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Events
            </CardTitle>
            <CardDescription>
              Track upcoming events and language coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Upcoming Events Counter */}
              <div className="text-center p-6 bg-muted/50 rounded-lg border-l-4 border-primary">
                <h3 className="text-lg font-semibold text-primary mb-2">Upcoming Events</h3>
                <div className="text-4xl font-bold text-foreground mb-1">
                  <InlineMetric metricKey="upcoming.count" value={events.length} />
                </div>
                <p className="text-sm text-muted-foreground">Tracks Upcoming</p>
              </div>
              
              {/* Language Coverage */}
              <div>
                <h4 className="text-lg font-semibold text-primary mb-4">Upcoming Language Coverage</h4>
                <div className="space-y-3">
                  {events.map(ev => (
                    <div key={ev.id} className="flex items-center justify-between">
                      <span className="font-medium">{ev.title}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="w-full h-full bg-green-500 rounded-full"></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{ev.language}</span>
                          {role === 'admin' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(ev)}><Edit className="h-4 w-4"/></Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(ev.id)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Upcoming Event</DialogTitle>
              <DialogDescription>Modify event title and language</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="eventTitle" className="text-right">Title</Label>
                <Input id="eventTitle" value={editing?.title || ''} onChange={(e) => editing && setEditing({ ...editing, title: e.target.value })} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="eventLang" className="text-right">Language</Label>
                <Select value={editing?.language || ''} onValueChange={(v) => editing && setEditing({ ...editing, language: v })}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="Portuguese">Portuguese</SelectItem>
                    <SelectItem value="Simplified Chinese">Simplified Chinese</SelectItem>
                    <SelectItem value="Traditional Chinese">Traditional Chinese</SelectItem>
                    <SelectItem value="Japanese">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}