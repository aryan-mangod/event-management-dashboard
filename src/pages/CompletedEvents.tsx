import { DashboardLayout } from "@/components/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/MetricCard"
import { Button } from "@/components/ui/button"
import { TrendingUp, Users, Eye, MousePointer, Clock, Target, BookOpen, Calendar, Globe, Award, Plus } from "lucide-react"
import { UserAnalyticsChart } from "@/components/charts/UserAnalyticsChart"
import { PerformanceChart } from "@/components/charts/PerformanceChart"
import { FileUploadModal } from "@/components/FileUploadModal"
import api from "@/lib/api"
import eventsService from '@/lib/services/eventsService'
import { useState, useEffect, useMemo, useRef } from "react"
import InlineMetric from '@/components/InlineMetric'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash2 } from "lucide-react"
import MetricsEditor from '@/components/MetricsEditor'

export default function CompletedEvents() {
  // role is determined by real auth (App sets localStorage.dashboard_role on login)
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
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.trackTitle || '', language: e.language || 'English' })))
      } catch (err) {
        // ignore
      }
    })()
    const onChanged = () => {
      ;(async () => {
        const list = await eventsService.list()
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.trackTitle || '', language: e.language || 'English' })))
      })()
    }
    window.addEventListener('events:changed', onChanged as EventListener)
    // listen for metric changes so the KPIs refresh when edited elsewhere
    const onMetricsChanged = (ev: any) => {
      setMetrics(ev && ev.detail ? ev.detail : null)
    }
    window.addEventListener('metrics:changed', onMetricsChanged as EventListener)
    return () => { mounted = false; window.removeEventListener('events:changed', onChanged as EventListener); window.removeEventListener('metrics:changed', onMetricsChanged as EventListener) }
  }, [])

  // fetch metrics exposed by backend (imported from WordPress snippet)
  const [metrics, setMetrics] = useState<any>(null)
  const [isMetricsOpen, setIsMetricsOpen] = useState(false)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
    const res = await api.get('/api/data')
    if (!mounted) return
    setMetrics(res.data && res.data.metrics ? res.data.metrics : null)
      } catch (err) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  // derive KPIs and language breakdown from real events
  const derived = useMemo(() => {
    const completed = events.filter((e: any) => String((e as any).status || '').toLowerCase() === 'completed' || (e as any).upcoming === false)
    const tech = events.filter((e: any) => String((e as any).type || '').toLowerCase() === 'technology')
    const nonTech = events.filter((e: any) => (e as any).type && String((e as any).type).toLowerCase() !== 'technology')
    const languages = Array.from(new Set(events.map((e) => (e as any).language || 'English')))
    const languageCounts = languages.map((lang) => ({
      language: lang,
      count: events.filter((e) => ((e as any).language || 'English') === lang).length,
    }))
    const maxLangCount = languageCounts.reduce((m, it) => Math.max(m, it.count), 0) || 1
    return {
      tracksDelivered: completed.length,
      techEvents: tech.length,
      nonTechEvents: nonTech.length,
      languagesCovered: languages.length,
      languageCounts,
      maxLangCount,
    }
  }, [events])

  const openEdit = (item: { id: number; title: string; language: string } | null) => {
    setEditing(item)
    setIsEditOpen(true)
  }

  const saveEdit = () => {
    if (!editing) return
    // validation
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
        // refresh events from server
        const listRes = await api.get('/api/events')
        const list = Array.isArray(listRes.data) ? listRes.data : []
        setEvents(list.map((e: any) => ({ id: Number(e.sr || e.id || 0), title: e.title || e.trackTitle || '', language: e.language || 'English' })))
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
            <h1 className="text-3xl font-bold text-foreground">Completed Events</h1>
            <p className="text-muted-foreground">
              Comprehensive overview of completed training events and delivery insights
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
              {/* Removed Edit Metrics button */}
          </div>
          {csvError && <div className="text-red-500 text-sm">{csvError}</div>}
        </div>

        {/* Summary KPIs (derived) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Tracks Delivered"
            value={<InlineMetric metricKey="completed.tracksDelivered" value={derived.tracksDelivered} />}
            change="Total training tracks completed"
            changeType="neutral"
            icon={BookOpen}
          />
          <MetricCard
            title="Tech Events"
            value={<InlineMetric metricKey="completed.techEvents" value={derived.techEvents} />}
            change="Technology-focused sessions"
            changeType="neutral"
            icon={Target}
          />
          <MetricCard
            title="Non-Tech Events"
            value={<InlineMetric metricKey="completed.nonTechEvents" value={derived.nonTechEvents} />}
            change="Non-technical training sessions"
            changeType="neutral"
            icon={Calendar}
          />
          <MetricCard
            title="Languages Covered"
            value={<InlineMetric metricKey="completed.languagesCovered" value={derived.languagesCovered} />}
            change="Distinct languages across events"
            changeType="neutral"
            icon={Globe}
          />
        </div>

        {/* Language Breakdown */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Language Breakdown
            </CardTitle>
            <CardDescription>
              Distribution of training sessions by language
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {derived.languageCounts.map((lc, idx) => {
                const pct = Math.round((lc.count / derived.maxLangCount) * 100)
                const color = idx % 2 === 0 ? 'bg-green-500' : 'bg-orange-500'
                return (
                  <div key={lc.language} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${color}`}></div>
                      <span className="font-medium">{lc.language}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-full bg-secondary rounded-full h-2 max-w-[200px]">
                        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                      <span className="font-medium text-primary min-w-[2rem]">{lc.count}</span>
                </div>
              </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
  <MetricsEditor open={isMetricsOpen} onOpenChange={setIsMetricsOpen} onSaved={(m) => setMetrics(m)} />

        {/* Top Delivered Track */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Top Delivered Track
            </CardTitle>
            <CardDescription>
              Most popular training tracks by session count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map(ev => (
                <div key={ev.id} className="p-4 bg-purple-600 rounded-lg text-white flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{ev.title}</h3>
                    <p className="text-purple-100">Language: {ev.language}</p>
                  </div>
                  {role === 'admin' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(ev)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(ev.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Edit Dialog for events */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
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