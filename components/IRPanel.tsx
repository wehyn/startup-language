import { IRInstruction, StackFrame } from "@/lib/startup/types";

type IRPanelProps = {
  instructions: IRInstruction[];
  stack: StackFrame[];
  activeLine: number | null;
};

export function IRPanel({ instructions, stack, activeLine }: IRPanelProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20">
        <div className="startup-subheading sticky top-0 z-10 border-b border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Intermediate Representation
        </div>
        <table className="w-full text-left font-mono text-xs text-zinc-100">
          <thead className="border-b border-white/10 text-zinc-400">
            <tr>
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Opcode</th>
              <th className="px-2 py-1">Args</th>
              <th className="px-2 py-1">L</th>
            </tr>
          </thead>
          <tbody>
            {instructions.length === 0 ? (
              <tr>
                  <td className="px-2 py-2 text-zinc-500" colSpan={4}>
                    No IR generated yet. Run execution to build instruction flow.
                  </td>
                </tr>
            ) : (
              instructions.map((instruction) => {
                const highlighted = activeLine !== null && instruction.line === activeLine;
                return (
                  <tr
                    key={`${instruction.index}-${instruction.opcode}`}
                    className={`border-b border-white/5 last:border-0 ${
                      highlighted ? "bg-[#60A5FA]/10" : ""
                    }`}
                  >
                    <td className="px-2 py-1 text-zinc-400">{instruction.index}</td>
                    <td className="px-2 py-1 text-[#93C5FD]">{instruction.opcode}</td>
                    <td className="px-2 py-1">{instruction.args.join(" | ") || "-"}</td>
                    <td className="px-2 py-1 text-zinc-400">{instruction.line}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <div className="startup-subheading mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Execution Stack
        </div>
        <div className="space-y-1">
          {stack.length === 0 ? (
            <div className="startup-empty rounded px-2 py-1 font-mono text-xs">
              Empty stack. Step through control flow to view frame changes.
            </div>
          ) : (
            [...stack].reverse().map((frame, index) => (
              <div
                key={frame.id}
                className={`rounded border px-2 py-1 font-mono text-xs ${
                  index === 0
                    ? "border-[#60A5FA]/45 bg-[#60A5FA]/10 text-[#BFDBFE]"
                    : "border-white/10 bg-black/20 text-zinc-300"
                }`}
              >
                <span className="text-zinc-500">{index === 0 ? "top" : "frame"}</span> {frame.label}
                <span className="ml-2 text-zinc-500">L{frame.line}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
