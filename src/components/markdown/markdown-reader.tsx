"use client";

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useFileContent } from "@/hooks/use-drive-files";
import { useShikiHighlighter } from "@/hooks/use-shiki";
import {
  remarkPlugins,
  rehypePlugins,
  buildMarkdownComponents,
} from "@/components/markdown/markdown-config";
import { DriveFile, ViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Code2,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Clock,
  HardDrive,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import "katex/dist/katex.min.css";

interface MarkdownReaderProps {
  file: DriveFile;
}

export function MarkdownReader({ file }: MarkdownReaderProps) {
  const { data: content, isLoading, error } = useFileContent(file.id);
  const { highlight, isReady: shikiReady } = useShikiHighlighter();
  const [viewMode, setViewMode] = useState<ViewMode>("rendered");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [content]);

  const mdComponents = buildMarkdownComponents(highlight, shikiReady);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <FileText className="h-12 w-12 mx-auto text-destructive/50 mb-3" />
          <p className="text-sm font-medium text-destructive">
            Failed to load file content
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col min-h-0 ${
        expanded ? "fixed inset-0 z-50 bg-background" : "flex-1"
      }`}
    >
      {/* File header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b border-border bg-card shrink-0">
        {/* File info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate" title={file.name}>
              {file.name}
            </h2>
            <div className="flex items-center gap-2 sm:gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">
                  {new Date(file.modifiedTime).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="sm:hidden">
                  {new Date(file.modifiedTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </span>
              {file.size && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  <HardDrive className="h-2 w-2 mr-1" />
                  {(parseInt(file.size) / 1024).toFixed(1)} KB
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "rendered" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-none text-xs gap-1 cursor-pointer"
              onClick={() => setViewMode("rendered")}
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">Rendered</span>
            </Button>
            <Button
              variant={viewMode === "raw" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-none text-xs gap-1 cursor-pointer"
              onClick={() => setViewMode("raw")}
            >
              <Code2 className="h-3 w-3" />
              <span className="hidden sm:inline">Raw</span>
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 cursor-pointer px-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Copied" : "Copy"}
            </span>
          </Button>

          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-7 px-2 sm:px-2.5 text-xs rounded-[min(var(--radius-md),12px)] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">Drive</span>
            </a>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Exit fullscreen" : "Fullscreen"}
          >
            {expanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === "rendered" ? (
          <div className="px-3 sm:px-6 py-4 sm:py-8">
            <article className="md-prose prose prose-neutral dark:prose-invert prose-headings:scroll-mt-4 prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={mdComponents}
              >
                {content || ""}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="p-3 sm:p-6">
            <pre className="bg-muted rounded-lg p-3 sm:p-4 overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
              {content || ""}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
