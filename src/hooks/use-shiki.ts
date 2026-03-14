"use client";

/**
 * Shiki code highlighter hook.
 *
 * Lazily creates a single shared Shiki highlighter instance
 * with custom themes:
 *   - Dark: ChatGPT-style neutral palette (blue/green/yellow/pink)
 *   - Light: Claude-style soft palette (purple/green/blue/amber)
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { createHighlighter, type Highlighter, type ThemeRegistration } from "shiki";

/* ─── ChatGPT dark palette ──────────────────────────────────────────────── */
const chatgptDark: ThemeRegistration = {
  name: "chatgpt-dark",
  type: "dark",
  colors: {
    "editor.background": "#282c34",
    "editor.foreground": "#E5E7EB",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#6B7280", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "keyword.operator.logical",
        "storage",
        "storage.type",
      ],
      settings: { foreground: "#60A5FA" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "string.quoted.single",
        "string.quoted.double",
        "string.quoted.template",
      ],
      settings: { foreground: "#34D399" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call",
      ],
      settings: { foreground: "#FBBF24" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language.boolean",
        "constant.language.null",
        "constant.language.undefined",
      ],
      settings: { foreground: "#F472B6" },
    },
    {
      scope: [
        "variable",
        "variable.other",
        "variable.parameter",
        "meta.object-literal.key",
      ],
      settings: { foreground: "#E5E7EB" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "#7DD3FC" },
    },
    {
      scope: [
        "entity.name.tag",
        "support.type.property-name",
      ],
      settings: { foreground: "#60A5FA" },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "keyword.operator.assignment",
      ],
      settings: { foreground: "#9CA3AF" },
    },
    {
      scope: [
        "entity.other.attribute-name",
      ],
      settings: { foreground: "#FBBF24" },
    },
    {
      scope: [
        "constant.other",
        "variable.other.constant",
      ],
      settings: { foreground: "#F472B6" },
    },
    {
      scope: [
        "string.regexp",
      ],
      settings: { foreground: "#F87171" },
    },
    {
      scope: [
        "markup.heading",
        "entity.name.section",
      ],
      settings: { foreground: "#FFFFFF", fontStyle: "bold" },
    },
  ],
};

/* ─── Claude light palette ──────────────────────────────────────────────── */
const claudeLight: ThemeRegistration = {
  name: "claude-light",
  type: "light",
  colors: {
    "editor.background": "#F8FAFC",
    "editor.foreground": "#111827",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#9CA3AF", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "keyword.operator.logical",
        "storage",
        "storage.type",
      ],
      settings: { foreground: "#7C3AED" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "string.quoted.single",
        "string.quoted.double",
        "string.quoted.template",
      ],
      settings: { foreground: "#059669" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call",
      ],
      settings: { foreground: "#2563EB" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language.boolean",
        "constant.language.null",
        "constant.language.undefined",
      ],
      settings: { foreground: "#D97706" },
    },
    {
      scope: [
        "variable",
        "variable.other",
        "variable.parameter",
        "meta.object-literal.key",
      ],
      settings: { foreground: "#111827" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "#7C3AED" },
    },
    {
      scope: [
        "entity.name.tag",
        "support.type.property-name",
      ],
      settings: { foreground: "#2563EB" },
    },
    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "keyword.operator.assignment",
      ],
      settings: { foreground: "#6B7280" },
    },
    {
      scope: [
        "entity.other.attribute-name",
      ],
      settings: { foreground: "#D97706" },
    },
    {
      scope: [
        "constant.other",
        "variable.other.constant",
      ],
      settings: { foreground: "#D97706" },
    },
    {
      scope: [
        "string.regexp",
      ],
      settings: { foreground: "#DC2626" },
    },
    {
      scope: [
        "markup.heading",
        "entity.name.section",
      ],
      settings: { foreground: "#111827", fontStyle: "bold" },
    },
  ],
};

/* ─── Highlighter singleton ─────────────────────────────────────────────── */

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [chatgptDark, claudeLight],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "json",
        "html",
        "css",
        "python",
        "bash",
        "shell",
        "markdown",
        "yaml",
        "sql",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
      ],
    });
  }
  return highlighterPromise;
}

export function useShikiHighlighter() {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    getHighlighter().then(setHighlighter);
  }, []);

  const highlight = useCallback(
    (code: string, lang: string): string | null => {
      if (!highlighter) return null;

      // Check if language is loaded, fall back to "text" if not
      const loadedLangs = highlighter.getLoadedLanguages();
      const resolvedLang = loadedLangs.includes(lang) ? lang : "text";

      try {
        return highlighter.codeToHtml(code, {
          lang: resolvedLang,
          themes: {
            dark: "chatgpt-dark",
            light: "claude-light",
          },
        });
      } catch {
        // Fallback: return null and let the component render plain code
        return null;
      }
    },
    [highlighter]
  );

  return { highlight, isReady: !!highlighter };
}
