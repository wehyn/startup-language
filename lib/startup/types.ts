export type TokenType =
  | "KEYWORD"
  | "IDENTIFIER"
  | "LITERAL"
  | "OPERATOR"
  | "DELIMITER";

export type Token = {
  type: TokenType;
  value: string;
  line: number;
  column: number;
};

export type ASTNodeType =
  | "Program"
  | "Declaration"
  | "Assignment"
  | "If"
  | "Loop"
  | "Pitch"
  | "Acquire"
  | "Exit"
  | "BinaryExpr";

export type ASTNode = {
  id: string;
  type: ASTNodeType;
  value?: unknown;
  children?: ASTNode[];
  line: number;
  startToken?: number;
  endToken?: number;
};

export type ValueType = "Burn" | "Vibe" | "Equity" | "Portfolio";

export type RuntimeValue = number | string | boolean | RuntimeValue[];

export type VariableState = {
  type: ValueType;
  value: RuntimeValue;
};

export type ExecutionStep = {
  stepId: number;
  activeNodeId: string;
  line: number;
  variables: Record<string, VariableState>;
  log: string;
  output: string[];
};

export type Timeline = ExecutionStep[];

export type ArithmeticOperator = "+++" | "---" | "******" | "///";
export type ComparisonOperator = ">>>" | "<<<" | "???" | "!!?";
export type LogicalOperator = "AND" | "OR";
export type ExpressionOperator = ArithmeticOperator | ComparisonOperator | LogicalOperator;

export type LiteralExpression = {
  kind: "Literal";
  value: number | string | boolean;
  line: number;
};

export type ArrayExpression = {
  kind: "ArrayLiteral";
  elements: Expression[];
  line: number;
};

export type UnaryExpression = {
  kind: "UnaryExpr";
  operator: "NOT";
  expression: Expression;
  line: number;
};

export type IdentifierExpression = {
  kind: "Identifier";
  name: string;
  line: number;
};

export type BinaryExpression = {
  kind: "BinaryExpr";
  id: string;
  line: number;
  operator: ExpressionOperator;
  left: Expression;
  right: Expression;
};

export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | ArrayExpression
  | UnaryExpression
  | BinaryExpression;

export type DeclarationValue = {
  variableType: ValueType;
  name: string;
  expression: Expression;
};

export type AssignmentValue = {
  name: string;
  expression: Expression;
};

export type PitchValue = {
  expression?: Expression;
};

export type AcquireValue = {
  name?: string;
};

export type BranchValue = {
  condition: Expression;
};

export const isDeclarationNode = (node: ASTNode): node is ASTNode & { value: DeclarationValue } =>
  node.type === "Declaration";

export const isAssignmentNode = (node: ASTNode): node is ASTNode & { value: AssignmentValue } =>
  node.type === "Assignment";

export const isIfNode = (node: ASTNode): node is ASTNode & { value: BranchValue; children: ASTNode[] } =>
  node.type === "If";

export const isLoopNode = (node: ASTNode): node is ASTNode & { value: BranchValue; children: ASTNode[] } =>
  node.type === "Loop";

export const isPitchNode = (node: ASTNode): node is ASTNode & { value: PitchValue } =>
  node.type === "Pitch";

export const isAcquireNode = (node: ASTNode): node is ASTNode & { value: AcquireValue } =>
  node.type === "Acquire";

export const isExitNode = (node: ASTNode): node is ASTNode & { type: "Exit" } =>
  node.type === "Exit";
