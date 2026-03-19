"use client";

import { SemanticIssue, SemanticLogEntry, TypeCheckEntry } from "@/lib/startup/semantic";
import { useState } from "react";

type TypeCheckPanelProps = {
  entries: TypeCheckEntry[];
  issues: SemanticIssue[];
  logs: SemanticLogEntry[];
  view?: "all" | "types" | "inference" | "errors" | "logs";
  embedded?: boolean;
  onIssueSelect?: (line: number, column: number) => void;
};

const typeClass = (type: string): string => {
  switch (type) {
    case "Burn":
      return "text-[#60A5FA]";
    case "Vibe":
      return "text-[#34D399]";
    case "Equity":
      return "text-[#F472B6]";
    case "Portfolio":
      return "text-[#A78BFA]";
    default:
      return "text-zinc-400";
  }
};

export function TypeCheckPanel({
  entries,
  issues,
  logs,
  view = "all",
  embedded = false,
  onIssueSelect,
}: TypeCheckPanelProps) {
  const [showAllLogs, setShowAllLogs] = useState(false);
  const visibleLogs = showAllLogs ? logs : logs.slice(-5);
  const compactEmbedded = embedded && view !== "all";

  const showInference = view === "all" || view === "types" || view === "inference";
  const showErrors = view === "all" || view === "types" || view === "errors";
  const showLogs = view === "all" || view === "logs";
  const sectionClass = compactEmbedded
    ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2"
    : "flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2";

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col overflow-hidden"
          : "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-[10px]"
      }
    >
      {!embedded && (
        <div className="startup-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">Type Check</div>
      )}
      <div className={compactEmbedded ? "flex h-full min-h-0 flex-col gap-3" : (embedded ? "grid h-full min-h-0 grid-cols-1 gap-3 content-start" : "grid h-[calc(100%-1.25rem)] min-h-0 grid-cols-1 gap-3 content-start")}>
        {showInference && (
        <div className={sectionClass}>
          <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Inference</div>
          <div className="min-h-0 overflow-auto">
            <table className="w-full table-fixed text-left font-mono text-xs text-zinc-100 sm:text-sm">
              <thead className="border-b border-white/10 text-zinc-400">
                <tr>
                  <th className="px-2 py-1">Var</th>
                  <th className="px-2 py-1">Declared</th>
                  <th className="px-2 py-1">Inferred</th>
                  <th className="px-2 py-1">At</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-zinc-500" colSpan={4}>
                      No declarations or assignments yet. Add typed variables in source to populate inference.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const mismatch =
                      entry.inferredType !== "Unknown" && entry.declaredType !== entry.inferredType;

                    return (
                      <tr
                        key={`${entry.source}-${entry.variable}-${entry.line}-${entry.column}`}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="break-words px-2 py-2">{entry.variable}</td>
                        <td className={`break-words px-2 py-2 ${typeClass(entry.declaredType)}`}>{entry.declaredType}</td>
                        <td
                          className={`break-words px-2 py-2 ${mismatch ? "text-rose-300" : typeClass(entry.inferredType)}`}
                        >
                          {entry.inferredType}
                        </td>
                        <td className="break-words px-2 py-2 text-zinc-500">
                          L{entry.line}:C{entry.column}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {showErrors && (
        <div className={sectionClass}>
          <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Type Errors</div>
          <div className="min-h-0 overflow-auto space-y-2 font-mono text-sm">
            {issues.length === 0 ? (
              <div className="startup-empty rounded px-2 py-1">No semantic issues. Type mismatch warnings will appear here.</div>
            ) : (
              issues.map((issue) => (
                <button
                  key={`${issue.message}-${issue.line}-${issue.column}`}
                  type="button"
                  onClick={() => onIssueSelect?.(issue.line, issue.column)}
                  data-testid={`type-issue-${issue.line}-${issue.column}`}
                  className="w-full rounded border border-rose-300/30 bg-rose-500/10 px-2 py-2 text-left text-rose-200 transition hover:border-rose-200/60 hover:bg-rose-500/15"
                >
                  <span>{issue.message}</span>
                  <span className="ml-2 text-rose-300/90">-&gt; L{issue.line}:C{issue.column}</span>
                </button>
              ))
            )}
          </div>
        </div>
        )}

        {showLogs && (
        <div className={sectionClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="startup-subheading text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Semantic Explainability</div>
            {logs.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllLogs((current) => !current)}
                className="startup-tab-btn rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
              >
                {showAllLogs ? "Show latest 5" : "Show all"}
              </button>
            )}
          </div>
          <div className="min-h-0 overflow-auto space-y-2 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="startup-empty rounded px-2 py-1">No semantic logs yet. Type-check and bind messages appear here.</div>
            ) : (
              visibleLogs.map((log) => (
                <div
                  key={`${log.phase}-${log.message}-${log.line}-${log.column}`}
                  className={`rounded border px-2 py-2 ${
                    log.phase === "check"
                      ? "border-sky-300/25 bg-sky-500/10 text-sky-100"
                      : "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  <span className="block break-words">{log.message}</span>
                  <span className="ml-2 opacity-80">-&gt; L{log.line}:C{log.column}</span>
                </div>
              ))
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
