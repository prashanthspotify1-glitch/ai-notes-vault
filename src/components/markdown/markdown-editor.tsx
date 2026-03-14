"use client";

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useShikiHighlighter } from "@/hooks/use-shiki";
import { useUpload } from "@/hooks/use-drive-files";
import {
  remarkPlugins,
  rehypePlugins,
  buildMarkdownComponents,
} from "@/components/markdown/markdown-config";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Code2,
  Save,
  Download,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import "katex/dist/katex.min.css";

interface MarkdownEditorProps {
  onClose: () => void;
}

export function MarkdownEditor({ onClose }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [fileName, setFileName] = useState("untitled.md");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { highlight, isReady: shikiReady } = useShikiHighlighter();
  const { uploadFiles } = useUpload();

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

  const handleSaveToDrive = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Nothing to save");
      return;
    }
    const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const file = new File([content], name, { type: "text/markdown" });
    try {
      await uploadFiles([file]);
      toast.success(`Saved "${name}" to Drive`);
    } catch {
      toast.error("Failed to save to Drive");
    }
  }, [content, fileName, uploadFiles]);

  const handleDownload = useCallback(() => {
    if (!content.trim()) return;
    const name = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded "${name}"`);
  }, [content, fileName]);

  const mdComponents = buildMarkdownComponents(highlight, shikiReady);

  return (
    <div
      className={`flex flex-col bg-card ${
        expanded ? "fixed inset-0 z-50" : "flex-1 min-h-0"
      }`}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-3 py-1.5 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                mode === "write"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => setMode("write")}
            >
              <Code2 className="h-3 w-3 inline mr-1" />
              Write
            </button>
            <button
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                mode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => setMode("preview")}
            >
              <Eye className="h-3 w-3 inline mr-1" />
              Preview
            </button>
          </div>

          {/* Filename input */}
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="h-7 px-2 text-xs bg-background border border-border rounded w-28 sm:w-44 focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="filename.md"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 px-2 cursor-pointer"
            onClick={handleCopy}
            disabled={!content.trim()}
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 px-2 cursor-pointer"
            onClick={handleDownload}
            disabled={!content.trim()}
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 px-2 cursor-pointer"
            onClick={handleSaveToDrive}
            disabled={!content.trim()}
          >
            <Save className="h-3 w-3" />
            <span className="hidden sm:inline">Save to Drive</span>
          </Button>

          <div className="w-px h-4 bg-border mx-0.5 sm:mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={() => {
              if (content.trim() && !confirm("Discard your markdown?")) return;
              onClose();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "write" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full resize-none p-3 sm:p-4 text-sm font-mono leading-relaxed bg-background focus:outline-none placeholder:text-muted-foreground/40"
            placeholder="Write your markdown here..."
            spellCheck={false}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            {content.trim() ? (
              <div className="px-3 sm:px-6 py-4 sm:py-8">
                <article className="md-prose prose prose-neutral dark:prose-invert prose-headings:scroll-mt-4 prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                    components={mdComponents}
                  >
                    {content}
                  </ReactMarkdown>
                </article>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground/40 px-4 text-center">
                Nothing to preview yet. Switch to Write and start typing.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1 border-t border-border text-xs text-muted-foreground/60 bg-muted/30 shrink-0">
        <span>{content.length} characters</span>
        <span>{content.split("\n").length} lines</span>
      </div>
    </div>
  );
}
