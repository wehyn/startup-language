# Startup Language Compiler Visualizer

Interactive compiler playground for the `.startup` DSL, built with Next.js + TypeScript.
The app visualizes the full pipeline: tokenization, parsing, semantic analysis, execution timeline,
intermediate representation (IR), and explainability events (including recovery strategies).

## What You Can Do

- Write and run `.startup` programs in the browser.
- Inspect tokenizer output and parser traces step by step.
- See semantic type checks, symbol table updates, and runtime state.
- Explore recovery behavior:
  - Phrase-Level Recovery (missing statement terminator insertion)
  - Panic Mode Recovery (invalid token skip and continue)
- View generated IR and runtime stack/timeline side by side.

## Quick Start

Prerequisites:

- Node.js 20+
- npm

Install and run:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Example `.startup` Program

```startup
CLASS Startup?

BURN runway ::> 6?
EQUITY urgent ::> runway <<< 9?
VIBE product ::> NEW Startup?

PIVOT (urgent ??? VESTED) [
  PITCH "Raise now"?
]

PITCH product?
```

Recovery examples:

```startup
// Phrase-Level Recovery: missing '?' auto-inserted
BURN quota ::> 10

// Panic Mode Recovery: invalid token is skipped
BURN clean ::> 5$?
PITCH clean?
```

## Compiler Pipeline

1. Tokenizer: scans source into typed tokens and panic recoveries.
2. Parser: builds AST + parser trace with recovery entries.
3. Semantic analysis: type inference, symbol checks, semantic diagnostics.
4. Execution: interprets AST and records timeline/state/output.
5. IR generation: emits instruction-like representation for inspection.

## Project Structure

- `app/` - Next.js App Router entrypoints and global styles.
- `components/` - UI panels (editor, tokens, parser, runtime, state, IR).
- `lib/startup/` - compiler domain logic (tokenizer/parser/semantic/executor/IR).
- `tests/e2e/` - Playwright end-to-end specs and fixtures.

## Development Commands

Run all commands from repository root.

```bash
# install deps exactly from lockfile
npm ci

# local dev server
npm run dev

# lint
npm run lint

# production build
npm run build

# start built app
npm run start

# e2e tests
npm run test:e2e
```

Useful Playwright one-offs:

```bash
npx playwright test tests/e2e/compiler-links.spec.ts
npx playwright test -g "token click highlights token row"
npx playwright test tests/e2e/compiler-links.spec.ts -g "runtime diagnostic opens errors pane"
```

## CI Parity Checklist

Before opening a PR:

```bash
npm ci
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

CI workflow: `.github/workflows/ci.yml`

## Contributing

- Use TypeScript (`strict` mode) and existing project conventions.
- Keep changes focused; avoid broad refactors unless requested.
- Prefer stable test selectors via `data-testid`.
- Add/update E2E coverage when behavior changes.

See `AGENTS.md` for detailed local engineering guidelines.
