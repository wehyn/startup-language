# Master PRD v3: Project `startup`

**Status:** Implementation Aligned  
**Project Lead:** Wayne  
**Platform:** Next.js (App Router, client-side compiler pipeline)  
**Objective:** Build an explicit, synchronized visual compiler for `.startup` where **lexing, parsing, semantic analysis, IR, and execution timeline** are inspectable and step-traceable.

---

## I. Product Definition

### 1. Primary Goal

Make compiler stages visible and connected:

```text
SOURCE -> TOKENS -> AST -> SEMANTIC -> IR -> EXECUTION
```

Every execution step must keep UI surfaces synchronized (editor line, token range, AST node, runtime log, state snapshot).

### 2. Success Criteria

- User can edit `.startup` source and see updated tokens, AST, semantic diagnostics, IR, and execution timeline.
- User can step backward/forward through timeline snapshots deterministically.
- Error and diagnostic navigation can jump user back to source location.
- Token <-> AST <-> source highlighting works bidirectionally.

---

## II. Language: `.startup` (Current Implemented Spec)

### 1. Data Types

- `Burn` (number)
- `Vibe` (string)
- `Equity` (boolean: `VESTED`/`CLIFF`)
- `Portfolio` (array/list)

### 2. Statements

- Declaration  
  `Burn x ::> 10?`
- Assignment  
  `x ::> x +++ 1?`
- Conditional  
  `PIVOT (x >>> 5) [ ... ]`
- Loop  
  `SPRINT (x <<< 10) [ ... ]`
- Output  
  `PITCH x?`
- Input  
  `ACQUIRE founderName?` (or `ACQUIRE?`)
- Exit  
  `EXIT?`
- Class declaration  
  `CLASS Startup?`
- Instantiation expression  
  `Vibe obj ::> NEW Startup?`

### 3. Operators and Syntax

- Assignment: `::>`
- Arithmetic: `+++`, `---`, `******`, `///`
- Comparison: `>>>`, `<<<`, `???`, `!!?`
- Logic: `AND`, `OR`, `NOT`
- Block delimiters: `[ ]`
- Grouping: `( )`
- Terminator: `?`
- Line comments: `// ...`
- Naming convention:
  - variables: camelCase
  - classes: PascalCase

### 4. Recovery Aliases (Accepted Input Forms)

The tokenizer/parser currently normalizes:
- `~` -> `::>`
- `+` -> `+++`
- `-` -> `---`
- `*` -> `******`
- `/` -> `///`
- `.` -> `?`

These are accepted for resilience and normalized into canonical DSL tokens.

---

## III. Compiler Pipeline Contract

### 1. Source -> Tokens (Lexical)

- Produces token stream with `type`, `value`, `line`, `column`.
- Token types: `KEYWORD`, `IDENTIFIER`, `LITERAL`, `OPERATOR`, `DELIMITER`, `INVALID`.
- Includes panic-mode token recovery trace for invalid lexemes.

### 2. Tokens -> AST (Syntax)

- Parser builds AST with node IDs and token spans.
- Node types include:
  - `Program`, `Declaration`, `Assignment`, `Class`, `If`, `Loop`, `Pitch`, `Acquire`, `Exit`, `BinaryExpr`.
- Includes parser trace events (node builds + recoveries).

### 3. AST -> Semantic

- Type inference/validation for declarations, assignments, expressions, conditions.
- Symbol table tracking.
- Semantic issues and explainability logs generated.

### 4. AST -> IR

- Intermediate representation emitted before execution.
- Includes opcode, args, source line metadata.

### 5. AST Walk -> Execution Timeline

- Execution traverses AST top-level children and nested blocks.
- Each meaningful action emits one `ExecutionStep`.
- Runtime state snapshots include variables, stack, scope frames, output.

---

## IV. Error Handling and Recovery

### 1. Tokenizer Recovery

- Panic-mode recovery: invalid token/literal is recorded, parser continues where possible.

### 2. Parser Recovery

- Phrase-level recovery: missing `?` can be inserted logically.
- Panic-mode for invalid tokens in expressions/statements where possible.

### 3. Diagnostics Surfaces

Diagnostics are split by stage:
- Tokenizer
- Parser
- Semantic
- Runtime

Each diagnostic can be mapped to source location (line/column) and surfaced in UI navigation.

---

## V. UI Architecture (Current)

## Layout

- Full-screen shell with:
  - Top controls/header tabs
  - Main pipeline workspace
  - Bottom tabbed inspection area

### 1. Header Tabs

- Pipeline workspace
- Quick reference ("Founder’s Playbook")

### 2. Pipeline Workspace

- Timeline controls (run + step prev/next)
- Diagnostics summary row
- Main split:
  - Editor panel (Monaco, custom `startup` language)
  - AST panel (React Flow)

### 3. Bottom Tabbed Area

- Runtime (events/output/errors)
- Tokens
- Parser trace
- State + Scope
- IR + Stack

### 4. State + Scope Subtabs

- Cap Table (runtime variables)
- Scope Stack
- Type Check
- Explainability logs

---

## VI. Synchronization Contract

At any active timeline step:

- Editor highlights active execution line.
- Token panel highlights active/selected token range.
- AST highlights active/selected node.
- Runtime events show cumulative logs up to current step.
- State views reflect snapshot at current step (not recomputed from scratch).
- IR panel highlights by active source line when applicable.

Desync between these surfaces is a product defect.

---

## VII. Preloaded Demo Program (Current)

```startup
BURN runway ::> 18?
VIBE mission ::> "Build calm tools"?
EQUITY vested ::> VESTED?
BURN focus ::> 100?

PITCH mission?
PITCH runway?
PITCH focus?
```

---

## VIII. Data Structures (Implementation-Aligned)

```ts
type TokenType =
  | "KEYWORD"
  | "IDENTIFIER"
  | "LITERAL"
  | "OPERATOR"
  | "DELIMITER"
  | "INVALID";

type Token = {
  type: TokenType;
  value: string;
  line: number;
  column: number;
};

type ASTNodeType =
  | "Program"
  | "Declaration"
  | "Assignment"
  | "Class"
  | "If"
  | "Loop"
  | "Pitch"
  | "Acquire"
  | "Exit"
  | "BinaryExpr";

type ASTNode = {
  id: string;
  type: ASTNodeType;
  value?: unknown;
  children?: ASTNode[];
  line: number;
  startToken?: number;
  endToken?: number;
};

type ValueType = "Burn" | "Vibe" | "Equity" | "Portfolio";
type RuntimeValue = number | string | boolean | RuntimeValue[];

type VariableState = {
  type: ValueType;
  value: RuntimeValue;
};

type StackFrame = {
  id: string;
  label: string;
  line: number;
};

type ScopeEnvironment = {
  id: string;
  label: string;
  level: number;
  line: number;
  variables: Record<string, VariableState>;
};

type ExecutionStep = {
  stepId: number;
  activeNodeId: string;
  line: number;
  variables: Record<string, VariableState>;
  stack: StackFrame[];
  scopes: ScopeEnvironment[];
  log: string;
  output: string[];
};

type Timeline = ExecutionStep[];

type IRInstruction = {
  index: number;
  line: number;
  opcode: string;
  args: string[];
  note?: string;
};
```

---

## IX. Tech Stack

- Next.js (App Router)
- React + TypeScript
- Monaco Editor (`@monaco-editor/react`)
- React Flow (`@xyflow/react`)
- Tailwind CSS
- Playwright (E2E tests)

---

## X. Guardrails (v3)

### In Scope

- Visual compiler learning/inspection workflow
- Deterministic AST-walk execution timeline
- Stage-aware diagnostics and source navigation
- Semantic/type feedback and IR visualization

### Out of Scope (for now)

- Full general-purpose language features (functions/modules/imports)
- Optimizing compiler backend
- Persistent project/file management
- Networked or server-side execution

---

## XI. Acceptance Checklist

- [ ] Source edits recompile full pipeline
- [ ] Tokens, AST, semantic, IR, execution all render for valid source
- [ ] Timeline stepping updates all synchronized views
- [ ] Parser and semantic issues are visible and navigable
- [ ] Runtime errors map back to source
- [ ] Preloaded demo executes and shows expected output/state transitions
