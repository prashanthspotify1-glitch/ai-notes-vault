"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Vault, FileText, Upload, Shield, ArrowRight, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function LandingPage() {
  const { signIn, isLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Vault className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">{APP_NAME}</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <Vault className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Your personal vault for
              <br />
              AI-generated notes
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
              Archive and read markdown files from your AI coding workflows.
              Drop them in, they&apos;re stored safely in your Google Drive.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Upload className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium">Drag & Drop</h3>
              <p className="text-xs text-muted-foreground">
                Upload .md files instantly with drag and drop
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium">Read & Browse</h3>
              <p className="text-xs text-muted-foreground">
                Beautiful markdown rendering with code highlighting
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium">Your Drive</h3>
              <p className="text-xs text-muted-foreground">
                Files stored in your own Google Drive, always under your control
              </p>
            </div>
          </div>

          {/* Sign in */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="text-base px-8 gap-2"
              onClick={signIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign in with Google
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground/60">
              Only requests access to files created by this app
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-muted-foreground/50 border-t border-border">
        {APP_NAME} &middot; Your notes, your Drive, your control
      </footer>
    </div>
  );
}
