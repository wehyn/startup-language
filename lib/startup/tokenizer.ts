import { Token, TokenType } from "./types";

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
]);
const KEYWORDS = new Set([
  ...KEYWORD_CANONICAL.values(),
  "PIVOT",
  "SPRINT",
  "PITCH",
  "ACQUIRE",
  "EXIT",
  "AND",
  "OR",
  "NOT",
  "VESTED",
  "CLIFF",
]);
const OPERATORS = ["******", "::>", "+++", "---", "///", ">>>", "<<<", "???", "!!?"];
const DELIMITERS = new Set(["(", ")", "[", "]", "?", ","]);

const isAlpha = (char: string) => /[a-zA-Z_]/.test(char);
const isDigit = (char: string) => /[0-9]/.test(char);
const isAlphaNumeric = (char: string) => /[a-zA-Z0-9_]/.test(char);

const normalizeKeyword = (value: string): string => KEYWORD_CANONICAL.get(value) ?? value;

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
  const tokens: Token[] = [];
  const lines = source.split("\n");

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
          throw new TokenizerError(`Unterminated string at ${lineIndex + 1}:${start + 1}`, {
            line: lineIndex + 1,
            column: start + 1,
            endColumn: lineValue.length + 1,
          });
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
        tokens.push({
          type: "OPERATOR",
          value: op,
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
        tokens.push({
          type: "DELIMITER",
          value: char,
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
          if (nextChar === "." && !hasDot) {
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
          throw new TokenizerError(
            `Invalid numeric literal '${invalidLiteral}' at ${lineIndex + 1}:${invalidStart + 1}`,
            {
              line: lineIndex + 1,
              column: start + 1,
              endColumn: start + invalidLiteral.length + 1,
            },
          );
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

      throw new TokenizerError(`Unexpected token '${char}' at ${lineIndex + 1}:${cursor + 1}`, {
        line: lineIndex + 1,
        column: cursor + 1,
      });
    }
  }

  return tokens;
};
