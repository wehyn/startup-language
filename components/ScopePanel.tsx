import { ScopeEnvironment } from "@/lib/startup/types";

type ScopePanelProps = {
  scopes: ScopeEnvironment[];
};

export function ScopePanel({ scopes }: ScopePanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3">
      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Scope Stack
        </div>
        <div className="space-y-1">
          {scopes.length === 0 ? (
            <div className="startup-empty rounded px-2 py-1 font-mono text-xs">
              No active scopes yet. Execute PIVOT/SPRINT blocks to create nested scopes.
            </div>
          ) : (
            [...scopes].reverse().map((scope, index) => (
              <div
                key={scope.id}
                className={`rounded border px-2 py-2 font-mono text-sm ${
                  index === 0
                    ? "border-[#60A5FA]/35 bg-[#60A5FA]/8 text-[#BFDBFE]"
                    : "border-white/8 bg-black/15 text-zinc-300"
                }`}
              >
                <div>
                  <span className="text-zinc-500">L{scope.level}</span> {scope.label}
                </div>
                <div className="text-xs text-zinc-500">line {scope.line}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
