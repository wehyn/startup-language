import {
  ASTNode,
  BinaryExpression,
  ComparisonOperator,
  ExecutionStep,
  Expression,
  ExpressionOperator,
  IRInstruction,
  RuntimeValue,
  ScopeEnvironment,
  StackFrame,
  Timeline,
  VariableState,
  ValueType,
  isAcquireNode,
  isAssignmentNode,
  isDeclarationNode,
  isExitNode,
  isIfNode,
  isLoopNode,
  isPitchNode,
} from "./types";

type RuntimeState = {
  variables: Record<string, VariableState>;
  timeline: Timeline;
  stepCounter: number;
  output: string[];
  halted: boolean;
  stack: StackFrame[];
  scopeFrames: ScopeEnvironment[];
  scopeCounter: number;
};

const stackFrameCounter = { value: 1 };

const nextFrameId = () => {
  const id = `frame-${stackFrameCounter.value}`;
  stackFrameCounter.value += 1;
  return id;
};

const cloneStack = (stack: StackFrame[]): StackFrame[] =>
  stack.map((frame) => ({ ...frame }));

const cloneScopes = (scopes: ScopeEnvironment[]): ScopeEnvironment[] =>
  scopes.map((scope) => ({
    ...scope,
    variables: cloneVariables(scope.variables),
  }));

const cloneVariables = (variables: Record<string, VariableState>): Record<string, VariableState> => {
  const snapshot: Record<string, VariableState> = {};

  for (const key of Object.keys(variables)) {
    snapshot[key] = {
      type: variables[key].type,
      value: variables[key].value,
    };
  }

  return snapshot;
};

const formatOperator = (operator: ComparisonOperator): string => {
  switch (operator) {
    case ">>>":
      return ">";
    case "<<<":
      return "<";
    case "???":
      return "==";
    case "!!?":
      return "!=";
    default:
      return operator;
  }
};

const expressionToText = (expression: Expression): string => {
  if (expression.kind === "Literal") {
    return formatRuntimeValue(expression.value);
  }

  if (expression.kind === "Identifier") {
    return expression.name;
  }

  if (expression.kind === "ArrayLiteral") {
    return `[${expression.elements.map(expressionToText).join(", ")}]`;
  }

  if (expression.kind === "UnaryExpr") {
    return `NOT ${expressionToText(expression.expression)}`;
  }

  return `${expressionToText(expression.left)} ${expression.operator} ${expressionToText(expression.right)}`;
};

const pushStep = (state: RuntimeState, node: ASTNode, log: string) => {
  const step: ExecutionStep = {
    stepId: state.stepCounter,
    activeNodeId: node.id,
    line: node.line,
    variables: cloneVariables(state.variables),
    stack: cloneStack(state.stack),
    scopes: cloneScopes(state.scopeFrames),
    log,
    output: [...state.output],
  };

  state.timeline.push(step);
  state.stepCounter += 1;
};

const pushFrame = (state: RuntimeState, label: string, line: number) => {
  state.stack.push({
    id: nextFrameId(),
    label,
    line,
  });
};

const pushScope = (state: RuntimeState, label: string, line: number) => {
  const level = state.scopeFrames.length;
  const parentVars = state.scopeFrames[state.scopeFrames.length - 1]?.variables ?? {};
  const scope: ScopeEnvironment = {
    id: `scope-${state.scopeCounter}`,
    label,
    level,
    line,
    variables: cloneVariables(parentVars),
  };
  state.scopeCounter += 1;
  state.scopeFrames.push(scope);
};

const popScope = (state: RuntimeState) => {
  if (state.scopeFrames.length > 1) {
    state.scopeFrames.pop();
  }
};

const syncScopeVariable = (state: RuntimeState, name: string) => {
  const variable = state.variables[name];
  if (!variable) {
    return;
  }
  state.scopeFrames[state.scopeFrames.length - 1].variables[name] = {
    type: variable.type,
    value: variable.value,
  };
};

const popFrame = (state: RuntimeState) => {
  if (state.stack.length > 1) {
    state.stack.pop();
  }
};

const evalArithmetic = (left: number, right: number, operator: ExpressionOperator): number => {
  switch (operator) {
    case "+++":
      return left + right;
    case "---":
      return left - right;
    case "******":
      return left * right;
    case "///":
      return right === 0 ? 0 : left / right;
    default:
      throw new Error(`Unexpected arithmetic operator: ${operator}`);
  }
};

const evalComparison = (left: number, right: number, operator: ComparisonOperator): boolean => {
  switch (operator) {
    case ">>>":
      return left > right;
    case "<<<":
      return left < right;
    case "???":
      return left === right;
    case "!!?":
      return left !== right;
    default:
      return false;
  }
};

const evaluateExpression = (expression: Expression, state: RuntimeState): RuntimeValue => {
  if (expression.kind === "Literal") {
    return expression.value;
  }

  if (expression.kind === "Identifier") {
    const existing = state.variables[expression.name];
    if (!existing) {
      throw new Error(`Undefined variable '${expression.name}' at line ${expression.line}`);
    }
    return existing.value;
  }

  if (expression.kind === "ArrayLiteral") {
    return expression.elements.map((element) => evaluateExpression(element, state));
  }

  if (expression.kind === "UnaryExpr") {
    const value = evaluateExpression(expression.expression, state);
    return !Boolean(value);
  }

  return evaluateBinaryExpression(expression, state);
};

const evaluateBinaryExpression = (expression: BinaryExpression, state: RuntimeState): RuntimeValue => {
  const left = evaluateExpression(expression.left, state);
  const right = evaluateExpression(expression.right, state);

  if (expression.operator === "AND") {
    return Boolean(left) && Boolean(right);
  }

  if (expression.operator === "OR") {
    return Boolean(left) || Boolean(right);
  }

  if ([">>>", "<<<", "???", "!!?"].includes(expression.operator)) {
    if (expression.operator === "???") {
      return left === right;
    }
    if (expression.operator === "!!?") {
      return left !== right;
    }

    if (typeof left !== "number" || typeof right !== "number") {
      throw new Error(`Comparison '${expression.id}' requires numeric operands`);
    }
    return evalComparison(left, right, expression.operator as ComparisonOperator);
  }

  if (typeof left !== "number" || typeof right !== "number") {
    throw new Error(`Binary expression '${expression.id}' has invalid operands`);
  }

  return evalArithmetic(left, right, expression.operator);
};

const inferValueType = (value: RuntimeValue): ValueType => {
  if (Array.isArray(value)) {
    return "Portfolio";
  }
  if (typeof value === "string") {
    return "Vibe";
  }
  if (typeof value === "boolean") {
    return "Equity";
  }
  return "Burn";
};

const formatRuntimeValue = (value: RuntimeValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map(formatRuntimeValue).join(", ")}]`;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
};

const formatOutputValue = (value: RuntimeValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map(formatOutputValue).join(", ")}]`;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
};

const executeNode = (node: ASTNode, state: RuntimeState) => {
  if (state.halted) {
    return;
  }

  if (isDeclarationNode(node)) {
    const value = evaluateExpression(node.value.expression, state);
    const expected = node.value.variableType;
    const actual = inferValueType(value);
    if (expected !== actual) {
      throw new Error(`Declaration '${node.value.name}' must evaluate to ${expected}`);
    }
    state.variables[node.value.name] = {
      type: node.value.variableType,
      value,
    };
    syncScopeVariable(state, node.value.name);
    pushStep(state, node, `[EXEC] Declaring ${node.value.name} = ${formatRuntimeValue(value)}`);
    return;
  }

  if (isAssignmentNode(node)) {
    const value = evaluateExpression(node.value.expression, state);
    const existing = state.variables[node.value.name];
    const targetType = existing?.type ?? inferValueType(value);
    const actual = inferValueType(value);
    if (targetType !== actual) {
      throw new Error(`Assignment '${node.value.name}' must evaluate to ${targetType}`);
    }
    state.variables[node.value.name] = {
      type: targetType,
      value,
    };
    syncScopeVariable(state, node.value.name);
    pushStep(state, node, `[EXEC] Assigning ${node.value.name} = ${formatRuntimeValue(value)}`);
    return;
  }

  if (isPitchNode(node)) {
    const messageValue = node.value.expression
      ? evaluateExpression(node.value.expression, state)
      : "";
    const outputText = formatOutputValue(messageValue);
    state.output.push(outputText);
    pushStep(state, node, `[EXEC] PITCH ${outputText}`.trim());
    return;
  }

  if (isAcquireNode(node)) {
    const inputValue = "<input>";
    if (node.value.name) {
      state.variables[node.value.name] = {
        type: "Vibe",
        value: inputValue,
      };
      syncScopeVariable(state, node.value.name);
    }
    pushStep(
      state,
      node,
      node.value.name
        ? `[EXEC] ACQUIRE ${node.value.name} = ${inputValue}`
        : `[EXEC] ACQUIRE ${inputValue}`,
    );
    return;
  }

  if (isExitNode(node)) {
    pushStep(state, node, `[EXEC] EXIT`);
    state.output.push("<exit>");
    state.halted = true;
    return;
  }

  if (isIfNode(node)) {
    pushFrame(state, `PIVOT @L${node.line}`, node.line);
    pushScope(state, `PIVOT scope @L${node.line}`, node.line);
    const conditionValue = evaluateExpression(node.value.condition, state);
    const truthy = Boolean(conditionValue);
    const readableCondition = node.value.condition.kind === "BinaryExpr" ? node.value.condition : null;

    const formattedCondition = readableCondition
      ? `${expressionToText(readableCondition.left)} ${formatOperator(
          readableCondition.operator as ComparisonOperator,
        )} ${expressionToText(readableCondition.right)}`
      : expressionToText(node.value.condition);

    pushStep(state, node, `[EXEC] Evaluating (${formattedCondition}) → ${truthy ? "true" : "false"}`);

    if (truthy) {
      for (const child of node.children) {
        executeNode(child, state);
        if (state.halted) {
          popFrame(state);
          popScope(state);
          break;
        }
      }
    }
    popFrame(state);
    popScope(state);
    return;
  }

  if (isLoopNode(node)) {
    pushFrame(state, `SPRINT @L${node.line}`, node.line);
    pushScope(state, `SPRINT scope @L${node.line}`, node.line);
    let guard = 0;

    while (guard < 1000) {
      const conditionValue = evaluateExpression(node.value.condition, state);
      const truthy = Boolean(conditionValue);

      pushStep(state, node, `[EXEC] Loop condition at line ${node.line} → ${truthy ? "true" : "false"}`);

      if (!truthy) {
        break;
      }

      for (const child of node.children) {
        executeNode(child, state);
        if (state.halted) {
          popFrame(state);
          popScope(state);
          return;
        }
      }

      guard += 1;
    }
    popFrame(state);
    popScope(state);
    return;
  }
};

const expressionToIR = (expression: Expression): string => {
  if (expression.kind === "Literal") {
    return formatRuntimeValue(expression.value);
  }

  if (expression.kind === "Identifier") {
    return expression.name;
  }

  if (expression.kind === "ArrayLiteral") {
    return `[${expression.elements.map((element) => expressionToIR(element)).join(", ")}]`;
  }

  if (expression.kind === "UnaryExpr") {
    return `${expression.operator} ${expressionToIR(expression.expression)}`;
  }

  return `${expressionToIR(expression.left)} ${expression.operator} ${expressionToIR(expression.right)}`;
};

const buildIRForNode = (node: ASTNode, instructions: IRInstruction[]) => {
  const emit = (opcode: string, args: string[], note?: string) => {
    instructions.push({
      index: instructions.length,
      line: node.line,
      opcode,
      args,
      note,
    });
  };

  if (isDeclarationNode(node)) {
    emit("DECL", [node.value.variableType, node.value.name, expressionToIR(node.value.expression)]);
    return;
  }

  if (isAssignmentNode(node)) {
    emit("ASSIGN", [node.value.name, expressionToIR(node.value.expression)]);
    return;
  }

  if (isPitchNode(node)) {
    emit("PITCH", [node.value.expression ? expressionToIR(node.value.expression) : "\"\""]);
    return;
  }

  if (isAcquireNode(node)) {
    emit("ACQUIRE", [node.value.name ?? "<anon>"]);
    return;
  }

  if (isExitNode(node)) {
    emit("EXIT", []);
    return;
  }

  if (isIfNode(node)) {
    emit("JUMP_IF_FALSE", [expressionToIR(node.value.condition)], "enter PIVOT body when true");
    node.children.forEach((child) => {
      buildIRForNode(child, instructions);
    });
    emit("END_IF", []);
    return;
  }

  if (isLoopNode(node)) {
    emit("LOOP_BEGIN", [expressionToIR(node.value.condition)]);
    node.children.forEach((child) => {
      buildIRForNode(child, instructions);
    });
    emit("LOOP_END", [expressionToIR(node.value.condition)]);
  }
};

export const buildIntermediateRepresentation = (ast: ASTNode): IRInstruction[] => {
  const instructions: IRInstruction[] = [];
  for (const node of ast.children ?? []) {
    buildIRForNode(node, instructions);
  }
  return instructions;
};

export const executeAst = (ast: ASTNode): { timeline: Timeline; ir: IRInstruction[] } => {
  stackFrameCounter.value = 1;
  const state: RuntimeState = {
    variables: {},
    timeline: [],
    stepCounter: 1,
    output: [],
    halted: false,
    stack: [{ id: nextFrameId(), label: "Program", line: ast.line }],
    scopeFrames: [
      {
        id: "scope-0",
        label: "Global scope",
        level: 0,
        line: ast.line,
        variables: {},
      },
    ],
    scopeCounter: 1,
  };

  const ir = buildIntermediateRepresentation(ast);

  const nodes = ast.children ?? [];

  for (const node of nodes) {
    executeNode(node, state);
    if (state.halted) {
      break;
    }
  }

  return { timeline: state.timeline, ir };
};
