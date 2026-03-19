import { ExecutionStep, Timeline } from "./types";

export const nextStep = (timeline: Timeline, currentIndex: number): number => {
  if (timeline.length === 0) {
    return 0;
  }

  return Math.min(currentIndex + 1, timeline.length - 1);
};

export const prevStep = (timeline: Timeline, currentIndex: number): number => {
  if (timeline.length === 0) {
    return 0;
  }

  return Math.max(currentIndex - 1, 0);
};

export const stepAt = (timeline: Timeline, currentIndex: number): ExecutionStep | null => {
  if (timeline.length === 0) {
    return null;
  }

  return timeline[currentIndex] ?? null;
};
