"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ASTPanel } from "@/components/ASTPanel";
import { EditorPanel, HoverRange } from "@/components/EditorPanel";
import { IRPanel } from "@/components/IRPanel";
import { ParserTracePanel } from "@/components/ParserTracePanel";
import { ScopePanel } from "@/components/ScopePanel";
import { TimelineControls } from "@/components/TimelineControls";
import { TokenPanel } from "@/components/TokenPanel";
import { TypeCheckPanel } from "@/components/TypeCheckPanel";
import { PRELOADED_DEMO } from "@/lib/startup/demo";
import { executeAst } from "@/lib/startup/executor";
import { ParserError, ParserTraceStep, parseTokensToAstWithTrace } from "@/lib/startup/parser";
import { AstNodeData, buildReactFlowGraph } from "@/lib/startup/reactflow";
import { analyzeSemantics, SemanticResult } from "@/lib/startup/semantic";
import { nextStep, prevStep, stepAt } from "@/lib/startup/timeline";
import { tokenize } from "@/lib/startup/tokenizer";
import type { ASTNode, IRInstruction, Timeline, Token } from "@/lib/startup/types";
import type { Edge, Node } from "@xyflow/react";

type PipelineResult = {
  tokens: Token[];
  ast: ASTNode | null;
  parserTrace: ParserTraceStep[];
  semantic: SemanticResult;
  timeline: Timeline;
  ir: IRInstruction[];
  graph: { nodes: Node<AstNodeData>[]; edges: Edge[] };
  nodeById: Record<string, ASTNode>;
  errorTokenIndexes: number[];
  errorNodeIds: string[];
  errorLine: number | null;
  errorColumn: number | null;
  errorStartToken: number | null;
  errorEndToken: number | null;
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

const rangeFromTokenSpan = (
  tokens: Token[],
  startToken: number | null,
  endToken: number | null,
): HoverRange | null => {
  if (startToken === null || endToken === null) {
    return null;
  }

  const start = tokens[startToken];
  const end = tokens[endToken] ?? start;

  if (!start || !end) {
    return null;
  }

  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column + end.value.length,
  };
};

const playbookTokenClass = (token: string): string => {
  if (["BURN", "VIBE", "EQUITY", "PORTFOLIO", "Burn", "Vibe", "Equity", "Portfolio"].includes(token)) {
    if (token === "BURN" || token === "Burn") return "text-[#60A5FA]";
    if (token === "VIBE" || token === "Vibe") return "text-[#34D399]";
    if (token === "EQUITY" || token === "Equity") return "text-[#F472B6]";
    return "text-[#A78BFA]";
  }

  if (["PIVOT", "SPRINT", "PITCH", "ACQUIRE", "EXIT", "AND", "OR", "NOT"].includes(token)) {
    return "text-[#93C5FD]";
  }

  if (["VESTED", "CLIFF"].includes(token)) {
    return "text-[#FBBF24]";
  }

  if (["::>", "+++", "---", "******", "///", ">>>", "<<<", "???", "!!?"].includes(token)) {
    return "text-[#F472B6]";
  }

  if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
    return "text-[#FBBF24]";
  }

  if (/^".*"$/.test(token)) {
    return "text-[#34D399]";
  }

  return "text-zinc-100";
};

const renderPlaybookCode = (snippet: string) => {
  const parts = snippet.match(/(\"[^\"]*\"|::>|\+\+\+|---|\*{6}|\/{3}|>{3}|<{3}|\?{3}|!!\?|[()[\]?,]|\b[a-zA-Z_][\w]*\b|\d+(?:\.\d+)?|\s+|.)/g) ?? [snippet];
  let cursor = 0;

  return (
    <code className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[11px]">
      {parts.map((part) => {
        const key = `${part}-${cursor}`;
        cursor += part.length;
        if (/^\s+$/.test(part)) {
          return <span key={`ws-${key}`}>{part}</span>;
        }

        return (
          <span key={key} className={playbookTokenClass(part)}>
            {part}
          </span>
        );
      })}
    </code>
  );
};

export function StartupCompilerApp() {
  const [source, setSource] = useState(PRELOADED_DEMO);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [hoverRange, setHoverRange] = useState<HoverRange | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeHeaderTab, setActiveHeaderTab] = useState<"pipeline" | "quick">("pipeline");
  const [bottomTab, setBottomTab] = useState<
    "tokens" | "parser" | "runtime" | "state" | "ir" | "scope"
  >("tokens");
  const [runtimeTab, setRuntimeTab] = useState<"events" | "output" | "errors">("events");
  const [selectedAstNodeId, setSelectedAstNodeId] = useState<string | null>(null);
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [parserStepIndex, setParserStepIndex] = useState(0);
  const [issueJumpIndex, setIssueJumpIndex] = useState(-1);

  const quickReferenceSections = [
    {
      title: "Variables & Types",
      items: [
        "BURN (number): BURN burnRate ::> 1200?",
        "VIBE (string): VIBE vibe ::> \"focus\"?",
        "EQUITY (boolean): EQUITY isFunded ::> VESTED?",
        "PORTFOLIO (list): PORTFOLIO milestones ::> [\"mvp\", \"launch\"]?",
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
        "PIVOT (if): PIVOT (burnRate >>> 1000) [ PITCH \"cut spend\"? ]",
        "SPRINT (for): SPRINT (runway <<< 6) [ PITCH \"raise now\"? ]",
      ],
    },
    {
      title: "I/O",
      items: [
        "PITCH/ACQUIRE/EXIT: PITCH founderName?, ACQUIRE founderName?, EXIT?",
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
      ir: [],
      graph: { nodes: [], edges: [] },
      nodeById: {},
      errorTokenIndexes: [],
      errorNodeIds: [],
      errorLine: null,
      errorColumn: null,
      errorStartToken: null,
      errorEndToken: null,
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
      const executed = executeAst(parsed.ast);
      result.timeline = executed.timeline;
      result.ir = executed.ir;
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

      if (error instanceof ParserError) {
        result.errorLine = error.line;
        result.errorColumn = error.column;
        result.errorStartToken = error.startToken;
        result.errorEndToken = error.endToken;
        result.errorTokenIndexes = result.tokens
          .map((_token, index) => index)
          .filter((index) => index >= error.startToken && index <= error.endToken);
        result.errorNodeIds = findErrorNodeIds(result.ast, error.line);
      } else {
        const { line, column } = parseLineColumnFromError(message);
        result.errorLine = line;
        result.errorColumn = column;
        result.errorTokenIndexes = findErrorTokenIndexes(result.tokens, line, column);
        result.errorNodeIds = findErrorNodeIds(result.ast, line);
      }
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

  const focusSourceLocation = useCallback((line: number, column: number | null) => {
    setSelectedLine(line);

    const tokenIndexes = findErrorTokenIndexes(pipeline.tokens, line, column);
    setSelectedTokenIndex(tokenIndexes.length > 0 ? tokenIndexes[0] : null);

    const nodeIds = findErrorNodeIds(pipeline.ast, line);
    setSelectedAstNodeId(nodeIds.length > 0 ? nodeIds[0] : null);
  }, [pipeline.ast, pipeline.tokens]);

  const focusErrorByStage = (stage: "tokens" | "ast" | "semantic" | "execution") => {
    if (stage === "semantic" && pipeline.semantic.issues.length > 0) {
      const issue = pipeline.semantic.issues[0];
      focusSourceLocation(issue.line, issue.column);
      setBottomTab("state");
      return;
    }

    if (stage === "execution") {
      setBottomTab("runtime");
      setRuntimeTab("errors");
      if (pipeline.errorLine !== null) {
        focusSourceLocation(pipeline.errorLine, pipeline.errorColumn);
      }
      return;
    }

    if (pipeline.errorLine !== null) {
      focusSourceLocation(pipeline.errorLine, pipeline.errorColumn);
    }

    setBottomTab(stage === "ast" ? "parser" : "tokens");
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

  const jumpToNextIssue = useCallback(() => {
    if (mappedErrors.length === 0) {
      return;
    }

    const nextIndex = (issueJumpIndex + 1) % mappedErrors.length;
    const entry = mappedErrors[nextIndex];

    setIssueJumpIndex(nextIndex);
    focusSourceLocation(entry.line, entry.column);

    if (entry.kind === "semantic") {
      setBottomTab("state");
      return;
    }

    if (pipeline.errorStage === "execution") {
      setBottomTab("runtime");
      setRuntimeTab("errors");
      return;
    }

    setBottomTab("tokens");
  }, [focusSourceLocation, issueJumpIndex, mappedErrors, pipeline.errorStage]);

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
        setSelectedAstNodeId(null);
        setSelectedTokenIndex(null);
        setStepIndex((current) => prevStep(pipeline.timeline, current));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedAstNodeId(null);
        setSelectedTokenIndex(null);
        setStepIndex((current) => nextStep(pipeline.timeline, current));
      }

      if (event.key.toLowerCase() === "n" && event.altKey) {
        event.preventDefault();
        jumpToNextIssue();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeHeaderTab, jumpToNextIssue, pipeline.timeline]);

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

  const parserErrorRange = useMemo(
    () => rangeFromTokenSpan(pipeline.tokens, pipeline.errorStartToken, pipeline.errorEndToken),
    [pipeline.errorEndToken, pipeline.errorStartToken, pipeline.tokens],
  );

  const diagnostics = [
    {
      id: "tokens" as const,
      label: "Tokenizer",
      count: pipeline.errorStage === "tokens" && pipeline.error ? 1 : 0,
      preview: pipeline.errorStage === "tokens" ? (pipeline.error ?? "") : "No tokenizer issues",
      tone: "border-amber-300/40 text-amber-200",
    },
    {
      id: "ast" as const,
      label: "Parser",
      count: pipeline.errorStage === "ast" && pipeline.error ? 1 : 0,
      preview: pipeline.errorStage === "ast" ? (pipeline.error ?? "") : "No parser issues",
      tone: "border-sky-300/40 text-sky-200",
    },
    {
      id: "semantic" as const,
      label: "Semantic",
      count: pipeline.semantic.issues.length,
      preview: pipeline.semantic.issues[0]?.message ?? "No semantic issues",
      tone: "border-fuchsia-300/40 text-fuchsia-200",
    },
    {
      id: "execution" as const,
      label: "Runtime",
      count: pipeline.errorStage === "execution" && pipeline.error ? 1 : 0,
      preview: pipeline.errorStage === "execution" ? (pipeline.error ?? "") : "No runtime issues",
      tone: "border-rose-300/40 text-rose-200",
    },
  ];

  return (
    <div className="startup-shell relative h-[100dvh] overflow-hidden bg-[#090A0D] px-5 py-5 text-white selection:bg-white/20">
      <div className="relative mx-auto flex h-full min-h-0 max-w-[1500px] flex-col gap-4">
        <div className="startup-island rounded-2xl px-4 py-2 text-xs tracking-wide text-zinc-300 backdrop-blur-[10px]">
          <div className="startup-gap flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveHeaderTab("pipeline")}
                data-testid="header-tab-pipeline"
                className={`startup-tab-btn rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  activeHeaderTab === "pipeline" ? "active" : ""
                }`}
              >
                Growth Engine
              </button>
              <button
                type="button"
                onClick={() => setActiveHeaderTab("quick")}
                data-testid="header-tab-quick"
                className={`startup-tab-btn rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                  activeHeaderTab === "quick" ? "active" : ""
                }`}
              >
                Founder&apos;s Playbook
              </button>
            </div>
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
              onScrub={(index) => {
                setStepIndex(index);
                setSelectedTokenIndex(null);
                setSelectedAstNodeId(null);
              }}
            />

            <div className="startup-island rounded-2xl px-3 py-2 backdrop-blur-[10px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Diagnostics</div>
                <button
                  type="button"
                  onClick={jumpToNextIssue}
                  className="rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-300 transition hover:bg-white/10"
                >
                  Next Issue (Alt+N)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {diagnostics.map((diag) => (
                  <button
                    key={diag.id}
                    type="button"
                    onClick={() => focusErrorByStage(diag.id)}
                    data-testid={`diagnostic-${diag.id}`}
                    className={`rounded border bg-white/5 px-2 py-1 text-left transition hover:bg-white/10 ${diag.tone}`}
                  >
                    <div className="font-mono text-[11px]">
                      <span className="mr-1 text-zinc-500">{diag.label}</span>
                      <span>{diag.count}</span>
                    </div>
                    <div className="max-w-[260px] truncate font-mono text-[10px] text-zinc-400">
                      {diag.preview}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.4fr)_minmax(180px,1fr)] gap-4 startup-gap">
              <div className="relative grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="startup-hero-glow pointer-events-none absolute inset-0 -z-10 rounded-2xl" />
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
                  errorRange={parserErrorRange}
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

              <div className="startup-island startup-roomy-sm flex min-h-0 flex-col rounded-2xl p-3 backdrop-blur-[10px]">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {[
                    { id: "tokens", label: "Tokenized Assets" },
                    { id: "parser", label: "Parser Mode" },
                    { id: "runtime", label: "Runtime" },
                    { id: "state", label: "State" },
                    { id: "ir", label: "IR + Stack" },
                    { id: "scope", label: "Scope" },
                  ].map((tab) => {
                    const active = bottomTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBottomTab(tab.id as typeof bottomTab)}
                        data-testid={`bottom-tab-${tab.id}`}
                        className={`startup-tab-btn rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${active ? "active" : ""}`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-0 flex-1">
                  {bottomTab === "tokens" && (
                    <div className="startup-panel-enter h-full min-h-0">
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
                    </div>
                  )}

                  {bottomTab === "parser" && (
                    <div className="startup-panel-enter h-full min-h-0">
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
                    </div>
                  )}

                  {bottomTab === "runtime" && (
                    <div className="startup-panel-enter flex h-full min-h-0 flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "events", label: "Events" },
                          { id: "output", label: "Output" },
                          { id: "errors", label: "Errors" },
                        ].map((tab) => {
                          const active = runtimeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setRuntimeTab(tab.id as typeof runtimeTab)}
                              data-testid={`runtime-tab-${tab.id}`}
                              className={`startup-tab-btn rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${active ? "active" : ""}`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {runtimeTab === "events" && (
                        <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
                          {executionLog.length > 0
                            ? executionLog
                            : "Run a phase to generate runtime events and execution traces."}
                        </div>
                      )}

                      {runtimeTab === "output" && (
                        <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-2 font-mono text-xs text-zinc-100">
                          {terminalOutput.length > 0
                            ? terminalOutput.join("\n")
                            : "No output yet. Use LAUNCH MVP or step through execution to produce output."}
                        </div>
                      )}

                      {runtimeTab === "errors" && (
                        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2">
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                            Error Arrows
                          </div>
                          <div className="space-y-1">
                            {mappedErrors.length === 0 ? (
                              <div className="startup-empty rounded px-2 py-1 font-mono text-xs">
                                No mapped errors. If parser or semantic issues appear, jump links show up here.
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
                                  data-testid={`runtime-error-${entry.kind}-${entry.line}-${entry.column ?? 0}`}
                                  className="w-full rounded border border-rose-300/30 bg-rose-500/10 px-2 py-1.5 text-left font-mono text-xs text-rose-200 transition hover:border-rose-200/60 hover:bg-rose-500/15"
                                >
                                  <div className="grid grid-cols-[minmax(0,1fr)_56px_auto] items-center gap-2">
                                    <div className="min-w-0 truncate">
                                      <span className="text-rose-300">[{entry.kind.toUpperCase()}]</span> {entry.label}
                                    </div>
                                    <svg
                                      className="h-3 w-14 text-rose-300/90"
                                      viewBox="0 0 56 12"
                                      fill="none"
                                      aria-hidden="true"
                                    >
                                      <line x1="2" y1="6" x2="50" y2="6" stroke="currentColor" strokeWidth="1.2" />
                                      <path d="M50 2 L54 6 L50 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="rounded border border-rose-300/35 bg-rose-400/10 px-1.5 py-0.5 text-[11px] text-rose-200">
                                      L{entry.line}
                                      {entry.column !== null ? `:C${entry.column}` : ""}
                                    </span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {bottomTab === "state" && (
                    <div className="startup-panel-enter grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20">
                        <div className="sticky top-0 z-10 border-b border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                          Runtime Cap Table
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
                                    No variables yet. Execute at least one step to populate runtime state.
                                  </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <TypeCheckPanel
                        embedded
                        entries={pipeline.semantic.entries}
                        issues={pipeline.semantic.issues}
                        onIssueSelect={(line, column) => {
                          focusSourceLocation(line, column);
                          setBottomTab("tokens");
                        }}
                      />
                    </div>
                  )}

                  {bottomTab === "ir" && (
                    <div className="startup-panel-enter h-full min-h-0">
                      <IRPanel
                        instructions={pipeline.ir}
                        stack={activeStep?.stack ?? []}
                        activeLine={activeStep?.line ?? null}
                      />
                    </div>
                  )}

                  {bottomTab === "scope" && (
                    <div className="startup-panel-enter h-full min-h-0">
                      <ScopePanel scopes={activeStep?.scopes ?? []} />
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
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Token Legend</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                    <span className="text-[#60A5FA]">BURN = number</span>
                    <span className="text-[#34D399]">VIBE = string</span>
                    <span className="text-[#F472B6]">EQUITY = boolean</span>
                    <span className="text-[#A78BFA]">PORTFOLIO = list</span>
                    <span className="text-[#93C5FD]">Control and I/O keywords</span>
                    <span className="text-[#FBBF24]">Numeric and state literals</span>
                  </div>
                </div>
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
                            {section.title === "Control Flow" && label === "PIVOT (if)" && (
                              <span className="rounded border border-[#60A5FA]/35 bg-[#60A5FA]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#93C5FD]">
                                if
                              </span>
                            )}
                            {section.title === "Control Flow" && label === "SPRINT (for)" && (
                              <span className="rounded border border-[#60A5FA]/35 bg-[#60A5FA]/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#93C5FD]">
                                for
                              </span>
                            )}
                            {renderPlaybookCode(code)}
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
