import { ScopeEnvironment } from "@/lib/startup/types";

type ScopePanelProps = {
  scopes: ScopeEnvironment[];
};

export function ScopePanel({ scopes }: ScopePanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Scope Stack
        </div>
        <div className="space-y-1">
          {scopes.length === 0 ? (
            <div className="rounded border border-white/10 px-2 py-1 font-mono text-xs text-zinc-500">
              No active scopes
            </div>
          ) : (
            [...scopes].reverse().map((scope, index) => (
              <div
                key={scope.id}
                className={`rounded border px-2 py-1 font-mono text-xs ${
                  index === 0
                    ? "border-[#60A5FA]/45 bg-[#60A5FA]/10 text-[#BFDBFE]"
                    : "border-white/10 bg-black/20 text-zinc-300"
                }`}
              >
                <div>
                  <span className="text-zinc-500">L{scope.level}</span> {scope.label}
                </div>
                <div className="text-zinc-500">line {scope.line}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Environment Table
        </div>
        {scopes.length === 0 ? (
          <div className="px-2 py-2 font-mono text-xs text-zinc-500">No variables in scope</div>
        ) : (
          <div className="space-y-2 p-2">
            {[...scopes].reverse().map((scope) => {
              const vars = Object.entries(scope.variables);
              return (
                <div key={`env-${scope.id}`} className="rounded border border-white/10 bg-black/20">
                  <div className="border-b border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300">
                    {scope.label}
                  </div>
                  <table className="w-full text-left font-mono text-xs text-zinc-100">
                    <thead className="border-b border-white/10 text-zinc-400">
                      <tr>
                        <th className="px-2 py-1">Name</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vars.length === 0 ? (
                        <tr>
                          <td className="px-2 py-2 text-zinc-500" colSpan={3}>
                            No variables
                          </td>
                        </tr>
                      ) : (
                        vars.map(([name, info]) => (
                          <tr key={`${scope.id}-${name}`} className="border-b border-white/5 last:border-0">
                            <td className="px-2 py-1">{name}</td>
                            <td className="px-2 py-1">{info.type}</td>
                            <td className="px-2 py-1">{String(info.value)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
