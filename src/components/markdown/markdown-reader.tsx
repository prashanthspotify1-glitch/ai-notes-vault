"use client";

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFileContent } from "@/hooks/use-drive-files";
import { useShikiHighlighter } from "@/hooks/use-shiki";
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

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
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
        expanded
          ? "fixed inset-0 z-50 bg-background"
          : "flex-1"
      }`}
    >
      {/* File header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{file.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {new Date(file.modifiedTime).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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

        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "rendered" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-none text-xs gap-1 cursor-pointer"
              onClick={() => setViewMode("rendered")}
            >
              <Eye className="h-3 w-3" />
              Rendered
            </Button>
            <Button
              variant={viewMode === "raw" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 rounded-none text-xs gap-1 cursor-pointer"
              onClick={() => setViewMode("raw")}
            >
              <Code2 className="h-3 w-3" />
              Raw
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 cursor-pointer"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>

          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-xs rounded-[min(var(--radius-md),12px)] hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              Drive
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
          <div className="px-6 py-8">
            <article className="md-prose prose prose-neutral dark:prose-invert prose-headings:scroll-mt-4 prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    // Pass through — let the code component handle everything
                    return <>{children}</>;
                  },
                  code({ className, children, node, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");

                    // Determine if this is inline code or a code block.
                    // A code block is either: has a language class, OR was
                    // inside a <pre> (node's parent is 'element' with tagName 'pre'),
                    // OR contains newlines.
                    const parentIsBlock =
                      node?.position?.start?.line !== node?.position?.end?.line;
                    const isBlock = !!match || !!className || parentIsBlock;

                    if (!isBlock) {
                      return (
                        <code className="md-inline-code" {...props}>
                          {children}
                        </code>
                      );
                    }

                    const lang = match?.[1] || "text";

                    if (shikiReady) {
                      const html = highlight(codeString, lang);
                      if (html) {
                        return (
                          <div
                            className="shiki-wrapper not-prose !my-4"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        );
                      }
                    }

                    return (
                      <pre className="md-code-fallback not-prose !my-4">
                        <code>{codeString}</code>
                      </pre>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table>{children}</table>
                      </div>
                    );
                  },
                  a({ children, href, ...props }) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {content || ""}
              </ReactMarkdown>
            </article>
          </div>
        ) : (
          <div className="p-6">
            <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
              {content || ""}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
