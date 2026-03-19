"use client";

import { useRef, useState } from "react";

type TimelineControlsProps = {
  stepIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onRunCode: () => void;
};

export function TimelineControls({
  stepIndex,
  total,
  onPrev,
  onNext,
  onRunCode,
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
    <div className="startup-island startup-roomy-sm rounded-2xl px-4 py-3 backdrop-blur-[10px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="startup-heading text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">Phase {currentStep} / {total}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`startup-tab-btn active rounded-md px-3 py-1 text-xs font-bold tracking-wider transition-colors duration-150 hover:bg-[#60A5FA]/22${runCodeAnimating ? " run-code-animate" : ""}`}
            onClick={handleRunCode}
            onAnimationEnd={() => setRunCodeAnimating(false)}
          >
            🚀 LAUNCH MVP
          </button>
          <button
            type="button"
            className="startup-tab-btn rounded-md px-3 py-1 text-xs text-zinc-100 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onPrev}
            disabled={stepIndex <= 0}
          >
            ◀ Previous Phase
          </button>
          <button
            type="button"
            className="startup-tab-btn rounded-md px-3 py-1 text-xs text-zinc-100 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onNext}
            disabled={total === 0 || stepIndex >= total - 1}
          >
            ▶ Next Phase
          </button>
        </div>
      </div>

    </div>
  );
}
