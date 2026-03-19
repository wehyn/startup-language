"use client";

import { ExecutionStep } from "@/lib/startup/types";

type ConsolePanelProps = {
  step: ExecutionStep | null;
  log: string;
};

export function ConsolePanel({ step, log }: ConsolePanelProps) {
  const entries = step ? Object.entries(step.variables) : [];
  const output = log.trim().length > 0 ? log : "[EXEC] Waiting for execution";
  const terminalOutput = step?.output ?? [];

  return (
    <div className="h-full min-h-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-[10px]">
      <div className="mb-3 text-xs font-semibold tracking-wide text-zinc-300">Console + State</div>

      <div className="grid h-[calc(100%-1.25rem)] min-h-0 grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <div className="flex min-h-0 flex-col rounded-xl border border-white/10 p-3">
          <div className="mb-2 text-xs text-zinc-400">Execution Log</div>
          <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
            {output}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-white/10 p-3">
          <div className="mb-2 text-xs text-zinc-400">Terminal Output</div>
          <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
            {terminalOutput.length > 0 ? terminalOutput.join("\n") : "<no output>"}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-xl border border-white/10 p-3">
          <div className="mb-2 text-xs text-zinc-400">Symbol Table</div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-black/20">
            <table className="w-full text-left font-mono text-xs text-zinc-100">
              <thead className="border-b border-white/10 text-zinc-400">
                <tr>
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Value</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-zinc-500" colSpan={3}>
                      No variables yet
                    </td>
                  </tr>
                ) : (
                  entries.map(([name, info]) => (
                    <tr key={name} className="border-b border-white/5 last:border-0">
                      <td className="px-2 py-1">{name}</td>
                      <td className="px-2 py-1">{info.type}</td>
                      <td className="px-2 py-1">{info.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
