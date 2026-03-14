"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderIdCounter = useRef(0);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    renderIdCounter.current += 1;
    const renderId = `mermaid-${renderIdCounter.current}-${Math.random().toString(36).slice(2, 8)}`;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;

        // Re-initialize every render so theme changes take effect
        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === "dark" ? "dark" : "default",
          securityLevel: "loose",
          fontFamily: "inherit",
          themeVariables:
            resolvedTheme === "dark"
              ? {
                  primaryColor: "#374151",
                  primaryTextColor: "#F3F4F6",
                  primaryBorderColor: "#6B7280",
                  lineColor: "#9CA3AF",
                  secondaryColor: "#1F2937",
                  tertiaryColor: "#111827",
                  textColor: "#F3F4F6",
                  mainBkg: "#374151",
                  nodeBorder: "#6B7280",
                  clusterBkg: "#1F2937",
                  titleColor: "#F9FAFB",
                  edgeLabelBackground: "#1F2937",
                  nodeTextColor: "#F3F4F6",
                  actorTextColor: "#F3F4F6",
                  actorBkg: "#374151",
                  actorBorder: "#6B7280",
                  actorLineColor: "#9CA3AF",
                  signalColor: "#F3F4F6",
                  signalTextColor: "#F3F4F6",
                  labelBoxBkgColor: "#374151",
                  labelBoxBorderColor: "#6B7280",
                  labelTextColor: "#F3F4F6",
                  loopTextColor: "#F3F4F6",
                  noteBkgColor: "#374151",
                  noteTextColor: "#F3F4F6",
                  noteBorderColor: "#6B7280",
                  activationBkgColor: "#4B5563",
                  activationBorderColor: "#9CA3AF",
                  sequenceNumberColor: "#F3F4F6",
                }
              : {},
        });

        const { svg: renderedSvg } = await mermaid.render(renderId, code);

        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram"
          );
          setSvg(null);
        }
      }
    }

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [code, resolvedTheme]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-medium mb-1">Mermaid diagram error</p>
        <pre className="text-xs opacity-70 whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-border bg-muted/30 p-8">
        <span className="text-sm text-muted-foreground animate-pulse">
          Rendering diagram...
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-border bg-muted/20 p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
