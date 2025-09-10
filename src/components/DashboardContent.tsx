"use client"

import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer } from 'recharts'
import {
  CheckCircle,
  Calendar,
  Heart,
  MapPin,
  Globe,
  MessageSquare,
  Users,
  Star,
  Edit,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  RefreshCw,
  Eye,
  TrendingUp,
  Trash2,
} from "lucide-react"
import api from '@/lib/api'
import metricsService from '@/lib/services/metricsService'
import { MetricCard } from "@/components/MetricCard"
import InlineMetric from '@/components/InlineMetric'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import EntityEditDialog from '@/components/EntityEditDialog'
import { useToast } from '@/hooks/use-toast'
 

// recent events will be loaded from backend /api/events

// upcoming events loaded from backend

// trending tracks derived from /api/tracks

// localization status can be derived from catalog/tracks if available

// participant feedback could come from analytics; keep static fallback

const statusColors = {
  completed: "bg-green-500/20 text-green-400 border-green-500/50",
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  planning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  excellent: "bg-green-500",
  good: "bg-blue-500",
  fair: "bg-yellow-500",
  "needs-attention": "bg-red-500",
}

export function DashboardContent() {
  const navigate = useNavigate()
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [tracks, setTracks] = useState<any[]>([])
  const [catalogHealth, setCatalogHealth] = useState<{ title: string; percent: number }[]>([])
  const [localizedProgress, setLocalizedProgress] = useState<{ title: string; languages: { name: string; percent: number; status: string }[] }[]>([])
  // removed search/filter controls
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [selectedEvent, setSelectedEvent] = useState<Record<string, unknown> | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<any>(null)
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [trendingApi, setTrendingApi] = useState<CarouselApi | null>(null)
  const [trendingTopics, setTrendingTopics] = useState<{ topic: string; description: string }[]>([])
  const [isTrendingDialogOpen, setIsTrendingDialogOpen] = useState(false)
  const [newTrendingTitle, setNewTrendingTitle] = useState("")
  const [newTrendingDesc, setNewTrendingDesc] = useState("")
  const [liveMetrics, setLiveMetrics] = useState({
    completedEvents: 0,
    upcomingEvents: 0,
    activeParticipants: 0,
    avgSatisfaction: 0,
  })

  

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const ev = await api.get('/api/events').then(r => Array.isArray(r.data) ? r.data : [])
        const recent = ev.map((e: any, idx: number) => ({ id: e.id || e.sr || idx+1, name: e.name || e.title || String(e.trackName || ''), type: e.type || 'Technology', status: e.status || 'completed', participants: Number(e.participants || 0), time: e.time || 'recent', rating: Number(e.rating || 0), revenue: Number(e.revenue || 0) }))
        setRecentEvents(recent)

        const upcoming = ev.filter((e: any) => !!(e.upcoming || e.isUpcoming || e.scheduled || (e.status && String(e.status).toLowerCase() === 'confirmed')))
          .map((e: any, idx: number) => ({ id: e.id || e.sr || idx+1, name: e.name || e.title || String(e.trackName || ''), type: e.type || 'Education', date: e.date || e.scheduled || '', expectedParticipants: Number(e.expectedParticipants || 0), status: e.status || 'confirmed', ticketsSold: Number(e.ticketsSold || 0) }))
        setUpcomingEvents(upcoming)

        const tr = await api.get('/api/tracks').then(r => Array.isArray(r.data) ? r.data : [])
        setTracks(tr)
        // derive catalog health from catalog resource
        const catalog = await api.get('/api/catalog').then(r => Array.isArray(r.data) ? r.data : [])
        const localized = catalog.filter((i: any) => i && (i.type === 'localizedTrack' || i.trackTitle || i.trackName))
        const toPercent = (status: string) => {
          const s = String(status || '').toLowerCase()
          if (s === 'available' || s === 'completed') return 100
          if (s === 'in progress' || s === 'in-progress') return 50
          if (s === 'pending' || s === 'not available' || s === 'not-available') return 20
          return 0
        }
        const entries: { title: string; percent: number }[] = []
        const localizedEntries: { title: string; languages: { name: string; percent: number; status: string }[] }[] = []
        localized.forEach((i: any) => {
          const title = i.trackTitle || i.trackName || i.title || 'Track'
          // prefer explicit overall status if present
          const overall = i.status || i.testingStatus || null
          if (overall) {
            entries.push({ title, percent: toPercent(String(overall)) })
          } else {
            // otherwise derive from language fields by taking the MAX status according to mapping
            const statusValues = [i.spanish, i.portuguese]
              .filter(Boolean)
              .map((s: string) => toPercent(s))
            const percent = statusValues.length > 0 ? Math.max(...statusValues) : 0
            entries.push({ title, percent })
          }
          const langs: { name: string; percent: number; status: string }[] = []
          const mapLang = (name: string, value: any) => {
            const normalized = (value === undefined || value === null || String(value).trim() === '') ? 'Not Available' : String(value)
            const p = toPercent(normalized)
            langs.push({ name, percent: p, status: normalized })
          }
          mapLang('Spanish', i.spanish)
          mapLang('Portuguese', i.portuguese)
          localizedEntries.push({ title, languages: langs })
        })
        entries.sort((a, b) => b.percent - a.percent)
        setCatalogHealth(entries.slice(0, 3))
        setLocalizedProgress(localizedEntries.slice(0, 5))

        const completedCount = ev.filter((e: any) => (String(e.status || '')).toLowerCase() === 'completed' || e.completed === true).length
        const upcomingCount = upcoming.length
        const activeParticipants = Array.isArray(tr) ? tr.reduce((acc: number, t: any) => acc + Number(t.participants || 0), 0) : 0
        const avgSatisfaction = recent.length > 0 ? (recent.reduce((a, b) => a + Number(b.rating || 0), 0) / recent.length) : 0
        // Start from derived counts
        let next = {
          completedEvents: completedCount,
          upcomingEvents: upcomingCount,
          activeParticipants,
          avgSatisfaction,
        }
        // Overlay any saved metrics
        try {
          const saved = await metricsService.get()
          if (saved) {
            next = {
              completedEvents: Number(saved['dashboard.completedEvents'] ?? next.completedEvents) || 0,
              upcomingEvents: Number(saved['dashboard.upcomingEvents'] ?? next.upcomingEvents) || 0,
              activeParticipants: Number(saved['dashboard.activeParticipants'] ?? next.activeParticipants) || 0,
              avgSatisfaction: Number(saved['dashboard.avgSatisfaction'] ?? next.avgSatisfaction) || 0,
            }
          }
        } catch {}
        setLiveMetrics(next)
        // Initialize trending topics (localStorage-backed)
        try {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('dashboard.trendingTopics') : null
          if (saved) {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) setTrendingTopics(parsed.slice(0, 6))
          } else {
            const defaults = [
              { topic: "Generative AI & LLMs", description: "Perfect for AI labs" },
              { topic: "Cloud-Native Apps", description: "Modern development" },
              { topic: "Edge Computing & IoT", description: "Practical implementation" },
              { topic: "Cybersecurity & Zero Trust", description: "Security-focused labs" },
              { topic: "DevOps & GitOps", description: "Automation labs" },
              { topic: "Data Analytics & ML Ops", description: "Data science labs" },
            ]
            setTrendingTopics(defaults)
            try { localStorage.setItem('dashboard.trendingTopics', JSON.stringify(defaults)) } catch {}
          }
        } catch {}
      } catch (err) {
        // swallow errors; UI shows whatever data available
      }
    }
    fetchAll()
    // React to saved metrics changes so UI updates immediately
    const onMetricsChanged = () => { (async () => { try { await fetchAll() } catch {} })() }
    const onEventsChanged = () => { (async () => { try { await fetchAll() } catch {} })() }
    const onCatalogChanged = () => { (async () => { try { await fetchAll() } catch {} })() }
    const onVisibility = () => { if (document.visibilityState === 'visible') { (async () => { try { await fetchAll() } catch {} })() } }
    try { window.addEventListener('metrics:changed', onMetricsChanged as EventListener) } catch {}
    window.addEventListener('events:changed', onEventsChanged as EventListener)
    window.addEventListener('catalog:changed', onCatalogChanged as EventListener)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      try { window.removeEventListener('metrics:changed', onMetricsChanged as EventListener) } catch {}
      window.removeEventListener('events:changed', onEventsChanged as EventListener)
      window.removeEventListener('catalog:changed', onCatalogChanged as EventListener)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Auto-rotate trending topics every 5 seconds
  useEffect(() => {
    if (!trendingApi) return
    const interval = setInterval(() => {
      try { trendingApi.scrollNext() } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [trendingApi])

  const filteredRecentEvents = recentEvents
  const filteredUpcomingEvents = upcomingEvents

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      // Trigger a full re-fetch by emitting events:changed and catalog:changed
      try { window.dispatchEvent(new CustomEvent('events:changed')) } catch {}
      try { window.dispatchEvent(new CustomEvent('catalog:changed')) } catch {}
    } finally {
    setIsRefreshing(false)
    }
  }

  // trending tracks and placeholder datasets removed to simplify dashboard
  const handleRemoveTrending = (removeIndex: number) => {
    setTrendingTopics((prev) => {
      const next = prev.filter((_, i) => i !== removeIndex)
      try { localStorage.setItem('dashboard.trendingTopics', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <>
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-8 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col space-y-3">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                MS Innovation Catalogue Management Dashboard
              </h1>
              <p className="text-blue-100 text-xl font-medium">
                Monitor your events, tracks, and participant engagement in real-time.
              </p>
              <div className="flex items-center gap-2 text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Live Dashboard</span>
              </div>
            </div>
            {/* Removed last updated timing per requirements */}
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
      </div>

      {/* Enhanced Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="group transform hover:scale-105 hover:-translate-y-1 transition-all duration-300">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <CheckCircle className="h-8 w-8 text-green-100" />
                <div className="text-right">
                  <p className="text-green-100 text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold">
                    <InlineMetric metricKey="dashboard.completedEvents" value={liveMetrics.completedEvents} />
                  </p>
                </div>
              </div>
              <p className="text-green-100 text-sm font-medium">Events</p>
            </div>
          </div>
        </div>
        
        <div className="group transform hover:scale-105 hover:-translate-y-1 transition-all duration-300">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="h-8 w-8 text-blue-100" />
                <div className="text-right">
                  <p className="text-blue-100 text-sm font-medium">Upcoming</p>
                  <p className="text-2xl font-bold">
                    <InlineMetric metricKey="dashboard.upcomingEvents" value={liveMetrics.upcomingEvents} />
                  </p>
                </div>
              </div>
              <p className="text-blue-100 text-sm font-medium">Events</p>
            </div>
          </div>
        </div>
        
        <div className="group transform hover:scale-105 hover:-translate-y-1 transition-all duration-300">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Users className="h-8 w-8 text-purple-100" />
                <div className="text-right">
                  <p className="text-purple-100 text-sm font-medium">Active</p>
                  <p className="text-2xl font-bold">
                    <InlineMetric metricKey="dashboard.activeParticipants" value={liveMetrics.activeParticipants} />
                  </p>
                </div>
              </div>
              <p className="text-purple-100 text-sm font-medium">Participants</p>
            </div>
          </div>
        </div>
        
        <div className="group transform hover:scale-105 hover:-translate-y-1 transition-all duration-300">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-10 translate-x-10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Star className="h-8 w-8 text-orange-100" />
                <div className="text-right">
                  <p className="text-orange-100 text-sm font-medium">Satisfaction</p>
                  <p className="text-2xl font-bold">
                    <InlineMetric metricKey="dashboard.avgSatisfaction" value={Number(liveMetrics.avgSatisfaction.toFixed(1))} />
                  </p>
                </div>
              </div>
              <p className="text-orange-100 text-sm font-medium">Average Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global edit metrics button removed; inline pencil per metric is used */}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side - Events (stacked for natural height) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Completed Events */}
          <Card onClick={() => navigate('/completed-events')} className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-200/20 dark:border-green-800/20">
              <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Completed Events</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">Recently finished events and their performance</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredRecentEvents
                .slice(0, 7)
                .map((event) => (
                  <div key={event.id} className="relative">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/30 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30 cursor-pointer transition-all duration-200 group hover:shadow-md">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-none group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
                          {event.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-sm">
                          Completed
                        </Badge>
                      </div>
                    </div>
                    {((typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) === 'admin') && (
                      <div className="absolute right-0 top-0">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation?.(); setEditEvent(event); setIsEditDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card onClick={() => navigate('/upcoming-events')} className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b border-blue-200/20 dark:border-blue-800/20">
              <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Upcoming Events</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">Scheduled events and planning status</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredUpcomingEvents
                .slice(0, 6)
                .map((event) => (
                  <div key={event.id} className="relative p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200/50 dark:border-blue-800/30 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/30 dark:hover:to-cyan-900/30 cursor-pointer transition-all duration-200 group hover:shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-none group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                          {event.name}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {event.date} • {event.expectedParticipants} expected
                        </p>
                      </div>
                      <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 shadow-sm">
                        {event.status}
                      </Badge>
                    </div>
                    {((typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) === 'admin') && (
                      <div className="absolute right-0 top-0">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation?.(); setEditEvent(event); setIsEditDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Trending, Catalog Health, Localized Tracks (stacked) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Top 5 Trending Topics */}
          <Card className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 pointer-events-none"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-200/20 dark:border-orange-800/20">
              <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Top 6 Trending Topics</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">Hot tech topics for innovative labs</p>
                  </div>
                </div>
                {((typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) === 'admin') && (
                  <Button size="sm" variant="outline" className="hover:bg-orange-100 dark:hover:bg-orange-900/30" onClick={() => setIsTrendingDialogOpen(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 relative z-10">
              {trendingTopics.map((item, index) => (
                <div key={`${item.topic}-${index}`} className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200/50 dark:border-orange-800/30 hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-900/30 dark:hover:to-red-900/30 transition-all duration-200 group hover:shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors truncate">{item.topic}</span>
                          </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{item.description}</p>
                        </div>
                  {((typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) === 'admin') && (
                    <div className="ml-2 flex-shrink-0">
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => handleRemoveTrending(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                      </div>
                  ))}
            </CardContent>
          </Card>

          {/* Catalog Health */}
          <Card onClick={() => navigate('/catalog-health')} className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-red-500/10 to-pink-500/10 border-b border-red-200/20 dark:border-red-800/20">
              <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 text-white">
                  <Heart className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Catalog Health</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">Overall health metrics of your event catalog</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {catalogHealth.map((metric, index) => {
                const color = metric.percent >= 100 ? 'bg-green-500' : metric.percent >= 50 ? 'bg-yellow-500' : metric.percent > 0 ? 'bg-orange-500' : 'bg-red-500'
                return (
                  <div key={index} className="space-y-2 group cursor-pointer" onClick={() => navigate('/catalog-health')}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors truncate">
                        {metric.title}
                      </span>
                      <span className="font-medium group-hover:text-primary transition-colors">{metric.percent}%</span>
                    </div>
                    <div className="relative">
                      <Progress value={metric.percent} className="h-1.5" />
                      <div className={`absolute top-0 left-0 h-1.5 rounded-full ${color}`} style={{ width: `${metric.percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Localized Tracks (compact under Catalog Health) */}
          <Card onClick={() => navigate('/localized-tracks')} className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shadow-xl cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-teal-500/5"></div>
            <CardHeader className="relative z-10 bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-b border-cyan-200/20 dark:border-cyan-800/20 py-4">
              <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
                  <Globe className="h-5 w-5" />
                </div>
                <span>Localized Tracks</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 py-4">
              {localizedProgress.slice(0, 2).map((t, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-900/20 dark:to-teal-900/20 border border-cyan-200/50 dark:border-cyan-800/30">
                  <div className="text-sm font-semibold mb-2 text-slate-800 dark:text-slate-100">{t.title}</div>
                  <div className="space-y-2">
                    {t.languages.map((l, i) => {
                      const color = l.percent >= 100 ? 'from-green-500 to-emerald-500' : l.percent >= 50 ? 'from-yellow-500 to-orange-500' : 'from-red-500 to-pink-500'
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">{l.name}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{l.percent}%</span>
                          </div>
                          <div className="relative">
                            <Progress value={l.percent} className="h-1.5 bg-slate-200 dark:bg-slate-700" />
                            <div className={`absolute top-0 left-0 h-1.5 rounded-full bg-gradient-to-r ${color}`} style={{ width: `${l.percent}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Bottom section removed per layout update */}
    </div>
    {/* Admin-only: Add Trending Topic dialog */}
    {((typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) === 'admin') && (
      <EntityEditDialog
        open={isTrendingDialogOpen}
        onOpenChange={(v) => { setIsTrendingDialogOpen(v) }}
        title={'Add Trending Topic'}
        saving={false}
        onSave={async () => {
          const title = String(newTrendingTitle || '').trim()
          const desc = String(newTrendingDesc || '').trim()
          if (!title || title.length < 3) throw new Error('Topic title is required (min 3 chars)')
          setTrendingTopics(prev => {
            const next = [{ topic: title, description: desc }, ...prev].slice(0, 6)
            try { localStorage.setItem('dashboard.trendingTopics', JSON.stringify(next)) } catch {}
            return next
          })
          setNewTrendingTitle('')
          setNewTrendingDesc('')
        }}
      >
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right">Topic</label>
            <Input className="col-span-3" value={newTrendingTitle} onChange={(e) => setNewTrendingTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right">Description</label>
            <Input className="col-span-3" value={newTrendingDesc} onChange={(e) => setNewTrendingDesc(e.target.value)} />
          </div>
        </div>
      </EntityEditDialog>
    )}
    {/* Shared edit dialog for events */}
    <EntityEditDialog
      open={isEditDialogOpen}
      onOpenChange={(v) => { if (!v) setEditEvent(null); setIsEditDialogOpen(v) }}
      title={editEvent ? `Edit Event: ${String(editEvent.name || editEvent.title || '')}` : 'Edit Event'}
      saving={false}
      onSave={async () => {
        if (!editEvent) throw new Error('No event to save')
        // basic validation
        const title = String(editEvent.name || editEvent.title || '')
        if (!title || title.trim().length < 3) throw new Error('Title is required (min 3 chars)')
        const payload: any = {}
        // map known fields
        if (editEvent.name) payload.name = editEvent.name
        if (editEvent.title) payload.title = editEvent.title
        if (editEvent.date) payload.date = editEvent.date
        if (editEvent.expectedParticipants) payload.expectedParticipants = editEvent.expectedParticipants
        // persist
        if (editEvent.id && Number(editEvent.id) > 0) {
          await api.put(`/api/events/${String(editEvent.id)}`, payload)
          // update local state
          setRecentEvents(prev => prev.map(r => r.id === editEvent.id ? { ...r, ...editEvent } : r))
          setUpcomingEvents(prev => prev.map(r => r.id === editEvent.id ? { ...r, ...editEvent } : r))
        } else {
          const res = await api.post('/api/events', payload)
          const newId = Number(res.data.item && (res.data.item.sr || res.data.item.id) || Date.now())
          setUpcomingEvents(prev => [...prev, { ...editEvent, id: newId }])
        }
        toast({ title: 'Saved', description: 'Event saved' })
      }}
    >
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-4 items-center gap-4">
          <label className="text-right">Title</label>
          <Input className="col-span-3" value={String(editEvent?.name || editEvent?.title || '')} onChange={(e) => setEditEvent((prev: any) => ({ ...prev, name: e.target.value, title: e.target.value }))} />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <label className="text-right">Date</label>
          <Input className="col-span-3" value={String(editEvent?.date || '')} onChange={(e) => setEditEvent((prev: any) => ({ ...prev, date: e.target.value }))} />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <label className="text-right">Expected Participants</label>
          <Input type="number" className="col-span-3" value={String(editEvent?.expectedParticipants || '')} onChange={(e) => setEditEvent((prev: any) => ({ ...prev, expectedParticipants: Number(e.target.value) }))} />
        </div>
      </div>
    </EntityEditDialog>
    </>
  )
}

