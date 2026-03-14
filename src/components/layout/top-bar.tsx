"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/hooks/use-vault";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FolderOpen, ChevronRight, LogOut, Vault, Menu } from "lucide-react";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { rootFolder } = useVault();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-3 sm:px-4 shrink-0">
      {/* Left: hamburger + app title + root folder */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onToggleSidebar}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors md:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <Vault className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold tracking-tight hidden sm:block">
            {APP_NAME}
          </h1>
          {/* Short name on very small screens */}
          <h1 className="text-base font-semibold tracking-tight sm:hidden">
            Vault
          </h1>
        </div>

        {rootFolder && (
          <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground min-w-0 overflow-hidden">
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[120px]">{rootFolder.name}</span>
          </nav>
        )}
      </div>

      {/* Right: folder indicator + theme toggle + user menu */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {rootFolder && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{rootFolder.name}</span>
          </div>
        )}

        <ThemeToggle />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="relative h-8 w-8 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer" />
              }
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.picture} alt={user.name} />
                <AvatarFallback>
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
