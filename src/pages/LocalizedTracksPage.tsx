import { DashboardLayout } from "@/components/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, CheckCircle, Plus, Edit, Trash2 } from "lucide-react"
import { FileUploadModal } from "@/components/FileUploadModal"
import EntityEditDialog from '@/components/EntityEditDialog'
import catalogService from '@/lib/services/catalogService'
import { isNonEmptyString } from '@/lib/validation'
import { useState, useEffect } from "react"
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'

interface LocalizedTrack {
  trackTitle: string
  spanish: string
  portuguese: string
  sr?: number
}

const initialLocalizedTracksData: LocalizedTrack[] = [
  { trackTitle: "GitHub Copilot Innovation Workshop", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Build Intelligent Apps with Microsoft's Copilot Stack & Azure OpenAI", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Get Started with OpenAI and Build Natural Language Solution", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Cloud Native Applications", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Use Azure OpenAI Like A Pro to Build Powerful AI Applications", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Intelligent App Development with Microsoft Copilot Stack", spanish: "Available", portuguese: "Available" },
  { trackTitle: "GitHub Copilot – Hackathon", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Introduction To Building AI Apps", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Activate GenAI with Azure", spanish: "Available", portuguese: "Available" },
  { trackTitle: "Low-Code for Pro-Dev in a Day", spanish: "Available", portuguese: "Available" }
]

const getAvailabilityBadge = (status: string) => {
  if (status === "Available") {
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Available
      </Badge>
    )
  }
  return <Badge variant="secondary">{status}</Badge>
}

export default function LocalizedTracksPage() {
  const role = typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null
  const [localizedTracksData, setLocalizedTracksData] = useState<LocalizedTrack[]>(initialLocalizedTracksData)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<LocalizedTrack>({
    trackTitle: "",
    spanish: "",
    portuguese: ""
  })
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get('/api/catalog')
        if (!mounted) return
        const items = Array.isArray(res.data) ? res.data : []
        const localized = items.filter((i: any) => i.type === 'localizedTrack')
        if (localized.length > 0) {
          setLocalizedTracksData(localized.map((i: any) => ({
          sr: Number(i.sr || i.id || 0),
          trackTitle: i.trackTitle || i.title || '',
          spanish: i.spanish || 'Not Available',
          portuguese: i.portuguese || 'Not Available'
          })))
        }
      } catch (err) {
        // ignore load errors for now
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditFormData(localizedTracksData[index])
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      if (!isNonEmptyString(editFormData.trackTitle, 3)) {
        toast({ title: 'Validation', description: 'Track title is required (min 3 chars)', variant: 'destructive' })
        return
      }
      setSaving(true)
      ;(async () => {
        try {
          const payload = { ...editFormData, type: 'localizedTrack' }
          if (editFormData.sr && editFormData.sr > 0) {
            await catalogService.update(editFormData.sr, payload)
          } else {
            const item = await catalogService.create(payload)
            if (item) editFormData.sr = Number(item.sr || item.id || 0)
          }
          const updatedData = [...localizedTracksData]
          updatedData[editingIndex] = { ...editFormData }
          setLocalizedTracksData(updatedData)
          setIsEditDialogOpen(false)
          setEditingIndex(null)
          setEditFormData({ trackTitle: "", spanish: "", portuguese: "" })
          toast({ title: 'Saved', description: 'Localized track saved' })
        } catch (err) {
          toast({ title: 'Save failed', description: 'Could not save localized track', variant: 'destructive' })
        } finally { setSaving(false) }
      })()
    } else {
      // create new localized track
      if (!isNonEmptyString(editFormData.trackTitle, 3)) {
        toast({ title: 'Validation', description: 'Track title is required (min 3 chars)', variant: 'destructive' })
        return
      }
      setSaving(true)
      ;(async () => {
        try {
          const payload = { ...editFormData, type: 'localizedTrack' }
          const item = await catalogService.create(payload)
          const newEntry = {
            sr: Number(item.sr || item.id || localizedTracksData.length + 1),
            trackTitle: item.trackTitle || item.title || editFormData.trackTitle,
            spanish: item.spanish || editFormData.spanish,
            portuguese: item.portuguese || editFormData.portuguese
          }
          const updated = [...localizedTracksData, newEntry].map((x, i) => ({ ...x, sr: i + 1 }))
          setLocalizedTracksData(updated)
          setIsEditDialogOpen(false)
          setEditingIndex(null)
          setEditFormData({ trackTitle: '', spanish: '', portuguese: '' })
          toast({ title: 'Created', description: 'Localized track added' })
        } catch (err) {
          toast({ title: 'Save failed', description: 'Could not create localized track', variant: 'destructive' })
        } finally { setSaving(false) }
      })()
    }
  }

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false)
    setEditingIndex(null)
    setEditFormData({ trackTitle: "", spanish: "", portuguese: "" })
  }

  const handleDelete = (index: number) => {
    if (window.confirm("Are you sure you want to delete this track?")) {
      const item = localizedTracksData[index]
      ;(async () => {
        try {
          if (item.sr) await catalogService.remove(item.sr)
          const updatedData = localizedTracksData.filter((_, i) => i !== index)
          setLocalizedTracksData(updatedData)
          toast({ title: 'Deleted', description: 'Localized track removed' })
        } catch (err) {
          toast({ title: 'Delete failed', description: 'Could not delete localized track', variant: 'destructive' })
        }
      })()
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between">
          <div></div>
          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <Button size="sm" className="flex items-center gap-2" onClick={() => { setEditingIndex(null); setEditFormData({ trackTitle: '', spanish: '', portuguese: '' }); setIsEditDialogOpen(true) }}>
                <Plus className="h-4 w-4" />
                Add Track
              </Button>
            )}
          </div>
        </div>
  {/* Add Track button handled below in body to keep layout consistent */}
        {/* Edit Dialog */}
        <EntityEditDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} title={editingIndex !== null ? `Edit: ${localizedTracksData[editingIndex]?.trackTitle || ''}` : 'Edit Localized Track'} saving={saving} onSave={async () => { handleSaveEdit() }}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="trackTitle" className="text-right">Track Title</Label>
              <Input id="trackTitle" value={editFormData.trackTitle} onChange={(e) => setEditFormData({ ...editFormData, trackTitle: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="spanish" className="text-right">Spanish</Label>
              <Select value={editFormData.spanish} onValueChange={(value) => setEditFormData({ ...editFormData, spanish: value })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Not Available">Not Available</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="portuguese" className="text-right">Portuguese</Label>
              <Select value={editFormData.portuguese} onValueChange={(value) => setEditFormData({ ...editFormData, portuguese: value })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Not Available">Not Available</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
  </EntityEditDialog>

  <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Localization Status
            </CardTitle>
            <CardDescription>
              Monthly maintained tracks with Spanish and Portuguese language availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ScrollArea className="h-[600px] w-full rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                        <TableHead className="min-w-[300px]">Track Title</TableHead>
                        <TableHead className="w-28 text-center">Spanish</TableHead>
                        <TableHead className="w-28 text-center">Portuguese</TableHead>
                        <TableHead className="w-32 text-center">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localizedTracksData.map((track, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{track.trackTitle}</TableCell>
                        <TableCell className="text-center">{getAvailabilityBadge(track.spanish)}</TableCell>
                        <TableCell className="text-center">{getAvailabilityBadge(track.portuguese)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                              {role === 'admin' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(index)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(index)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        
      </div>
    </DashboardLayout>
  )
}