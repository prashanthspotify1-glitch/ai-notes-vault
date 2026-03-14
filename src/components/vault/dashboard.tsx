"use client";

import React, { useState, useCallback } from "react";
import { DriveFile } from "@/types";
import { useVault } from "@/hooks/use-vault";
import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/vault/sidebar";
import { UploadZone } from "@/components/upload/upload-zone";
import { MarkdownReader } from "@/components/markdown/markdown-reader";
import { MarkdownEditor } from "@/components/markdown/markdown-editor";
import { FileText, Upload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const { isBootstrapping, bootstrapError } = useVault();
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleOpenEditor = useCallback(() => {
    setSelectedFile(null);
    setEditorOpen(true);
    setSidebarOpen(false);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
  }, []);

  const handleSelectFile = useCallback((file: DriveFile) => {
    setEditorOpen(false);
    setSelectedFile(file);
    setSidebarOpen(false); // auto-close sidebar on mobile
  }, []);

  if (isBootstrapping) {
    return (
      <div className="h-dvh flex flex-col">
        <TopBar onToggleSidebar={() => {}} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Setting up your vault...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="h-dvh flex flex-col">
        <TopBar onToggleSidebar={() => {}} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 max-w-md px-6">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-base font-semibold">Vault setup failed</h2>
            <p className="text-sm text-muted-foreground">{bootstrapError}</p>
            <p className="text-xs text-muted-foreground">
              This usually means the Google Drive API token has expired or
              permissions were not granted. Try signing out and back in.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: overlay on mobile, static on desktop */}
        <div
          className={`
            fixed top-14 bottom-0 left-0 z-40 w-72 transition-transform duration-200 ease-in-out
            md:relative md:top-auto md:bottom-auto md:translate-x-0 md:z-auto
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <Sidebar
            selectedFileId={selectedFile?.id ?? null}
            onSelectFile={handleSelectFile}
            editorOpen={editorOpen}
            onOpenEditor={handleOpenEditor}
          />
        </div>

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 bg-background relative">
          {editorOpen ? (
            <MarkdownEditor onClose={handleCloseEditor} />
          ) : selectedFile ? (
            <MarkdownReader file={selectedFile} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-6 sm:space-y-8">
              {/* Empty state / upload zone */}
              <div className="text-center space-y-2">
                <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                <h2 className="text-lg font-medium text-muted-foreground">
                  Select a file to read
                </h2>
                <p className="text-sm text-muted-foreground/60">
                  Or upload new markdown files below
                </p>
              </div>

              <div className="w-full max-w-lg">
                <UploadZone />
              </div>

              {/* Quick tips */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] text-muted-foreground/40">
                <span className="flex items-center gap-1">
                  <Upload className="h-3 w-3" />
                  Drop .md files to upload
                </span>
                <span className="hidden sm:inline">&middot;</span>
                <span>Click a file to read it</span>
                <span className="hidden sm:inline">&middot;</span>
                <span>Toggle raw/rendered view</span>
              </div>
            </div>
          )}

          {/* Floating upload button when a file is selected */}
          {selectedFile && (
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
              <UploadFab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Floating action button to open upload dialog when reading a file */
function UploadFab() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <Button
        size="lg"
        className="rounded-full shadow-lg h-12 w-12 p-0 cursor-pointer"
        onClick={() => setShowUpload(!showUpload)}
      >
        <Upload className="h-5 w-5" />
      </Button>

      {showUpload && (
        <div className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] max-w-80 bg-card border border-border rounded-xl shadow-xl p-4">
          <UploadZone />
        </div>
      )}
    </>
  );
}
