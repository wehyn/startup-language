"use client";

import {
  Background,
  Edge,
  Node,
  NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { AstNodeData } from "@/lib/startup/reactflow";

type ASTPanelProps = {
  nodes: Node<AstNodeData>[];
  edges: Edge[];
  activeNodeId: string;
  highlightedNodeIds?: string[];
  errorNodeIds?: string[];
  onNodeSelect: (nodeId: string, line: number) => void;
};

const nodeAccentColor = (label: string): string => {
  if (label.startsWith("Declaration")) return "#60A5FA"; // blue
  if (label.startsWith("PITCH")) return "#34D399"; // green
  if (label.startsWith("ACQUIRE")) return "#FBBF24"; // amber
  if (label.startsWith("EXIT")) return "#F87171"; // red
  if (label.startsWith("PIVOT")) return "#A78BFA"; // violet
  if (label.startsWith("SPRINT")) return "#F472B6"; // pink
  return "#9CA3AF"; // gray fallback
};

function ASTPanelCanvas({ nodes, edges, activeNodeId, onNodeSelect }: ASTPanelProps) {
  const styledEdges = edges.map((edge) => ({
    ...edge,
    style: {
      ...edge.style,
      stroke: "rgba(255,255,255,0.15)",
      strokeWidth: 1,
    },
  }));

  const displayNodes = nodes.map((node) => {
    const isActive = node.id === activeNodeId;
    const isHighlighted = Boolean(node.data.highlighted);
    const isError = Boolean(node.data.error);
    const accent = nodeAccentColor(node.data.label);

    return {
      ...node,
      style: {
        borderRadius: 8,
        border: isError
          ? "1.5px solid rgba(248,113,113,0.95)"
          : isActive
          ? `1.5px solid ${accent}`
          : isHighlighted
          ? "1.5px solid rgba(16,185,129,0.7)"
          : "1px solid rgba(255,255,255,0.12)",
        background: isError
          ? "rgba(248,113,113,0.16)"
          : isActive
          ? `${accent}18`
          : isHighlighted
          ? "rgba(16,185,129,0.12)"
          : "rgba(255,255,255,0.03)",
        color: isError
          ? "#FCA5A5"
          : isActive
          ? accent
          : isHighlighted
          ? "#93C5FD"
          : "rgba(255,255,255,0.7)",
        opacity: isActive || isHighlighted || isError ? 1 : 0.55,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "var(--font-geist-mono), monospace",
        letterSpacing: "0.02em",
        width: 140,
        padding: "6px 10px",
        textAlign: "center" as const,
        transition: "all 180ms ease",
        boxShadow: isError
          ? "0 0 14px rgba(248,113,113,0.35)"
          : isActive
          ? `0 0 12px ${accent}30`
          : isHighlighted
          ? "0 0 12px rgba(96,165,250,0.28)"
          : "none",
      },
      data: {
        ...node.data,
        label: `${node.data.label} L${node.data.line}`,
      },
    };
  });

  const onNodeClick: NodeMouseHandler<Node<AstNodeData>> = (_evt, node) => {
    onNodeSelect(node.id, node.data.line);
  };

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={styledEdges}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.5}
      maxZoom={1.2}
      onNodeClick={onNodeClick}
      nodesDraggable={false}
      nodesConnectable={false}
      panOnDrag
      proOptions={{ hideAttribution: true }}
    >
      <Background color="rgba(255,255,255,0.06)" gap={20} size={1} />
    </ReactFlow>
  );
}

export function ASTPanel({
  nodes,
  edges,
  activeNodeId,
  highlightedNodeIds = [],
  errorNodeIds = [],
  onNodeSelect,
}: ASTPanelProps) {
  const highlightedNodeIdSet = new Set(highlightedNodeIds);
  const errorNodeIdSet = new Set(errorNodeIds);
  const preparedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      highlighted: highlightedNodeIdSet.has(node.id),
      error: errorNodeIdSet.has(node.id),
    },
  }));

  return (
    <div className="startup-island startup-roomy h-full min-h-0 rounded-2xl p-4 backdrop-blur-[10px]">
      <div className="startup-heading mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">Synergy Map (AST)</div>
      <div className="h-[calc(100%-1.25rem)] min-h-0 overflow-hidden rounded-xl border border-white/10">
        <ReactFlowProvider>
          <ASTPanelCanvas
            nodes={preparedNodes}
            edges={edges}
            activeNodeId={activeNodeId}
            onNodeSelect={onNodeSelect}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
