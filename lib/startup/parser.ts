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
  phase: "production" | "node" | "recovery";
  rule: string;
  description: string;
  line: number;
  startToken: number;
  endToken: number;
  nodeId?: string;
};

export class ParserError extends Error {
  readonly line: number;

  readonly column: number;

  readonly startToken: number;

  readonly endToken: number;

  constructor(
    message: string,
    details: { line: number; column: number; startToken: number; endToken?: number },
  ) {
    super(message);
    this.name = "ParserError";
    this.line = details.line;
    this.column = details.column;
    this.startToken = details.startToken;
    this.endToken = details.endToken ?? details.startToken;
  }
}

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
      const statement = this.parseStatement();
      if (statement) {
        children.push(statement);
      }
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

  private parseStatement(): ASTNode | null {
    const token = this.peek();

    if (!token) {
      throw new Error("Unexpected end of input while parsing statement");
    }

    if (token.type === "KEYWORD" && this.isTypeKeyword(token.value)) {
      return this.parseDeclaration();
    }

    if (token.type === "KEYWORD" && token.value === "CLASS") {
      return this.parseClass();
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

    if (token.type === "INVALID") {
      const invalid = this.advance();
      if (invalid) {
        this.pushTrace({
          phase: "recovery",
          rule: "Panic Mode Recovery",
          description: `Skipped invalid token '${invalid.value}'`,
          line: invalid.line,
          startToken: this.position - 1,
          endToken: this.position - 1,
        });
      }
      return null;
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
    this.consumeStatementTerminatorWithRecovery(startToken, `declaration '${name.value}'`);

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
    this.consumeStatementTerminatorWithRecovery(startToken, `assignment '${name.value}'`);

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
      const statement = this.parseStatement();
      if (statement) {
        children.push(statement);
      }
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
      const statement = this.parseStatement();
      if (statement) {
        children.push(statement);
      }
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

    if (token.type === "KEYWORD" && token.value === "NEW") {
      this.advance();
      const className = this.consume("IDENTIFIER");
      this.validatePascalCase(className);
      return {
        kind: "NewExpr",
        className: className.value,
        line: token.line,
      };
    }

    if (token.type === "INVALID") {
      this.advance();
      this.pushTrace({
        phase: "recovery",
        rule: "Panic Mode Recovery",
        description: `Skipped invalid token '${token.value}' in expression and substituted 0`,
        line: token.line,
        startToken: this.position - 1,
        endToken: this.position - 1,
      });
      return {
        kind: "Literal",
        value: 0,
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
        throw new ParserError(
          `Missing '?' at end of previous statement before '${token.value}' at ${token.line}:${token.column}`,
          {
            line: token.line,
            column: token.column,
            startToken: Math.max(0, this.position - 1),
            endToken: this.position,
          },
        );
      }

      throw new ParserError(
        `Expected ${value ?? type}, found '${token.value}' at ${token.line}:${token.column}`,
        {
          line: token.line,
          column: token.column,
          startToken: this.position,
        },
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

    this.consumeStatementTerminatorWithRecovery(startToken, "PITCH statement");

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

    this.consumeStatementTerminatorWithRecovery(startToken, "ACQUIRE statement");

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
    this.consumeStatementTerminatorWithRecovery(startToken, "EXIT statement");
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

  private parseClass(): ASTNode {
    const startToken = this.position;
    const classToken = this.consume("KEYWORD", "CLASS");
    const name = this.consume("IDENTIFIER");
    this.validatePascalCase(name);
    this.consumeStatementTerminatorWithRecovery(startToken, `CLASS declaration '${name.value}'`);

    const node: ASTNode = {
      id: this.makeNodeId("class"),
      type: "Class",
      line: classToken.line,
      startToken,
      endToken: this.position - 1,
      value: { name: name.value },
    };

    this.pushTrace({
      phase: "node",
      rule: "Class -> CLASS IDENTIFIER ?",
      description: `Built CLASS '${name.value}'`,
      line: classToken.line,
      startToken,
      endToken: this.position - 1,
      nodeId: node.id,
    });

    return node;
  }

  private consumeStatementTerminatorWithRecovery(startToken: number, context: string) {
    if (this.match("DELIMITER", "?")) {
      return;
    }

    const lookahead = this.peek();
    const line = lookahead?.line ?? this.tokens[Math.max(0, this.position - 1)]?.line ?? 1;
    this.pushTrace({
      phase: "recovery",
      rule: "Phrase-Level Recovery",
      description: `Inserted missing '?' for ${context}`,
      line,
      startToken,
      endToken: Math.max(startToken, this.position - 1),
    });
  }

  private validateCamelCase(token: Token) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(token.value)) {
      throw new Error(
        `Identifier '${token.value}' must be camelCase at ${token.line}:${token.column}`,
      );
    }
  }

  private validatePascalCase(token: Token) {
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(token.value)) {
      throw new Error(
        `Identifier '${token.value}' must be PascalCase at ${token.line}:${token.column}`,
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
  const visibleTrace = parser.getTrace().filter((step) => step.phase !== "production");
  return {
    ast,
    trace: visibleTrace,
  };
};

export const isComparisonExpressionOperator = (
  operator: ExpressionOperator,
): operator is ComparisonOperator => [">>>", "<<<", "???", "!!?"].includes(operator);
