"use client";

import { Token } from "@/lib/startup/types";
import { useEffect, useMemo, useRef } from "react";

import { HoverRange } from "./EditorPanel";

type TokenPanelProps = {
  tokens: Token[];
  highlightedTokenIndexes?: number[];
  errorTokenIndexes?: number[];
  onTokenHover: (range: HoverRange | null) => void;
  onTokenClick?: (tokenIndex: number) => void;
  embedded?: boolean;
};

const tokenColorClass = (type: Token["type"]): string => {
  switch (type) {
    case "KEYWORD":
      return "text-[#60A5FA]";
    case "IDENTIFIER":
      return "text-[#E5E7EB]";
    case "LITERAL":
      return "text-[#34D399]";
    case "OPERATOR":
      return "text-[#F472B6]";
    case "DELIMITER":
      return "text-[#A78BFA]";
    default:
      return "text-zinc-200";
  }
};

export function TokenPanel({
  tokens,
  highlightedTokenIndexes = [],
  errorTokenIndexes = [],
  onTokenHover,
  onTokenClick,
  embedded = false,
}: TokenPanelProps) {
  const highlightedSet = new Set(highlightedTokenIndexes);
  const errorSet = new Set(errorTokenIndexes);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tokenItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const autoScrollTargetRange = useMemo(() => {
    if (highlightedTokenIndexes.length > 0) {
      return {
        start: highlightedTokenIndexes[0],
        end: highlightedTokenIndexes[highlightedTokenIndexes.length - 1],
      };
    }

    if (errorTokenIndexes.length > 0) {
      return {
        start: errorTokenIndexes[0],
        end: errorTokenIndexes[errorTokenIndexes.length - 1],
      };
    }

    return null;
  }, [errorTokenIndexes, highlightedTokenIndexes]);

  const tokensByLine = useMemo(() => {
    const lines = new Map<number, Array<{ token: Token; index: number }>>();

    tokens.forEach((token, index) => {
      if (!lines.has(token.line)) {
        lines.set(token.line, []);
      }
      lines.get(token.line)?.push({ token, index });
    });

    return Array.from(lines.entries()).sort((a, b) => a[0] - b[0]);
  }, [tokens]);

  useEffect(() => {
    if (autoScrollTargetRange === null) {
      return;
    }

    const scroller = scrollerRef.current;
    const startItem = tokenItemRefs.current[autoScrollTargetRange.start];
    const endItem = tokenItemRefs.current[autoScrollTargetRange.end] ?? startItem;

    if (!scroller || !startItem || !endItem) {
      return;
    }

    const top = startItem.offsetTop;
    const bottom = endItem.offsetTop + endItem.offsetHeight;
    const center = (top + bottom) / 2;
    const desiredViewportY = scroller.clientHeight * 0.7;
    const downShift = 16;
    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const targetTop = Math.max(0, Math.min(maxScrollTop, center - desiredViewportY - downShift));

    scroller.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }, [autoScrollTargetRange]);

  return (
    <div
      className={
        embedded
          ? "h-full min-h-0"
          : "h-full min-h-0 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-[10px]"
      }
    >
      {!embedded && (
        <div className="startup-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">Tokenized Assets</div>
      )}
      <div
        ref={scrollerRef}
        className={
          embedded
            ? "h-full min-h-0 space-y-2 overflow-auto rounded-xl border border-white/10 p-3 font-mono text-xs"
            : "h-[calc(100%-1.25rem)] min-h-0 space-y-2 overflow-auto rounded-xl border border-white/10 p-3 font-mono text-xs"
        }
      >
        {tokens.length === 0 ? (
          <div className="startup-empty rounded px-2 py-1.5 font-mono text-xs">
            No tokens yet. Edit source in The Pitch Deck to generate a token stream.
          </div>
        ) : (
        tokensByLine.map(([line, lineTokens]) => (
          <div key={`line-${line}`} className="rounded-lg border border-transparent bg-transparent">
            <div className="border-b border-white/8 bg-black/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Line {line}
            </div>
            <div className="space-y-1 p-1.5">
              {lineTokens.map(({ token, index }) => {
                const isHighlighted = highlightedSet.has(index);
                const isError = errorSet.has(index);
                const range: HoverRange = {
                  startLine: token.line,
                  startColumn: token.column,
                  endLine: token.line,
                  endColumn: token.column + token.value.length,
                };

                return (
                  <button
                    type="button"
                    key={`${token.line}-${token.column}-${token.value}`}
                    ref={(element) => {
                      tokenItemRefs.current[index] = element;
                    }}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition-colors duration-150 hover:bg-white/10 ${
                      isError
                        ? "border-rose-400/60 bg-rose-500/15"
                        : isHighlighted
                        ? "border-[#60A5FA]/55 bg-[#60A5FA]/14"
                        : "border-white/5 bg-black/10 hover:border-white/20"
                    }`}
                    onMouseEnter={() => onTokenHover(range)}
                    onMouseLeave={() => onTokenHover(null)}
                    onClick={() => onTokenClick?.(index)}
                    aria-disabled={!onTokenClick}
                    data-testid={`token-item-${index}`}
                    data-token-index={index}
                    data-highlighted={isHighlighted ? "true" : "false"}
                    data-error={isError ? "true" : "false"}
                  >
                    <span className="text-zinc-500">[{token.type}]</span>
                    <span className={tokenColorClass(token.type)}>{token.value}</span>
                    <span className="ml-auto text-zinc-500">
                      {token.line}:{token.column}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )))}
      </div>
    </div>
  );
}
