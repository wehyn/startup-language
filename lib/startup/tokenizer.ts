import { Token, TokenType } from "./types";

export type TokenRecovery = {
  id: string;
  strategy: "panic";
  message: string;
  line: number;
  column: number;
  endColumn: number;
};

export class TokenizerError extends Error {
  readonly line: number;

  readonly column: number;

  readonly endColumn: number;

  constructor(message: string, details: { line: number; column: number; endColumn?: number }) {
    super(message);
    this.name = "TokenizerError";
    this.line = details.line;
    this.column = details.column;
    this.endColumn = details.endColumn ?? details.column + 1;
  }
}

const KEYWORD_CANONICAL = new Map<string, string>([
  ["BURN", "Burn"],
  ["VIBE", "Vibe"],
  ["EQUITY", "Equity"],
  ["PORTFOLIO", "Portfolio"],
  ["CLASS", "CLASS"],
  ["NEW", "NEW"],
]);
const KEYWORDS = new Set([
  ...KEYWORD_CANONICAL.values(),
  "PIVOT",
  "SPRINT",
  "PITCH",
  "ACQUIRE",
  "EXIT",
  "CLASS",
  "NEW",
  "AND",
  "OR",
  "NOT",
  "VESTED",
  "CLIFF",
]);
const OPERATORS = ["******", "::>", "+++", "---", "///", ">>>", "<<<", "???", "!!?"];
const DELIMITERS = new Set(["(", ")", "[", "]", "?", ",", ".", "~", "+", "-", "*", "/"]);

const isAlpha = (char: string) => /[a-zA-Z_]/.test(char);
const isDigit = (char: string) => /[0-9]/.test(char);
const isAlphaNumeric = (char: string) => /[a-zA-Z0-9_]/.test(char);

const normalizeKeyword = (value: string): string => KEYWORD_CANONICAL.get(value.toUpperCase()) ?? value;

const normalizeOperator = (value: string): string => {
  if (value === "~") return "::>";
  if (value === "+") return "+++";
  if (value === "-") return "---";
  if (value === "*") return "******";
  if (value === "/") return "///";
  return value;
};

const normalizeDelimiter = (value: string): string => {
  if (value === ".") return "?";
  return value;
};

const toTokenType = (value: string): TokenType => {
  if (KEYWORDS.has(value)) {
    return "KEYWORD";
  }

  if (DELIMITERS.has(value)) {
    return "DELIMITER";
  }

  if (OPERATORS.includes(value)) {
    return "OPERATOR";
  }

  if (/^[0-9]+(\.[0-9]+)?$/.test(value)) {
    return "LITERAL";
  }

  return "IDENTIFIER";
};

export const tokenize = (source: string): Token[] => {
  const { tokens } = tokenizeWithRecovery(source);
  return tokens;
};

export const tokenizeWithRecovery = (source: string): { tokens: Token[]; recoveries: TokenRecovery[] } => {
  const tokens: Token[] = [];
  const recoveries: TokenRecovery[] = [];
  let recoveryCounter = 1;
  const lines = source.split("\n");

  const pushPanicRecovery = (
    message: string,
    details: { line: number; column: number; endColumn?: number },
  ) => {
    recoveries.push({
      id: `tok_recovery_${recoveryCounter}`,
      strategy: "panic",
      message,
      line: details.line,
      column: details.column,
      endColumn: details.endColumn ?? details.column + 1,
    });
    recoveryCounter += 1;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineValue = lines[lineIndex];
    let cursor = 0;

    while (cursor < lineValue.length) {
      const char = lineValue[cursor];

      if (/\s/.test(char)) {
        cursor += 1;
        continue;
      }

      if (char === '"') {
        const start = cursor;
        cursor += 1;
        while (cursor < lineValue.length && lineValue[cursor] !== '"') {
          cursor += 1;
        }
        if (cursor >= lineValue.length) {
          const invalidLiteral = lineValue.slice(start);
          tokens.push({
            type: "INVALID",
            value: invalidLiteral,
            line: lineIndex + 1,
            column: start + 1,
          });
          pushPanicRecovery(
            `Panic Mode: unterminated string '${invalidLiteral}' skipped at ${lineIndex + 1}:${start + 1}`,
            {
              line: lineIndex + 1,
              column: start + 1,
              endColumn: lineValue.length + 1,
            },
          );
          break;
        }
        const value = lineValue.slice(start + 1, cursor);
        tokens.push({
          type: "LITERAL",
          value,
          line: lineIndex + 1,
          column: start + 1,
        });
        cursor += 1;
        continue;
      }

      const op = OPERATORS.find((candidate) => lineValue.startsWith(candidate, cursor));

      if (op) {
        const normalizedOperator = normalizeOperator(op);
        tokens.push({
          type: toTokenType(normalizedOperator),
          value: normalizedOperator,
          line: lineIndex + 1,
          column: cursor + 1,
        });
        cursor += op.length;
        continue;
      }

      if (lineValue.startsWith("//", cursor)) {
        break;
      }

      if (DELIMITERS.has(char)) {
        const normalizedDelimiter = normalizeDelimiter(char);
        const normalizedOperator = normalizeOperator(char);
        const tokenValue =
          normalizedDelimiter !== char || normalizedDelimiter === "?"
            ? normalizedDelimiter
            : normalizedOperator;
        tokens.push({
          type: toTokenType(tokenValue),
          value: tokenValue,
          line: lineIndex + 1,
          column: cursor + 1,
        });
        cursor += 1;
        continue;
      }

      if (isDigit(char)) {
        const start = cursor;
        let hasDot = false;
        while (cursor < lineValue.length) {
          const nextChar = lineValue[cursor];
          if (
            nextChar === "."
            && !hasDot
            && cursor + 1 < lineValue.length
            && isDigit(lineValue[cursor + 1])
          ) {
            hasDot = true;
            cursor += 1;
            continue;
          }
          if (!isDigit(nextChar)) {
            break;
          }
          cursor += 1;
        }

        if (cursor < lineValue.length && isAlpha(lineValue[cursor])) {
          const invalidStart = cursor;
          while (cursor < lineValue.length && isAlphaNumeric(lineValue[cursor])) {
            cursor += 1;
          }

          const invalidLiteral = lineValue.slice(start, cursor);
          tokens.push({
            type: "INVALID",
            value: invalidLiteral,
            line: lineIndex + 1,
            column: start + 1,
          });
          pushPanicRecovery(
            `Panic Mode: invalid numeric literal '${invalidLiteral}' skipped at ${lineIndex + 1}:${invalidStart + 1}`,
            {
              line: lineIndex + 1,
              column: start + 1,
              endColumn: start + invalidLiteral.length + 1,
            },
          );
          continue;
        }

        const value = lineValue.slice(start, cursor);
        tokens.push({
          type: toTokenType(value),
          value,
          line: lineIndex + 1,
          column: start + 1,
        });
        continue;
      }

      if (isAlpha(char)) {
        const start = cursor;
        while (cursor < lineValue.length && isAlphaNumeric(lineValue[cursor])) {
          cursor += 1;
        }
        const value = normalizeKeyword(lineValue.slice(start, cursor));
        tokens.push({
          type: toTokenType(value),
          value,
          line: lineIndex + 1,
          column: start + 1,
        });
        continue;
      }

      tokens.push({
        type: "INVALID",
        value: char,
        line: lineIndex + 1,
        column: cursor + 1,
      });
      pushPanicRecovery(
        `Panic Mode: invalid token '${char}' skipped at ${lineIndex + 1}:${cursor + 1}`,
        {
          line: lineIndex + 1,
          column: cursor + 1,
        },
      );
      cursor += 1;
    }
  }

  return { tokens, recoveries };
};
