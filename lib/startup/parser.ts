import {
  ASTNode,
  ArrayExpression,
  BinaryExpression,
  ComparisonOperator,
  Expression,
  ExpressionOperator,
  LiteralExpression,
  Token,
} from "./types";

export type ParserTraceStep = {
  id: string;
  phase: "production" | "node";
  rule: string;
  description: string;
  line: number;
  startToken: number;
  endToken: number;
  nodeId?: string;
};

class Parser {
  private readonly tokens: Token[];

  private position = 0;

  private nodeCounter = 1;

  private exprCounter = 1;

  private traceCounter = 1;

  private readonly trace: ParserTraceStep[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseProgram(): ASTNode {
    const children: ASTNode[] = [];

    while (!this.isAtEnd()) {
      children.push(this.parseStatement());
    }

    return {
      id: this.makeNodeId("program"),
      type: "Program",
      children,
      line: children[0]?.line ?? 1,
      startToken: children[0]?.startToken,
      endToken: children[children.length - 1]?.endToken,
    };
  }

  getTrace(): ParserTraceStep[] {
    return this.trace;
  }

  private parseStatement(): ASTNode {
    const token = this.peek();

    if (!token) {
      throw new Error("Unexpected end of input while parsing statement");
    }

    if (token.type === "KEYWORD" && this.isTypeKeyword(token.value)) {
      return this.parseDeclaration();
    }

    if (token.type === "KEYWORD" && token.value === "PIVOT") {
      return this.parseIf();
    }

    if (token.type === "KEYWORD" && token.value === "SPRINT") {
      return this.parseLoop();
    }

    if (token.type === "KEYWORD" && token.value === "PITCH") {
      return this.parsePitch();
    }

    if (token.type === "KEYWORD" && token.value === "ACQUIRE") {
      return this.parseAcquire();
    }

    if (token.type === "KEYWORD" && token.value === "EXIT") {
      return this.parseExit();
    }

    if (token.type === "IDENTIFIER") {
      return this.parseAssignment();
    }

    throw new Error(`Unexpected token '${token.value}' at ${token.line}:${token.column}`);
  }

  private parseDeclaration(): ASTNode {
    const startToken = this.position;
    const typeToken = this.consume("KEYWORD");
    const name = this.consume("IDENTIFIER");
    this.validateCamelCase(name);
    this.consume("OPERATOR", "::>");
    const expression = this.parseExpression();
    this.consume("DELIMITER", "?");

    const node: ASTNode = {
      id: this.makeNodeId("decl"),
      type: "Declaration",
      line: typeToken.line,
      startToken,
      endToken: this.position - 1,
      value: {
        variableType: typeToken.value as "Burn" | "Vibe" | "Equity" | "Portfolio",
        name: name.value,
        expression,
      },
    };

    this.pushTrace({
      phase: "node",
      rule: "Declaration -> Type IDENTIFIER ::> Expression ?",
      description: `Built Declaration '${name.value}'`,
      line: typeToken.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseAssignment(): ASTNode {
    const startToken = this.position;
    const name = this.consume("IDENTIFIER");
    this.validateCamelCase(name);
    this.consume("OPERATOR", "::>");
    const expression = this.parseExpression();
    this.consume("DELIMITER", "?");

    const node: ASTNode = {
      id: this.makeNodeId("assign"),
      type: "Assignment",
      line: name.line,
      startToken,
      endToken: this.position - 1,
      value: {
        name: name.value,
        expression,
      },
    };

    this.pushTrace({
      phase: "node",
      rule: "Assignment -> IDENTIFIER ::> Expression ?",
      description: `Built Assignment '${name.value}'`,
      line: name.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseIf(): ASTNode {
    const startToken = this.position;
    const pivot = this.consume("KEYWORD", "PIVOT");
    this.consume("DELIMITER", "(");
    const condition = this.parseExpression();
    this.consume("DELIMITER", ")");
    this.consume("DELIMITER", "[");

    const children: ASTNode[] = [];
    while (!this.check("DELIMITER", "]") && !this.isAtEnd()) {
      children.push(this.parseStatement());
    }
    this.consume("DELIMITER", "]");

    const node: ASTNode = {
      id: this.makeNodeId("if"),
      type: "If",
      line: pivot.line,
      startToken,
      endToken: this.position - 1,
      value: { condition },
      children,
    };

    this.pushTrace({
      phase: "node",
      rule: "If -> PIVOT ( Expression ) [ Statement* ]",
      description: `Built PIVOT block with ${children.length} statement(s)`,
      line: pivot.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseLoop(): ASTNode {
    const startToken = this.position;
    const sprint = this.consume("KEYWORD", "SPRINT");
    this.consume("DELIMITER", "(");
    const condition = this.parseExpression();
    this.consume("DELIMITER", ")");
    this.consume("DELIMITER", "[");

    const children: ASTNode[] = [];
    while (!this.check("DELIMITER", "]") && !this.isAtEnd()) {
      children.push(this.parseStatement());
    }
    this.consume("DELIMITER", "]");

    const node: ASTNode = {
      id: this.makeNodeId("loop"),
      type: "Loop",
      line: sprint.line,
      startToken,
      endToken: this.position - 1,
      value: { condition },
      children,
    };

    this.pushTrace({
      phase: "node",
      rule: "Loop -> SPRINT ( Expression ) [ Statement* ]",
      description: `Built SPRINT block with ${children.length} statement(s)`,
      line: sprint.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseExpression(): Expression {
    return this.parseLogicalOrExpression();
  }

  private parseLogicalOrExpression(): Expression {
    let expression = this.parseLogicalAndExpression();

    while (this.match("KEYWORD", "OR")) {
      const right = this.parseLogicalAndExpression();
      const nextExpression = this.makeBinaryExpr(expression, "OR", right, expression.line);
      this.pushTrace({
        phase: "production",
        rule: "LogicalOr -> LogicalAnd ( OR LogicalAnd )*",
        description: "Matched OR expression",
        line: nextExpression.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });
      expression = nextExpression;
    }

    return expression;
  }

  private parseLogicalAndExpression(): Expression {
    let expression = this.parseComparisonExpression();

    while (this.match("KEYWORD", "AND")) {
      const right = this.parseComparisonExpression();
      const nextExpression = this.makeBinaryExpr(expression, "AND", right, expression.line);
      this.pushTrace({
        phase: "production",
        rule: "LogicalAnd -> Comparison ( AND Comparison )*",
        description: "Matched AND expression",
        line: nextExpression.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });
      expression = nextExpression;
    }

    return expression;
  }

  private parseComparisonExpression(): Expression {
    let expression = this.parseArithmeticExpression();

    while (true) {
      const operator = this.match("OPERATOR", ">>>")
        ? ">>>"
        : this.match("OPERATOR", "<<<")
        ? "<<<"
        : this.match("OPERATOR", "???")
        ? "???"
        : this.match("OPERATOR", "!!?")
        ? "!!?"
        : null;

      if (!operator) {
        break;
      }

      const right = this.parseArithmeticExpression();
      const nextExpression = this.makeBinaryExpr(expression, operator, right, expression.line);
      this.pushTrace({
        phase: "production",
        rule: "Comparison -> Arithmetic ( (>>> | <<< | ??? | !!?) Arithmetic )*",
        description: `Matched comparison operator '${operator}'`,
        line: nextExpression.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });
      expression = nextExpression;
    }

    return expression;
  }

  private parseArithmeticExpression(): Expression {
    let expression = this.parseUnaryExpression();

    while (true) {
      const operator = this.match("OPERATOR", "+++")
        ? "+++"
        : this.match("OPERATOR", "---")
        ? "---"
        : this.match("OPERATOR", "******")
        ? "******"
        : this.match("OPERATOR", "///")
        ? "///"
        : null;

      if (!operator) {
        break;
      }

      const right = this.parseUnaryExpression();
      const nextExpression = this.makeBinaryExpr(expression, operator, right, expression.line);
      this.pushTrace({
        phase: "production",
        rule: "Arithmetic -> Unary ( (+++ | --- | ****** | ///) Unary )*",
        description: `Matched arithmetic operator '${operator}'`,
        line: nextExpression.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });
      expression = nextExpression;
    }

    return expression;
  }

  private parseUnaryExpression(): Expression {
    if (this.match("KEYWORD", "NOT")) {
      const expression = this.parseUnaryExpression();
      const unaryExpr: Expression = {
        kind: "UnaryExpr",
        operator: "NOT",
        expression,
        line: expression.line,
      };

      this.pushTrace({
        phase: "production",
        rule: "Unary -> NOT Unary | Primary",
        description: "Matched NOT unary expression",
        line: unaryExpr.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });

      return unaryExpr;
    }

    return this.parsePrimaryExpression();
  }

  private parsePrimaryExpression(): Expression {
    const token = this.peek();

    if (!token) {
      throw new Error("Unexpected end of input in expression");
    }

    if (token.type === "LITERAL") {
      this.advance();
      const literal: LiteralExpression = {
        kind: "Literal",
        value: this.parseLiteralValue(token.value),
        line: token.line,
      };
      return literal;
    }

    if (token.type === "KEYWORD" && (token.value === "VESTED" || token.value === "CLIFF")) {
      this.advance();
      return {
        kind: "Literal",
        value: token.value === "VESTED",
        line: token.line,
      };
    }

    if (token.type === "IDENTIFIER") {
      this.advance();
      this.validateCamelCase(token);
      return {
        kind: "Identifier",
        name: token.value,
        line: token.line,
      };
    }

    if (token.type === "DELIMITER" && token.value === "[") {
      return this.parseArrayLiteral();
    }

    if (token.type === "DELIMITER" && token.value === "(") {
      this.advance();
      const expr = this.parseExpression();
      this.consume("DELIMITER", ")");
      return expr;
    }

    throw new Error(`Unexpected expression token '${token.value}' at ${token.line}:${token.column}`);
  }

  private makeBinaryExpr(
    left: Expression,
    operator: ExpressionOperator,
    right: Expression,
    line: number,
  ): BinaryExpression {
    return {
      kind: "BinaryExpr",
      id: `expr_${this.exprCounter++}`,
      line,
      operator,
      left,
      right,
    };
  }

  private makeNodeId(prefix: string): string {
    const id = `${prefix}_${this.nodeCounter}`;
    this.nodeCounter += 1;
    return id;
  }

  private check(type: Token["type"], value?: string): boolean {
    const token = this.peek();
    if (!token) {
      return false;
    }
    if (token.type !== type) {
      return false;
    }
    if (value !== undefined && token.value !== value) {
      return false;
    }
    return true;
  }

  private match(type: Token["type"], value?: string): boolean {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private consume(type: Token["type"], value?: string): Token {
    const token = this.peek();
    if (!token) {
      throw new Error(`Expected ${value ?? type}, found end of input`);
    }

    if (token.type !== type || (value !== undefined && token.value !== value)) {
      if (type === "DELIMITER" && value === "?") {
        throw new Error(
          `Missing '?' at end of previous statement before '${token.value}' at ${token.line}:${token.column}`,
        );
      }

      throw new Error(
        `Expected ${value ?? type}, found '${token.value}' at ${token.line}:${token.column}`,
      );
    }

    this.position += 1;
    return token;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private advance(): Token | undefined {
    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }

  private isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  private parseArrayLiteral(): ArrayExpression {
    const start = this.consume("DELIMITER", "[");
    const elements: Expression[] = [];

    if (!this.check("DELIMITER", "]")) {
      do {
        elements.push(this.parseExpression());
      } while (this.match("DELIMITER", ","));
    }

    this.consume("DELIMITER", "]");

    return {
      kind: "ArrayLiteral",
      elements,
      line: start.line,
    };
  }

  private parsePitch(): ASTNode {
    const startToken = this.position;
    const pitch = this.consume("KEYWORD", "PITCH");
    let expression: Expression | undefined;

    if (!this.check("DELIMITER", "?")) {
      expression = this.parseExpression();
    }

    this.consume("DELIMITER", "?");

    const node: ASTNode = {
      id: this.makeNodeId("pitch"),
      type: "Pitch",
      line: pitch.line,
      startToken,
      endToken: this.position - 1,
      value: { expression },
    };

    this.pushTrace({
      phase: "node",
      rule: "Pitch -> PITCH Expression? ?",
      description: "Built PITCH statement",
      line: pitch.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseAcquire(): ASTNode {
    const startToken = this.position;
    const acquire = this.consume("KEYWORD", "ACQUIRE");
    let name: string | undefined;

    if (this.check("IDENTIFIER")) {
      const token = this.consume("IDENTIFIER");
      this.validateCamelCase(token);
      name = token.value;
    }

    this.consume("DELIMITER", "?");

    const node: ASTNode = {
      id: this.makeNodeId("acquire"),
      type: "Acquire",
      line: acquire.line,
      startToken,
      endToken: this.position - 1,
      value: { name },
    };

    this.pushTrace({
      phase: "node",
      rule: "Acquire -> ACQUIRE IDENTIFIER? ?",
      description: name ? `Built ACQUIRE into '${name}'` : "Built ACQUIRE statement",
      line: acquire.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseExit(): ASTNode {
    const startToken = this.position;
    const exit = this.consume("KEYWORD", "EXIT");
    this.consume("DELIMITER", "?");
    const node: ASTNode = {
      id: this.makeNodeId("exit"),
      type: "Exit",
      line: exit.line,
      startToken,
      endToken: this.position - 1,
    };

    this.pushTrace({
      phase: "node",
      rule: "Exit -> EXIT ?",
      description: "Built EXIT statement",
      line: exit.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private parseLiteralValue(value: string): number | string {
    if (/^[0-9]+(\.[0-9]+)?$/.test(value)) {
      return Number(value);
    }

    return value;
  }

  private validateCamelCase(token: Token) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(token.value)) {
      throw new Error(
        `Identifier '${token.value}' must be camelCase at ${token.line}:${token.column}`,
      );
    }
  }

  private isTypeKeyword(value: string): boolean {
    return value === "Burn" || value === "Vibe" || value === "Equity" || value === "Portfolio";
  }

  private pushTrace(step: Omit<ParserTraceStep, "id">) {
    this.trace.push({
      ...step,
      id: `parse_${this.traceCounter}`,
    });
    this.traceCounter += 1;
  }
}

export const parseTokensToAst = (tokens: Token[]): ASTNode => {
  const { ast } = parseTokensToAstWithTrace(tokens);
  return ast;
};

export const parseTokensToAstWithTrace = (
  tokens: Token[],
): { ast: ASTNode; trace: ParserTraceStep[] } => {
  const parser = new Parser(tokens);
  const ast = parser.parseProgram();
  return {
    ast,
    trace: parser.getTrace(),
  };
};

export const isComparisonExpressionOperator = (
  operator: ExpressionOperator,
): operator is ComparisonOperator => [">>>", "<<<", "???", "!!?"].includes(operator);
