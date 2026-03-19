"use client";

import { ParserTraceStep } from "@/lib/startup/parser";

type ParserTracePanelProps = {
  trace: ParserTraceStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function ParserTracePanel({ trace, activeIndex, onSelect }: ParserTracePanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Parser Steps</div>
        <div className="space-y-1.5">
          {trace.length === 0 ? (
            <div className="startup-empty rounded px-2 py-1.5 font-mono text-xs">
              No parser steps yet. Syntax traces appear after tokenization and parsing.
            </div>
          ) : (
            trace.map((step, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onSelect(index)}
                  className={`w-full rounded border px-2 py-1.5 text-left transition ${
                    active
                      ? "border-[#60A5FA]/55 bg-[#60A5FA]/14"
                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-zinc-200">{step.rule}</span>
                    <span className="font-mono text-[10px] text-zinc-500">L{step.line}</span>
                  </div>
                  <div className="font-mono text-[11px] text-zinc-400">{step.description}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Matched Rule</div>
        {trace.length === 0 ? (
          <div className="startup-empty rounded px-2 py-1.5 font-mono text-xs">No production selected. Choose a parser step to inspect its rule.</div>
        ) : (
          <div className="space-y-2 font-mono text-xs">
            <div className="rounded border border-white/10 px-2 py-1 text-zinc-200">
              {trace[activeIndex]?.rule}
            </div>
            <div className="rounded border border-white/10 px-2 py-1 text-zinc-400">
              {trace[activeIndex]?.description}
            </div>
            <div className="rounded border border-white/10 px-2 py-1 text-zinc-500">
              Token Range: {trace[activeIndex]?.startToken ?? 0} - {trace[activeIndex]?.endToken ?? 0}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
