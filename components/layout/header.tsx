"use client"

import { Menu, LogOut, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface HeaderProps {
  user: { email: string; role: string; name: string }
  onLogout: () => void
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ user, onLogout, setSidebarOpen }: HeaderProps) {
  return (
    <header className="bg-orange-600 border-b border-orange-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="text-white/90 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Mattress ERP</h1>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-white/90 hover:text-white relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 text-white/90 hover:text-white">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="bg-orange-600 text-white text-sm">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-orange-200">
            <DropdownMenuItem disabled className="text-xs text-gray-500 cursor-default">
              {user.email}
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="text-xs font-semibold text-orange-600 cursor-default uppercase">
              {user.role}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout} className="text-black cursor-pointer hover:text-red-300">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}