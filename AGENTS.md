# AGENTS.md — Startup Language Compiler Visualizer

This document provides guidelines for agentic coding agents working in this repository.
Run all commands from the repository root (`/Users/wayne/dev/startup`).

---

## 1. Commands

### Install and Dev

```bash
npm ci          # Install dependencies exactly from lockfile (always use this, not npm install)
npm run dev     # Local dev server at http://localhost:3000
npm run build   # Production build
npm run start   # Start built app
```

### Lint and Type Check

```bash
npm run lint    # ESLint (eslint-config-next + TypeScript rules)
```

ESLint config: `eslint.config.mjs` (ESM, `defineConfig`). Ignores `.next/`, `out/`, `build/`.
TypeScript: `tsconfig.json` — strict mode, `moduleResolution: bundler`, path alias `@/*` maps to root.

### Tests (E2E only — Playwright)

```bash
npm run test:e2e                    # All E2E tests (runs dev server automatically)
npx playwright test                # Same as above
npx playwright test tests/e2e/<file>.spec.ts        # Single spec file
npx playwright test -g "test name pattern"          # Run tests matching description
npx playwright test tests/e2e/compiler-links.spec.ts -g "token click"
```

Fixtures are in `tests/e2e/fixtures/*.startup`. Use `data-testid` attributes for stable selectors.

### CI Parity Checklist

Before opening a PR, run locally:

```bash
npm ci
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

---

## 2. Code Style

### TypeScript

- **Strict mode** is always on. No `any`, no implicit `any`.
- Use **named types** for all public shapes (types/interfaces). Prefer `type` over `interface` unless you need declaration merging.
- **Discriminated unions** for variant types (e.g., `Expression`, `ASTNode`). Use type guard functions for narrowing.
- Guard functions follow the naming pattern `isXxxNode`: `isDeclarationNode`, `isPitchNode`, etc. (see `lib/startup/types.ts`).
- Prefer `unknown` over `any` for external data boundaries.
- Do **not** use `// @ts-ignore` or `// @ts-expect-error` without explicit justification.
- Incremental builds: `tsconfig.json` has `"incremental": true`.

### Imports

- Use **path alias** `@/*` for all internal imports (e.g., `@/components/EditorPanel`).
- React/Next.js imports first, then internal domain imports, then third-party.
- In ESM files (`*.ts`, `*.tsx`), use `import { foo } from "./bar"` (named imports). Use `import type` for type-only imports.
- **Sort imports** logically by category, not alphabetically. ESLint enforces consistency.

### Naming Conventions

- **Variables and functions**: `camelCase` (e.g., `parseTokensToAst`, `tokenizeWithRecovery`).
- **Types, classes, React components**: `PascalCase` (e.g., `ParserError`, `EditorPanel`, `Token`).
- **File names**: `kebab-case.ts` for utilities/domains, `PascalCase.tsx` for React components.
- **`.startup` DSL identifiers**: validated at parse time — variables must be `camelCase`, classes must be `PascalCase`. Enforce via `validateCamelCase` / `validatePascalCase` in the parser.

### Error Handling

- **Compiler errors** extend `Error` with extra properties (`line`, `column`, etc.). See `TokenizerError` and `ParserError` in `lib/startup/tokenizer.ts` and `lib/startup/parser.ts`.
- Use `instanceof` checks when catching typed errors.
- In React components, catch errors at the **pipeline boundary** and store them in state (`error`, `errorLine`, `errorColumn` in `StartupCompilerApp.tsx`).
- Never swallow errors silently; always push to a diagnostics/trace surface.

### Formatting

- **2-space indentation** (enforced by ESLint default for this project).
- **Semicolons** at the end of statements.
- **Curly braces always** for if/for/while blocks, even single-line bodies.
- **Line comments** (`//`) throughout, not block comments (`/* */`), except in multiline contexts.
- No trailing commas in destructuring patterns.
- Ternary chains and complex conditionals: extract to named variables or helper functions.
- Template literal tag functions (`html`, `css`) are **not used**. Use plain template literals or JSX.

### React Components

- Server components: no `"use client"` directive.
- Client components: `"use client"` at the top of the file.
- Use **function declaration** syntax (`export function EditorPanel`) rather than `const EditorPanel = () => {}`.
- Hooks: prefer `useCallback` and `useMemo` for expensive computations or stable references passed as props.
- Props types: define with `type Props = { ... }` above the component.
- No inline styles; use Tailwind CSS classes.

### Project-Specific Patterns

- **Compiler pipeline**: `tokenizeWithRecovery` → `parseTokensToAstWithTrace` → `analyzeSemantics` → `executeAst` → `buildIntermediateRepresentation`.
- **UI state management**: all pipeline state lives in `StartupCompilerApp.tsx`, computed in a `useMemo` over `source`. The pipeline returns a single `PipelineResult` object containing tokens, AST, trace, semantic results, timeline, IR, and error info.
- **Timeline stepping**: steps are indexed (`stepIndex`). Use `prevStep`/`nextStep`/`stepAt` from `@/lib/startup/timeline`.
- **`data-testid` attributes**: all interactive elements and UI cards have stable `data-testid` attributes (e.g., `data-testid="bottom-tab-tokens"`, `data-testid="runtime-event-card-exec-1"`). Use these in E2E tests instead of CSS selectors.
- **Startup CSS classes**: the codebase uses custom `startup-*` prefixed utility classes (defined in `app/globals.css`). Do not replace them with raw Tailwind equivalents without checking the design system.
- **Recovery tracing**: tokenizer and parser both emit recovery events. Tokenizer recoveries are wrapped as `ParserTraceStep` with `phase: "recovery"` and `sourceStage: "tokenizer"`.

---

## 3. File Layout

```
app/                         # Next.js App Router pages and global styles
  layout.tsx                 # Root layout
  page.tsx                   # Home page (renders StartupCompilerApp)
  globals.css                # Tailwind + startup-* utility classes

components/                 # UI panels (editor, AST, tokens, parser, runtime, state, IR)
  StartupCompilerApp.tsx     # Main app shell, pipeline state, all UI wiring
  EditorPanel.tsx            # Monaco editor with custom "startup" language
  ASTPanel.tsx               # React Flow graph
  TokenPanel.tsx             # Token stream display
  ParserTracePanel.tsx       # Parser trace display
  TimelineControls.tsx      # Run/Step controls
  ConsolePanel.tsx           # Output console
  ScopePanel.tsx             # Runtime scope display
  TypeCheckPanel.tsx         # Semantic type check display
  IRPanel.tsx                # IR instruction display

lib/startup/                # Compiler domain logic (no React dependencies)
  tokenizer.ts               # Lexer with panic-mode recovery
  parser.ts                  # Recursive descent parser with phrase-level recovery
  semantic.ts                # Type inference, symbol table, semantic diagnostics
  executor.ts                # AST interpreter, timeline, IR generation
  types.ts                   # All shared types + node guard functions
  timeline.ts                # Timeline navigation helpers
  reactflow.ts               # AST-to-ReactFlow graph conversion
  demo.ts                    # Preloaded demo program

tests/e2e/                  # Playwright E2E specs and fixtures
  compiler-links.spec.ts     # Smoke tests for diagnostics navigation
  fixtures/                  # .startup source fixtures (valid, parser-error, semantic-error)
```

---

## 4. Key Constraints

- **No unit tests** in this repo — only E2E Playwright tests. When modifying compiler behavior, update or add E2E coverage in `tests/e2e/`.
- The **compiler is pure client-side** — no server-side execution, no API routes, no persistence.
- The **Monaco editor uses a custom language** `"startup"` registered via `monaco.languages.register`. When adding new keywords/operators, update `EditorPanel.tsx` in both the Monarch tokenizer and the theme.
- **No Tailwind v4 `@apply`** or custom plugins — utility classes are defined directly in `globals.css`.
- Keep the **synchronization contract** intact: editor line, token highlight, AST node highlight, runtime event, and state snapshot must all stay in sync at any given `stepIndex`.
