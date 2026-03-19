"use client";

import { useRef, useState } from "react";

type TimelineControlsProps = {
  stepIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onRunCode: () => void;
  onScrub: (index: number) => void;
};

export function TimelineControls({
  stepIndex,
  total,
  onPrev,
  onNext,
  onRunCode,
  onScrub,
}: TimelineControlsProps) {
  const currentStep = total === 0 ? 0 : stepIndex + 1;
  const [runCodeAnimating, setRunCodeAnimating] = useState(false);
  const runCodeFrame = useRef<number | null>(null);

  const handleRunCode = () => {
    if (runCodeFrame.current !== null) {
      cancelAnimationFrame(runCodeFrame.current);
    }

    if (runCodeAnimating) {
      setRunCodeAnimating(false);
      runCodeFrame.current = requestAnimationFrame(() => {
        setRunCodeAnimating(true);
      });
    } else {
      setRunCodeAnimating(true);
    }

    onRunCode();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-[10px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">Phase {currentStep} / {total}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md border border-[#60A5FA]/55 bg-[#60A5FA]/14 px-3 py-1 text-xs font-bold tracking-wider text-[#93C5FD] transition-colors duration-150 hover:bg-[#60A5FA]/22${runCodeAnimating ? " run-code-animate" : ""}`}
            onClick={handleRunCode}
            onAnimationEnd={() => setRunCodeAnimating(false)}
          >
            🚀 LAUNCH MVP
          </button>
          <button
            type="button"
            className="rounded-md border border-white/20 px-3 py-1 text-xs text-zinc-100 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onPrev}
            disabled={stepIndex <= 0}
          >
            ◀ Previous Phase
          </button>
          <button
            type="button"
            className="rounded-md border border-white/20 px-3 py-1 text-xs text-zinc-100 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onNext}
            disabled={total === 0 || stepIndex >= total - 1}
          >
            ▶ Next Phase
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Timeline</span>
        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={total === 0 ? 0 : stepIndex}
          onChange={(event) => onScrub(Number(event.target.value))}
          className="startup-range h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-transparent disabled:opacity-40"
          disabled={total === 0}
          aria-label="Execution timeline scrubber"
        />
      </div>
    </div>
  );
}
