import { DashboardLayout } from "@/components/DashboardLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/MetricCard"
import { Users, UserPlus, UserCheck, UserX, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect, useState } from "react"
import api from "@/lib/api"
import { useToast } from '@/hooks/use-toast'

interface User {
  id: string;
  name: string;
  email: string;
  status: string;
  joined: string;
  avatar: string;
  role?: string;
  password?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const r = localStorage.getItem('dashboard_role') || null;
    setRole(r);
  }, []);

  useEffect(() => {
    // fetch users from API (requires auth)
    (async () => {
      try {
        const res = await api.get('/api/users');
        if (Array.isArray(res.data)) {
          setUsers(res.data.map((u: any) => ({ id: u.id, name: u.username || u.name || '', email: u.email || '', status: 'Active', joined: 'Just now', avatar: '/placeholder.svg', role: u.role || 'user' })) as User[]);
        }
      } catch (err) {
        // ignore — user will see local empty state
      }
    })();
  }, []);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", status: "Active", role: 'user', password: '' });
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvError, setCsvError] = useState("");
  const { toast } = useToast()

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (role !== 'admin') return;
    try {
      await api.delete(`/api/users/${userId}`);
      setUsers(users.filter(user => user.id !== userId));
  toast({ title: 'User deleted' })
    } catch (err) {
      // ignore for now
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (role !== 'admin') return;
    try {
      const payload: any = { username: editingUser.name, email: editingUser.email };
      if ((editingUser as any).role) payload.role = (editingUser as any).role;
      if ((editingUser as any).password) payload.password = (editingUser as any).password;
      const res = await api.put(`/api/users/${editingUser.id}`, payload);
      // update local list using returned user when available
      if (res.data && res.data.user) {
        const u = res.data.user;
        setUsers(users.map(user => user.id === editingUser.id ? { ...user, name: u.username || editingUser.name, email: u.email || editingUser.email, role: u.role || (editingUser as any).role } : user));
      } else {
        setUsers(users.map(user => user.id === editingUser.id ? editingUser : user));
      }
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch (err) {
      // ignore
    }
  };

  const handleAddUser = async () => {
    if (role !== 'admin') return;
    try {
      const payload: any = { username: newUser.name || `user-${Date.now()}`, email: newUser.email, role: (newUser as any).role || 'user' };
      if ((newUser as any).password) payload.password = (newUser as any).password;
      const res = await api.post('/api/users', payload);
      if (res.data && res.data.user) {
        const created = res.data.user;
        const newUserWithId = { id: created.id, name: created.username, email: created.email || newUser.email || '', status: 'Active', joined: 'Just now', avatar: '/placeholder.svg', role: created.role || (newUser as any).role };
        setUsers([newUserWithId, ...users]);
      } else {
        // fallback: refetch
        const fetched = await api.get('/api/users');
        if (Array.isArray(fetched.data)) setUsers(fetched.data.map((u: any) => ({ id: u.id, name: u.username || u.name || '', email: u.email || '', status: 'Active', joined: 'Just now', avatar: '/placeholder.svg', role: u.role || 'user' })) as User[]);
      }
    } catch (err) {
      // ignore
    }
    setNewUser({ name: '', email: '', status: 'Active', role: 'user', password: '' });
    setIsAddDialogOpen(false);
  };

  // Bulk CSV upload
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("");
    setCsvUploading(true);
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      if (role !== 'admin') { setCsvError('Only admins can upload CSV'); setCsvUploading(false); return; }
      const res = await api.post(`/api/upload-csv?resource=users`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setUsers(res.data.tracks.map((user: Record<string, unknown>, idx: number) => ({ id: (idx+1).toString(), name: String(user.name || user.fullname || ''), email: String(user.email || ''), status: String(user.status || 'Active'), joined: String(user.joined || 'Just now'), avatar: String(user.avatar || '/placeholder.svg') })));
    } catch (err) {
      setCsvError("Failed to upload CSV");
    }
    setCsvUploading(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">
              Manage users, track engagement, and analyze user behavior
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                  <Button className="interactive-button" disabled={role !== 'admin'}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add New User
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account. Fill in the details below.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="add-name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-status" className="text-right">
                      Status
                    </Label>
                    <Select value={newUser.status} onValueChange={(value) => setNewUser({...newUser, status: value})}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-role" className="text-right">Role</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="add-password" className="text-right">Password</Label>
                    <Input id="add-password" type="password" value={(newUser as any).password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleAddUser}>
                    Add User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={csvUploading || role !== 'admin'} onClick={() => document.getElementById('users-csv-input')?.click()}>
                Bulk Upload (.csv)
              </Button>
              <input id="users-csv-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
            </div>
          </div>
          {csvError && <div className="text-red-500 text-sm">{csvError}</div>}
        </div>

        {/* User Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Users"
            value="12,543"
            change="+8.2% from last month"
            changeType="positive"
            icon={Users}
          />
          <MetricCard
            title="Active Users"
            value="9,834"
            change="+12.1% from last month"
            changeType="positive"
            icon={UserCheck}
          />
          <MetricCard
            title="New Signups"
            value="1,247"
            change="+15.8% from last month"
            changeType="positive"
            icon={UserPlus}
          />
          <MetricCard
            title="Churn Rate"
            value="2.1%"
            change="-0.5% from last month"
            changeType="positive"
            icon={UserX}
          />
        </div>

        {/* Recent Users */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Latest user registrations and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.email} className="flex items-center justify-between p-4 rounded-lg border border-border/50 interactive-hover">
                  <div className="flex items-center space-x-4">
                    <Avatar>
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge variant={user.status === 'Active' ? 'default' : user.status === 'Inactive' ? 'destructive' : 'secondary'}>
                      {user.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{user.joined}</span>
                    
                    {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                      {/* Edit Button with Dialog */}
                      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                          <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            disabled={role !== 'admin'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>
                              Make changes to the user account here. Click save when you're done.
                            </DialogDescription>
                          </DialogHeader>
                          {editingUser && (
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">
                                  Name
                                </Label>
                                <Input
                                  id="edit-name"
                                  value={editingUser.name}
                                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                                  className="col-span-3"
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-email" className="text-right">
                                  Email
                                </Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={editingUser.email}
                                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                                  className="col-span-3"
                                />
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-status" className="text-right">
                                  Status
                                </Label>
                                <Select value={editingUser.status} onValueChange={(value) => setEditingUser({...editingUser, status: value})}>
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-role" className="text-right">Role</Label>
                                <Select value={(editingUser as any).role || 'user'} onValueChange={(value) => setEditingUser({...editingUser, role: value})}>
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-password" className="text-right">Password</Label>
                                <Input id="edit-password" type="password" value={(editingUser as any).password || ''} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} className="col-span-3" />
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button type="submit" onClick={handleSaveEdit}>
                              Save changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Delete Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={role !== 'admin'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}