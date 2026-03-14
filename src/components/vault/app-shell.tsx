"use client";

/**
 * App Shell
 *
 * Handles the auth gate: shows landing if unauthenticated,
 * shows dashboard (wrapped in VaultProvider) if authenticated.
 */

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { VaultProvider } from "@/hooks/use-vault";
import { LandingPage } from "@/components/vault/landing-page";
import { Dashboard } from "@/components/vault/dashboard";
import { Loader2, Vault } from "lucide-react";

export function AppShell() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Vault className="h-8 w-8 text-primary" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <VaultProvider>
      <Dashboard />
    </VaultProvider>
  );
}
