"use client";

import { SemanticIssue, TypeCheckEntry } from "@/lib/startup/semantic";

type TypeCheckPanelProps = {
  entries: TypeCheckEntry[];
  issues: SemanticIssue[];
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
  embedded = false,
  onIssueSelect,
}: TypeCheckPanelProps) {
  return (
    <div
      className={
        embedded
          ? "h-full min-h-0"
          : "h-full min-h-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-[10px]"
      }
    >
      {!embedded && (
        <div className="startup-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">Type Check</div>
      )}
      <div className={embedded ? "grid h-full min-h-0 grid-cols-1 gap-3" : "grid h-[calc(100%-1.25rem)] min-h-0 grid-cols-1 gap-3"}>
        <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Inference</div>
          <table className="w-full text-left font-mono text-[11px] text-zinc-100">
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
                      <td className="px-2 py-1">{entry.variable}</td>
                      <td className={`px-2 py-1 ${typeClass(entry.declaredType)}`}>{entry.declaredType}</td>
                      <td
                        className={`px-2 py-1 ${mismatch ? "text-rose-300" : typeClass(entry.inferredType)}`}
                      >
                        {entry.inferredType}
                      </td>
                      <td className="px-2 py-1 text-zinc-500">
                        L{entry.line}:C{entry.column}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
          <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Type Errors</div>
          <div className="space-y-1 font-mono text-[11px]">
            {issues.length === 0 ? (
              <div className="startup-empty rounded px-2 py-1">No semantic issues. Type mismatch warnings will appear here.</div>
            ) : (
              issues.map((issue) => (
                <button
                  key={`${issue.message}-${issue.line}-${issue.column}`}
                  type="button"
                  onClick={() => onIssueSelect?.(issue.line, issue.column)}
                  className="w-full rounded border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-left text-rose-200 transition hover:border-rose-200/60 hover:bg-rose-500/15"
                >
                  <span>{issue.message}</span>
                  <span className="ml-2 text-rose-300/90">-&gt; L{issue.line}:C{issue.column}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
