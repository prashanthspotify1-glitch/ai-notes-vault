"use client";

/**
 * Shared react-markdown configuration.
 *
 * Both MarkdownReader and MarkdownEditor preview use the same
 * remark/rehype plugins and custom component overrides.
 */

import React from "react";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import type { PluggableList } from "unified";
import { MermaidBlock } from "@/components/markdown/mermaid-block";

/** Remark plugins shared by reader + editor preview */
export const remarkPlugins: PluggableList = [remarkGfm, remarkMath];

/** Rehype plugins shared by reader + editor preview */
export const rehypePlugins: PluggableList = [rehypeKatex, rehypeRaw];

/**
 * Build the custom `components` map for react-markdown.
 *
 * @param highlight  – Shiki highlight fn (returns HTML string or null)
 * @param shikiReady – whether the highlighter singleton has loaded
 */
export function buildMarkdownComponents(
  highlight: (code: string, lang: string) => string | null,
  shikiReady: boolean
): Components {
  return {
    // Strip the outer <pre> so Shiki's own <pre class="shiki"> isn't double-wrapped
    pre({ children }) {
      return <>{children}</>;
    },

    code({ className, children, node, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");

      // Block vs inline detection
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

      // Mermaid diagrams — render as interactive SVG
      if (lang === "mermaid") {
        return <MermaidBlock code={codeString} />;
      }

      // Shiki syntax highlighting
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

      // Fallback (Shiki not loaded yet)
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

    img({ src, alt, ...props }) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || ""}
          loading="lazy"
          className="rounded-lg max-w-full h-auto"
          {...props}
        />
      );
    },
  };
}
