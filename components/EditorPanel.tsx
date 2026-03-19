"use client";

import Editor, { Monaco, OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";

import type { editor as MonacoEditorType } from "monaco-editor";

type HoverRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

type EditorPanelProps = {
  value: string;
  onChange: (value: string) => void;
  activeLine: number;
  selectedLine: number | null;
  hoverRange: HoverRange | null;
};

let languageRegistered = false;

const registerStartupLanguage = (monaco: Monaco) => {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: "startup" });

  monaco.languages.setMonarchTokensProvider("startup", {
    keywords: [
      "Burn", "Vibe", "Equity", "Portfolio",
      "BURN", "VIBE", "EQUITY", "PORTFOLIO",
      "PIVOT", "SPRINT", "PITCH", "ACQUIRE", "EXIT",
      "AND", "OR", "NOT", "VESTED", "CLIFF",
    ],
    operators: ["::>", "+++", "---", "******", "///", ">>>", "<<<", "???", "!!?"],
    delimiters: ["(", ")", "[", "]", "?", ","],

    tokenizer: {
      root: [
        // line comments
        [/\/\/.*$/, "comment"],

        // strings
        [/"[^"]*"/, "string"],

        // numbers
        [/\b\d+(\.\d+)?\b/, "number"],

        // multi-char operators (order matters: longest first)
        [/\*{6}/, "operator"],
        [/::>/, "operator"],
        [/\+{3}/, "operator"],
        [/-{3}/, "operator"],
        [/\/{3}/, "operator"],
        [/>{3}/, "operator"],
        [/<{3}/, "operator"],
        [/\?{3}/, "operator"],
        [/!!?\?/, "operator"],

        // keywords & identifiers
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier",
          },
        }],

        // single-char delimiters
        [/[()[\]?,]/, "delimiter"],

        // whitespace
        [/\s+/, "white"],
      ],
    },
  });

  monaco.editor.defineTheme("startup-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "60A5FA", fontStyle: "bold" },
      { token: "identifier", foreground: "E5E7EB" },
      { token: "number", foreground: "FBBF24" },
      { token: "string", foreground: "34D399" },
      { token: "operator", foreground: "F472B6" },
      { token: "delimiter", foreground: "A78BFA" },
      { token: "comment", foreground: "6B7280", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editorGutter.background": "#00000000",
      "editor.foreground": "#E5E7EB",
      "editor.lineHighlightBackground": "#FFFFFF08",
      "editor.selectionBackground": "#60A5FA30",
      "editorCursor.foreground": "#60A5FA",
      "editorLineNumber.foreground": "#4B5563",
      "editorLineNumber.activeForeground": "#9CA3AF",
    },
  });
};

export function EditorPanel({ value, onChange, activeLine, selectedLine, hoverRange }: EditorPanelProps) {
  const editorRef = useRef<MonacoEditorType.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationRef = useRef<string[]>([]);

  const updateDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (!editor || !monaco) {
      return;
    }

    const decorations: MonacoEditorType.IModelDeltaDecoration[] = [];

    if (selectedLine && selectedLine > 0) {
      decorations.push({
        range: new monaco.Range(selectedLine, 1, selectedLine, 1),
        options: {
          isWholeLine: true,
          className: "startup-selected-line",
        },
      });
    }

    if (activeLine > 0 && activeLine !== selectedLine) {
      decorations.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          className: "startup-active-line",
        },
      });
    }

    if (hoverRange) {
      decorations.push({
        range: new monaco.Range(
          hoverRange.startLine,
          hoverRange.startColumn,
          hoverRange.endLine,
          hoverRange.endColumn,
        ),
        options: {
          className: "startup-token-hover",
        },
      });
    }

    decorationRef.current = editor.deltaDecorations(decorationRef.current, decorations);
  }, [activeLine, hoverRange, selectedLine]);

  const handleBeforeMount = (monaco: Monaco) => {
    registerStartupLanguage(monaco);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    updateDecorations();
  };

  useEffect(() => {
    updateDecorations();
  }, [updateDecorations]);

  return (
    <div className="startup-island startup-roomy h-full min-h-0 rounded-2xl p-4 backdrop-blur-[10px]">
      <div className="startup-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">The Pitch Deck</div>
      <div className="h-[calc(100%-1.25rem)] min-h-0 overflow-hidden rounded-xl border border-white/10 bg-transparent">
        <Editor
          value={value}
          onChange={(nextValue) => onChange(nextValue ?? "")}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          language="startup"
          theme="startup-dark"
          options={{
            fontSize: 13,
            lineHeight: 28,
            fontFamily: "var(--font-geist-mono), JetBrains Mono, Fira Code, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>
    </div>
  );
}

export type { HoverRange };
