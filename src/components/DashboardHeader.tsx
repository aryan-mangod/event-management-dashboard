import { Bell, Search, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

export function DashboardHeader() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const role = (typeof window !== 'undefined' ? localStorage.getItem('dashboard_role') : null) || 'user'
  const userName = (typeof window !== 'undefined' ? localStorage.getItem('dashboard_user_name') : null) || 'User'
  const userEmail = (typeof window !== 'undefined' ? localStorage.getItem('dashboard_user_email') : null) || ''
  const displayName = userEmail || userName || role
  const initials = (role || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || 'U'
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/90">
      <div className="flex h-16 items-center justify-between px-6 max-w-none">
        <div className="flex items-center gap-4 min-w-0">
          <SidebarTrigger className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 transition-opacity" />
          <div className="hidden md:flex min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">
              Lab and Catalog Updates
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-muted/50 dark:hover:bg-muted/30">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background border-border dark:bg-background dark:border-border" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground capitalize">{role}</p>
                  <p className="text-xs leading-none text-muted-foreground">{displayName}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border dark:bg-border" />
              <DropdownMenuItem className="text-foreground hover:bg-muted/50 dark:hover:bg-muted/30" onClick={async () => {
                try {
                  const token = localStorage.getItem('dashboard_token')
                  if (token) await fetch('/api/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
                } catch (err) {
                  // ignore
                }
                localStorage.removeItem('dashboard_token')
                localStorage.removeItem('dashboard_role')
                localStorage.removeItem('dashboard_user_name')
                localStorage.removeItem('dashboard_user_email')
                toast({ title: 'Signed out', description: 'You have been signed out.' })
                navigate('/login')
              }}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}