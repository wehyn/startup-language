import { Edge, Node } from "@xyflow/react";

import { ASTNode } from "./types";

export type AstNodeData = {
  label: string;
  line: number;
  highlighted?: boolean;
  error?: boolean;
};

type BuildResult = {
  nodes: Node<AstNodeData>[];
  edges: Edge[];
};

export const buildReactFlowGraph = (ast: ASTNode): BuildResult => {
  const nodes: Node<AstNodeData>[] = [];
  const edges: Edge[] = [];

  const topLevel = ast.children ?? [];

  const V_GAP = 56;
  const H_INDENT = 180;

  const placeChildren = (
    children: ASTNode[],
    depth: number,
    parentId?: string,
    yStart = 20,
    xBase = 20,
  ): { nextY: number } => {
    let y = yStart;

    children.forEach((child, index) => {
      const x = xBase + depth * H_INDENT;

      nodes.push({
        id: child.id,
        type: "default",
        position: { x, y },
        data: {
          label: formatNodeLabel(child.type),
          line: child.line,
        },
      });

      if (parentId) {
        edges.push({
          id: `${parentId}->${child.id}`,
          source: parentId,
          target: child.id,
          animated: false,
        });
      }

      if (index > 0) {
        const prev = children[index - 1];
        edges.push({
          id: `${prev.id}=>${child.id}`,
          source: prev.id,
          target: child.id,
          animated: false,
          style: { strokeDasharray: "4 4" },
        });
      }

      y += V_GAP;

      if (child.children && child.children.length > 0) {
        const branch = placeChildren(child.children, depth + 1, child.id, y, xBase);
        y = branch.nextY;
      }
    });

    return { nextY: y };
  };

  placeChildren(topLevel, 0);

  return { nodes, edges };
};

const formatNodeLabel = (type: ASTNode["type"]): string => {
  switch (type) {
    case "Class":
      return "CLASS";
    case "Pitch":
      return "PITCH";
    case "Acquire":
      return "ACQUIRE";
    case "Exit":
      return "EXIT";
    case "If":
      return "PIVOT";
    case "Loop":
      return "SPRINT";
    default:
      return type;
  }
};
