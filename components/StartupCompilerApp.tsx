"use client";

import { useEffect, useMemo, useState } from "react";

import { ASTPanel } from "@/components/ASTPanel";
import { EditorPanel, HoverRange } from "@/components/EditorPanel";
import { ParserTracePanel } from "@/components/ParserTracePanel";
import { TimelineControls } from "@/components/TimelineControls";
import { TokenPanel } from "@/components/TokenPanel";
import { TypeCheckPanel } from "@/components/TypeCheckPanel";
import { PRELOADED_DEMO } from "@/lib/startup/demo";
import { executeAst } from "@/lib/startup/executor";
import { ParserTraceStep, parseTokensToAstWithTrace } from "@/lib/startup/parser";
import { AstNodeData, buildReactFlowGraph } from "@/lib/startup/reactflow";
import { analyzeSemantics, SemanticResult } from "@/lib/startup/semantic";
import { nextStep, prevStep, stepAt } from "@/lib/startup/timeline";
import { tokenize } from "@/lib/startup/tokenizer";
import type { ASTNode, Timeline, Token } from "@/lib/startup/types";
import type { Edge, Node } from "@xyflow/react";

type PipelineResult = {
  tokens: Token[];
  ast: ASTNode | null;
  parserTrace: ParserTraceStep[];
  semantic: SemanticResult;
  timeline: Timeline;
  graph: { nodes: Node<AstNodeData>[]; edges: Edge[] };
  nodeById: Record<string, ASTNode>;
  errorTokenIndexes: number[];
  errorNodeIds: string[];
  errorLine: number | null;
  errorColumn: number | null;
  errorStage: "source" | "tokens" | "ast" | "execution";
  error: string | null;
};

const emptySemantic: SemanticResult = {
  entries: [],
  symbolTable: {},
  issues: [],
};

const collectAstNodes = (node: ASTNode): ASTNode[] => {
  const nodes: ASTNode[] = [node];
  (node.children ?? []).forEach((child) => {
    nodes.push(...collectAstNodes(child));
  });
  return nodes;
};

const parseLineColumnFromError = (message: string): { line: number | null; column: number | null } => {
  const lineColumnMatch = message.match(/(?:at|line)\s+(\d+):(\d+)/i);
  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2]),
    };
  }

  const lineOnlyMatch = message.match(/line\s+(\d+)/i);
  if (lineOnlyMatch) {
    return {
      line: Number(lineOnlyMatch[1]),
      column: null,
    };
  }

  return { line: null, column: null };
};

const findErrorTokenIndexes = (tokens: Token[], line: number | null, column: number | null): number[] => {
  if (line === null) {
    return [];
  }

  const onLine = tokens
    .map((token, index) => ({ token, index }))
    .filter((entry) => entry.token.line === line);

  if (onLine.length === 0) {
    return [];
  }

  if (column === null) {
    return [onLine[0].index];
  }

  const exact = onLine.find((entry) => entry.token.column === column);
  if (exact) {
    return [exact.index];
  }

  const nearest = onLine.reduce((prev, current) => {
    const prevDelta = Math.abs(prev.token.column - column);
    const currentDelta = Math.abs(current.token.column - column);
    return currentDelta < prevDelta ? current : prev;
  });

  return [nearest.index];
};

const findErrorNodeIds = (ast: ASTNode | null, line: number | null): string[] => {
  if (!ast || line === null) {
    return [];
  }

  const nodes = collectAstNodes(ast).filter((node) => node.type !== "Program");
  const exact = nodes.filter((node) => node.line === line);
  if (exact.length > 0) {
    return exact.map((node) => node.id);
  }

  const nearest = nodes.reduce<ASTNode | null>((best, node) => {
    if (!best) {
      return node;
    }
    return Math.abs(node.line - line) < Math.abs(best.line - line) ? node : best;
  }, null);

  return nearest ? [nearest.id] : [];
};

export function StartupCompilerApp() {
  const [source, setSource] = useState(PRELOADED_DEMO);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoverRange, setHoverRange] = useState<HoverRange | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeHeaderTab, setActiveHeaderTab] = useState<"pipeline" | "quick">("pipeline");
  const [bottomTab, setBottomTab] = useState<
    "tokens" | "types" | "parser" | "logs" | "output" | "state"
  >("tokens");
  const [selectedAstNodeId, setSelectedAstNodeId] = useState<string | null>(null);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [parserStepIndex, setParserStepIndex] = useState(0);

  const quickReferenceSections = [
    {
      title: "Variables & Types",
      items: [
        "Burn (number): Burn burnRate ::> 1200?",
        "Vibe (string): Vibe vibe ::> \"focus\"?",
        "Equity (boolean): Equity isFunded ::> VESTED?",
        "Portfolio (list): Portfolio milestones ::> [\"mvp\", \"launch\"]?",
      ],
    },
    {
      title: "Assignment & Terminator",
      items: [
        "Assign: runway ::> 18?",
        "Reassign: runway ::> runway --- 1?",
        "Terminator: ?",
      ],
    },
    {
      title: "Arithmetic",
      items: [
        "Add/Sub: cash +++ revenue, burnRate --- savings",
        "Mul/Div: users ****** 2, runway /// months",
      ],
    },
    {
      title: "Comparison",
      items: [
        "Equal/Not: stage ??? \"seed\", stage !!? \"exit\"",
        "Greater/Less: burnRate >>> 1000, runway <<< 6",
      ],
    },
    {
      title: "Logic",
      items: [
        "AND/OR/NOT: isFunded AND hasRevenue, isBootstrapped OR hasGrants, NOT hasDebt",
      ],
    },
    {
      title: "Control Flow",
      items: [
        "PIVOT: PIVOT (burnRate >>> 1000) [ PITCH \"cut spend\"? ]",
        "SPRINT: SPRINT (runway <<< 6) [ PITCH \"raise now\"? ]",
      ],
    },
    {
      title: "I/O",
      items: [
        "PITCH/ACQUIRE/EXIT: PITCH founderName?, ACQUIRE founderName?, PITCH founderName?, EXIT?",
      ],
    },
    {
      title: "Comments",
      items: ["Line: // this is a comment"],
    },
    {
      title: "Naming Convention",
      items: ["Variables: camelCase"],
    },
  ];

  const pipeline = useMemo<PipelineResult>(() => {
    const result: PipelineResult = {
      tokens: [],
      ast: null,
      parserTrace: [],
      semantic: emptySemantic,
      timeline: [],
      graph: { nodes: [], edges: [] },
      nodeById: {},
      errorTokenIndexes: [],
      errorNodeIds: [],
      errorLine: null,
      errorColumn: null,
      errorStage: "source",
      error: null,
    };

    try {
      result.errorStage = "tokens";
      result.tokens = tokenize(source);

      result.errorStage = "ast";
      const parsed = parseTokensToAstWithTrace(result.tokens);
      result.ast = parsed.ast;
      result.parserTrace = parsed.trace;
      result.semantic = analyzeSemantics(parsed.ast);

      if (result.ast) {
        const nodes = collectAstNodes(result.ast);
        nodes.forEach((node) => {
          result.nodeById[node.id] = node;
        });
      }

      result.errorStage = "execution";
      result.timeline = executeAst(parsed.ast);
      result.graph = buildReactFlowGraph(parsed.ast);

      if (result.semantic.issues.length > 0) {
        const firstIssue = result.semantic.issues[0];
        result.errorTokenIndexes = findErrorTokenIndexes(
          result.tokens,
          firstIssue.line,
          firstIssue.column,
        );
        result.errorNodeIds = findErrorNodeIds(result.ast, firstIssue.line);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown compiler error";
      result.error = message;

      const { line, column } = parseLineColumnFromError(message);
      result.errorLine = line;
      result.errorColumn = column;
      result.errorTokenIndexes = findErrorTokenIndexes(result.tokens, line, column);
      result.errorNodeIds = findErrorNodeIds(result.ast, line);
    }

    return result;
  }, [source]);

  const activeStep = stepAt(pipeline.timeline, stepIndex);
  const logTimeline = pipeline.timeline.slice(0, stepIndex + 1).map((step) => step.log);
  const executionLog = pipeline.error
    ? `[ERROR] ${pipeline.error}`
    : logTimeline.join("\n");
  const terminalOutput = pipeline.error
    ? []
    : activeStep?.output ?? [];

  const focusSourceLocation = (line: number, column: number | null) => {
    setSelectedLine(line);

    const tokenIndexes = findErrorTokenIndexes(pipeline.tokens, line, column);
    setSelectedTokenIndex(tokenIndexes.length > 0 ? tokenIndexes[0] : null);

    const nodeIds = findErrorNodeIds(pipeline.ast, line);
    setSelectedAstNodeId(nodeIds.length > 0 ? nodeIds[0] : null);
  };

  const mappedErrors = useMemo(() => {
    const semanticErrors = pipeline.semantic.issues.map((issue) => ({
      key: `semantic-${issue.message}-${issue.line}-${issue.column}`,
      label: issue.message,
      line: issue.line,
      column: issue.column,
      kind: "semantic" as const,
    }));

    const compilerError = pipeline.errorLine !== null
      ? [
          {
            key: `compiler-${pipeline.errorLine}-${pipeline.errorColumn ?? 0}`,
            label: pipeline.error ?? "Compiler error",
            line: pipeline.errorLine,
            column: pipeline.errorColumn,
            kind: "compiler" as const,
          },
        ]
      : [];

    return [...compilerError, ...semanticErrors];
  }, [
    pipeline.error,
    pipeline.errorColumn,
    pipeline.errorLine,
    pipeline.semantic.issues,
  ]);

  const handlePrev = () => {
    setSelectedAstNodeId(null);
    setSelectedTokenIndex(null);
    setStepIndex((current) => prevStep(pipeline.timeline, current));
  };

  const handleNext = () => {
    setSelectedAstNodeId(null);
    setSelectedTokenIndex(null);
    setStepIndex((current) => nextStep(pipeline.timeline, current));
  };

  const handleRunCode = () => {
    if (pipeline.timeline.length === 0) {
      return;
    }

    setSelectedAstNodeId(null);
    setSelectedTokenIndex(null);
    setStepIndex(pipeline.timeline.length - 1);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (activeHeaderTab !== "pipeline") {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((current) => prevStep(pipeline.timeline, current));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStepIndex((current) => nextStep(pipeline.timeline, current));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeHeaderTab, pipeline.timeline]);

  const highlightedTokenIndexes = useMemo(() => {
    if (selectedAstNodeId) {
      const node = pipeline.nodeById[selectedAstNodeId];
      if (node?.startToken !== undefined && node?.endToken !== undefined) {
        const { startToken, endToken } = node;
        return pipeline.tokens
          .map((_token, index) => index)
          .filter((index) => index >= startToken && index <= endToken);
      }
    }

    if (selectedTokenIndex !== null) {
      return [selectedTokenIndex];
    }

    if (activeStep) {
      const activeNode = pipeline.nodeById[activeStep.activeNodeId];
      if (activeNode?.startToken !== undefined && activeNode?.endToken !== undefined) {
        const { startToken, endToken } = activeNode;
        return pipeline.tokens
          .map((_token, index) => index)
          .filter((index) => index >= startToken && index <= endToken);
      }
    }

    return [];
  }, [activeStep, pipeline.nodeById, pipeline.tokens, selectedAstNodeId, selectedTokenIndex]);

  const highlightedNodeIds = useMemo(() => {
    if (selectedAstNodeId) {
      return [selectedAstNodeId];
    }

    if (selectedTokenIndex !== null && pipeline.ast) {
      return collectAstNodes(pipeline.ast)
        .filter((node) => {
          if (node.type === "Program") {
            return false;
          }

          if (node.startToken === undefined || node.endToken === undefined) {
            return false;
          }

          return selectedTokenIndex >= node.startToken && selectedTokenIndex <= node.endToken;
        })
        .map((node) => node.id);
    }

    if (activeStep?.activeNodeId) {
      return [activeStep.activeNodeId];
    }

    return [];
  }, [activeStep, pipeline.ast, selectedAstNodeId, selectedTokenIndex]);

  const parserIndexForTimeline = useMemo(() => {
    if (pipeline.parserTrace.length === 0) {
      return 0;
    }

    if (!activeStep) {
      return 0;
    }

    const byNodeId = pipeline.parserTrace.findIndex((step) => step.nodeId === activeStep.activeNodeId);
    if (byNodeId >= 0) {
      return byNodeId;
    }

    const byLine = pipeline.parserTrace
      .map((step, index) => ({ step, index }))
      .filter((entry) => entry.step.line <= activeStep.line)
      .map((entry) => entry.index);

    return byLine.length > 0 ? byLine[byLine.length - 1] : 0;
  }, [activeStep, pipeline.parserTrace]);

  useEffect(() => {
    setParserStepIndex(parserIndexForTimeline);
  }, [parserIndexForTimeline]);

  return (
    <div className="startup-shell relative h-[100dvh] overflow-hidden bg-[#090A0D] px-5 py-5 text-white selection:bg-white/20">
      {/* Linear-style subtle background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      
      <div className="relative mx-auto flex h-full min-h-0 max-w-[1500px] flex-col gap-4">
        <div className="startup-island rounded-2xl px-4 py-2 text-xs tracking-wide text-zinc-300 backdrop-blur-[10px]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveHeaderTab("pipeline")}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  activeHeaderTab === "pipeline"
                    ? "border-[#60A5FA]/55 bg-[#60A5FA]/14 text-[#93C5FD]"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-[#60A5FA]/35 hover:text-[#93C5FD]"
                }`}
              >
                Growth Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveHeaderTab("quick")}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  activeHeaderTab === "quick"
                    ? "border-[#60A5FA]/55 bg-[#60A5FA]/14 text-[#93C5FD]"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-[#60A5FA]/35 hover:text-[#93C5FD]"
                }`}
              >
                Founder&apos;s Playbook
              </button>
            </div>
            {activeHeaderTab === "pipeline" && null}
          </div>
        </div>

        {activeHeaderTab === "pipeline" ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <TimelineControls
              stepIndex={stepIndex}
              total={pipeline.timeline.length}
              onPrev={handlePrev}
              onNext={handleNext}
              onRunCode={handleRunCode}
            />

            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.4fr)_minmax(180px,1fr)] gap-4">
              <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <EditorPanel
                  value={source}
                  onChange={(nextValue) => {
                    setSource(nextValue);
                    setStepIndex(0);
                    setSelectedAstNodeId(null);
                    setSelectedTokenIndex(null);
                    setParserStepIndex(0);
                  }}
                  activeLine={activeStep?.line ?? 1}
                  selectedLine={selectedLine}
                  hoverRange={hoverRange}
                />

                <ASTPanel
                  nodes={pipeline.graph.nodes}
                  edges={pipeline.graph.edges}
                  activeNodeId={activeStep?.activeNodeId ?? ""}
                  highlightedNodeIds={highlightedNodeIds}
                  errorNodeIds={pipeline.errorNodeIds}
                  onNodeSelect={(nodeId, line) => {
                    setSelectedLine(line);
                    setSelectedAstNodeId(nodeId);
                    setSelectedTokenIndex(null);
                  }}
                />
              </div>

              <div className="startup-island flex min-h-0 flex-col rounded-2xl p-3 backdrop-blur-[10px]">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {[
                    { id: "tokens", label: "Tokenized Assets" },
                    { id: "types", label: "Type Check" },
                    { id: "parser", label: "Parser Mode" },
                    { id: "logs", label: "Investor Updates" },
                    { id: "output", label: "Traction" },
                    { id: "state", label: "Cap Table" },
                  ].map((tab) => {
                    const active = bottomTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBottomTab(tab.id as typeof bottomTab)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                          active
                            ? "border-[#60A5FA]/55 bg-[#60A5FA]/14 text-[#93C5FD]"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:border-[#60A5FA]/35 hover:text-[#93C5FD]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-0 flex-1">
                  {bottomTab === "tokens" && (
                    <TokenPanel
                      embedded
                      tokens={pipeline.tokens}
                      highlightedTokenIndexes={highlightedTokenIndexes}
                      errorTokenIndexes={pipeline.errorTokenIndexes}
                      onTokenHover={setHoverRange}
                      onTokenClick={(tokenIndex) => {
                        setSelectedTokenIndex(tokenIndex);
                        setSelectedAstNodeId(null);
                      }}
                    />
                  )}

                  {bottomTab === "types" && (
                    <TypeCheckPanel
                      embedded
                      entries={pipeline.semantic.entries}
                      issues={pipeline.semantic.issues}
                      onIssueSelect={(line, column) => {
                        focusSourceLocation(line, column);
                        setBottomTab("tokens");
                      }}
                    />
                  )}

                  {bottomTab === "parser" && (
                    <ParserTracePanel
                      trace={pipeline.parserTrace}
                      activeIndex={parserStepIndex}
                      onSelect={(index) => {
                        setParserStepIndex(index);
                        const step = pipeline.parserTrace[index];
                        if (!step) {
                          return;
                        }

                        if (step.nodeId) {
                          const targetNode = pipeline.nodeById[step.nodeId];
                          if (targetNode) {
                            setSelectedLine(targetNode.line);
                          }
                          setSelectedAstNodeId(step.nodeId);
                        } else {
                          setSelectedAstNodeId(null);
                        }

                        setSelectedTokenIndex(step.startToken);
                      }}
                    />
                  )}

                  {bottomTab === "logs" && (
                    <div className="grid h-full min-h-0 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
                        {executionLog}
                      </div>
                      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                          Error Arrows
                        </div>
                        <div className="space-y-1">
                          {mappedErrors.length === 0 ? (
                            <div className="rounded border border-white/10 px-2 py-1 font-mono text-xs text-zinc-500">
                              No mapped errors
                            </div>
                          ) : (
                            mappedErrors.map((entry) => (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => {
                                  focusSourceLocation(entry.line, entry.column);
                                  setBottomTab("tokens");
                                }}
                                className="w-full rounded border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-left font-mono text-xs text-rose-200 transition hover:border-rose-200/60 hover:bg-rose-500/15"
                              >
                                <span className="text-rose-300">[{entry.kind.toUpperCase()}]</span> {entry.label}
                                <span className="ml-2 text-rose-300/90">-&gt; L{entry.line}{entry.column !== null ? `:C${entry.column}` : ""}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {bottomTab === "output" && (
                    <div className="h-full min-h-0 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
                      {terminalOutput.length > 0 ? terminalOutput.join("\n") : "<no metrics yet>"}
                    </div>
                  )}

                  {bottomTab === "state" && (
                    <div className="h-full min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20">
                      <table className="w-full text-left font-mono text-xs text-zinc-100">
                        <thead className="border-b border-white/10 text-zinc-400">
                          <tr>
                            <th className="px-2 py-1">Name</th>
                            <th className="px-2 py-1">Type</th>
                            <th className="px-2 py-1">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStep ? (
                            Object.entries(activeStep.variables).map(([name, info]) => (
                              <tr key={name} className="border-b border-white/5 last:border-0">
                                <td className="px-2 py-1">{name}</td>
                                <td className="px-2 py-1">{info.type}</td>
                                <td className="px-2 py-1">{String(info.value)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-2 py-2 text-zinc-500" colSpan={3}>
                                No variables yet
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto py-6 pr-1">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6 text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-200">
                Founder&apos;s Playbook (.startup DSL)
              </div>
              <div className="grid gap-4 text-sm text-zinc-200">
                {quickReferenceSections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white">
                      {section.title}
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {section.items.map((item) => {
                        const colonIdx = item.indexOf(":");
                        if (colonIdx === -1) return <li key={item}>{item}</li>;
                        const label = item.slice(0, colonIdx);
                        const code = item.slice(colonIdx + 1).trim();
                        return (
                          <li key={item} className="flex flex-wrap items-baseline gap-2">
                            <span className="text-zinc-400">{label}:</span>
                            <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[11px] text-zinc-100">
                              {code}
                            </code>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
