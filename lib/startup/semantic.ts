import {
  ASTNode,
  BranchValue,
  ClassValue,
  Expression,
  ExpressionOperator,
  ValueType,
  isAssignmentNode,
  isClassNode,
  isDeclarationNode,
  isIfNode,
  isLoopNode,
} from "./types";

export type InferredType = ValueType | "Unknown";

export type TypeCheckEntry = {
  variable: string;
  declaredType: ValueType;
  inferredType: InferredType;
  line: number;
  column: number;
  source: "declaration" | "assignment";
};

export type SemanticIssue = {
  message: string;
  line: number;
  column: number;
  source: "semantic";
};

export type SemanticResult = {
  entries: TypeCheckEntry[];
  symbolTable: Record<string, ValueType>;
  issues: SemanticIssue[];
};

type ScopeState = {
  symbols: Record<string, ValueType>;
  classes: Set<string>;
  entries: TypeCheckEntry[];
  issues: SemanticIssue[];
};

const literalType = (value: unknown): InferredType => {
  if (Array.isArray(value)) {
    return "Portfolio";
  }

  if (typeof value === "number") {
    return "Burn";
  }

  if (typeof value === "string") {
    return "Vibe";
  }

  if (typeof value === "boolean") {
    return "Equity";
  }

  return "Unknown";
};

const isComparisonOperator = (operator: ExpressionOperator) => {
  return operator === ">>>" || operator === "<<<" || operator === "???" || operator === "!!?";
};

const inferExpressionType = (expression: Expression, state: ScopeState): InferredType => {
  if (expression.kind === "Literal") {
    return literalType(expression.value);
  }

  if (expression.kind === "Identifier") {
    const known = state.symbols[expression.name];

    if (!known) {
      state.issues.push({
        source: "semantic",
        message: `Undefined variable '${expression.name}'`,
        line: expression.line,
        column: 1,
      });
      return "Unknown";
    }

    return known;
  }

  if (expression.kind === "ArrayLiteral") {
    expression.elements.forEach((element) => {
      inferExpressionType(element, state);
    });
    return "Portfolio";
  }

  if (expression.kind === "UnaryExpr") {
    inferExpressionType(expression.expression, state);
    return "Equity";
  }

  if (expression.kind === "NewExpr") {
    if (!state.classes.has(expression.className)) {
      state.issues.push({
        source: "semantic",
        message: `Instantiation uses undefined class '${expression.className}'`,
        line: expression.line,
        column: 1,
      });
    }
    return "Vibe";
  }

  const leftType = inferExpressionType(expression.left, state);
  const rightType = inferExpressionType(expression.right, state);

  if (expression.operator === "AND" || expression.operator === "OR") {
    if (leftType !== "Unknown" && leftType !== "Equity") {
      state.issues.push({
        source: "semantic",
        message: `Operator '${expression.operator}' expects Equity left operand`,
        line: expression.line,
        column: 1,
      });
    }

    if (rightType !== "Unknown" && rightType !== "Equity") {
      state.issues.push({
        source: "semantic",
        message: `Operator '${expression.operator}' expects Equity right operand`,
        line: expression.line,
        column: 1,
      });
    }

    return "Equity";
  }

  if (isComparisonOperator(expression.operator)) {
    const needsNumeric = expression.operator === ">>>" || expression.operator === "<<<";
    if (needsNumeric) {
      if (leftType !== "Unknown" && leftType !== "Burn") {
        state.issues.push({
          source: "semantic",
          message: `Operator '${expression.operator}' expects Burn left operand`,
          line: expression.line,
          column: 1,
        });
      }

      if (rightType !== "Unknown" && rightType !== "Burn") {
        state.issues.push({
          source: "semantic",
          message: `Operator '${expression.operator}' expects Burn right operand`,
          line: expression.line,
          column: 1,
        });
      }
    }

    return "Equity";
  }

  if (leftType !== "Unknown" && leftType !== "Burn") {
    state.issues.push({
      source: "semantic",
      message: `Operator '${expression.operator}' expects Burn left operand`,
      line: expression.line,
      column: 1,
    });
  }

  if (rightType !== "Unknown" && rightType !== "Burn") {
    state.issues.push({
      source: "semantic",
      message: `Operator '${expression.operator}' expects Burn right operand`,
      line: expression.line,
      column: 1,
    });
  }

  return "Burn";
};

const inferBranchCondition = (value: BranchValue, state: ScopeState, line: number) => {
  const conditionType = inferExpressionType(value.condition, state);

  if (conditionType !== "Unknown" && conditionType !== "Equity") {
    state.issues.push({
      source: "semantic",
      message: "Branch condition must evaluate to Equity",
      line,
      column: 1,
    });
  }
};

const walkNode = (node: ASTNode, state: ScopeState) => {
  if (isClassNode(node)) {
    const classNode = node.value as ClassValue;
    state.classes.add(classNode.name);
    return;
  }

  if (isDeclarationNode(node)) {
    const inferredType = inferExpressionType(node.value.expression, state);
    state.entries.push({
      variable: node.value.name,
      declaredType: node.value.variableType,
      inferredType,
      line: node.line,
      column: 1,
      source: "declaration",
    });

    if (inferredType !== "Unknown" && inferredType !== node.value.variableType) {
      state.issues.push({
        source: "semantic",
        message: `Type mismatch for '${node.value.name}': declared ${node.value.variableType}, inferred ${inferredType}`,
        line: node.line,
        column: 1,
      });
    }

    state.symbols[node.value.name] = node.value.variableType;
    return;
  }

  if (isAssignmentNode(node)) {
    const currentType = state.symbols[node.value.name];
    const inferredType = inferExpressionType(node.value.expression, state);

    if (!currentType) {
      state.issues.push({
        source: "semantic",
        message: `Assignment to undefined variable '${node.value.name}'`,
        line: node.line,
        column: 1,
      });
      return;
    }

    state.entries.push({
      variable: node.value.name,
      declaredType: currentType,
      inferredType,
      line: node.line,
      column: 1,
      source: "assignment",
    });

    if (inferredType !== "Unknown" && inferredType !== currentType) {
      state.issues.push({
        source: "semantic",
        message: `Type mismatch for '${node.value.name}': expected ${currentType}, inferred ${inferredType}`,
        line: node.line,
        column: 1,
      });
    }
    return;
  }

  if (isIfNode(node) || isLoopNode(node)) {
    inferBranchCondition(node.value, state, node.line);
    node.children.forEach((child) => {
      walkNode(child, state);
    });
  }
};

export const analyzeSemantics = (ast: ASTNode): SemanticResult => {
  const state: ScopeState = {
    symbols: {},
    classes: new Set<string>(),
    entries: [],
    issues: [],
  };

  (ast.children ?? []).forEach((node) => {
    walkNode(node, state);
  });

  return {
    entries: state.entries,
    symbolTable: state.symbols,
    issues: state.issues,
  };
};
