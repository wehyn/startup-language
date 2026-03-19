
---

# 🔥 Master PRD v2: Project “startup”

**Status:** Implementation Ready
**Project Lead:** Wayne
**Platform:** Next.js (Client-Side)
**Objective:** Build a visual compiler system that makes **Lexical → Syntax → Execution** transformations explicit, synchronized, and step-traceable.

---

# I. Core System Definition

## 1. Language: `.startup` (Custom Minimal DSL)

### Supported Constructs (LOCKED)

```startup
Burn x ::> 10?
Burn y ::> x +++ 5?

PIVOT (x >>> 5) [
  Burn z ::> 1?
]

SPRINT (x <<< 10) [
  x ::> x +++ 1?
]
```

### Features:

* Variable declaration (`Burn`)
* Assignment (`::>`)
* Arithmetic (`+++`, `---`, `******`, `///`)
* Comparison (`>>>`, `<<<`, `???`, `!!?`)
* Conditional (`PIVOT`)
* Loop (`SPRINT`)
* Terminator (`?`)

👉 No additional features allowed in V1.

### I. Language Specification (The Logic)

- Data Types: Burn (Numeric): Integers or floats representing capital or runway. Vibe (String): Textual values representing branding or mission. Equity (Boolean): Logic states: VESTED (True) or CLIFF (False). Portfolio (Array/List): A collection of heterogeneous data types.
- Operators & Syntax: Assignment (::>): The Disruptor. Binds values to identifiers. Terminator (?): The Pivot. Mandated for every statement ending. Arithmetic: +++ (Add), --- (Sub), ****** (Mul), /// (Div). Comparison: ??? (Equal), !!? (Not Equal), >>> (Greater), <<< (Less). Logic: AND, OR, NOT. Delimiters: [ ] for code blocks (loops, conditionals). Comments: // ignores all subsequent text on that line. Convention: Strictly camelCase for all variable naming.
- Control Flow & I/O: PIVOT: Conditional branch (If/Else). SPRINT: Loop structure (While/For). PITCH: Display output to the console. ACQUIRE: Receive user input. EXIT: Terminate program (The "IPO").

---

## 2. Execution Model

### ✅ AST-Walk Execution

* Execution traverses AST nodes
* Each node visit = **one timeline step**
* All UI elements sync to node execution

---

## 3. Compiler Pipeline (Explicitly Visible)

```text
SOURCE → TOKENS → AST → EXECUTION
```

### Outputs:

* Tokens (Lexical)
* AST Graph (Syntax)
* Timeline + State (Execution)

---

# II. UI Architecture (3-Zone Layout)

## Layout Grid

```text
| Editor (40%) | AST + Tokens (60%) |
|--------------|--------------------|
| Console + Timeline (Bottom 30%)  |
```

---

## 1. Editor Panel

* Monaco Editor
* Preloaded demo code (mandatory)
* Active line highlighting
* Monospace font (JetBrains Mono / Fira Code)
* Font size: 12–13px

---

## 2. Pipeline + Visualization Panel

### A. Pipeline Header

```text
SOURCE → TOKENS → AST → EXECUTION
```

---

### B. Token Panel

Displays token stream:

```text
[KEYWORD] Burn
[IDENTIFIER] x
[OPERATOR] ::>
[LITERAL] 10
```

#### Interaction:

* Hover token → highlight code
* Active phase → emphasized

---

### C. AST Graph (React Flow)

#### Rules:

* Nodes = meaningful statements only
* Edges = control flow
* Click node → highlight editor line
* Active node → bright highlight

---

## 3. Console + State Panel

### A. Execution Logs

```text
[EXEC] Declaring x = 10
[EXEC] Evaluating (x > 5) → true
```

* Minimal, precise
* No theatrical narration

---

### B. Symbol Table

```text
Name | Type | Value
x    | Burn | 10
y    | Burn | 15
```

---

### C. Timeline Controls

* ◀ Step Back
* ▶ Step Forward
* Step indicator:

  ```
  Step 2 / 6
  ```

---

# III. UI Theme: “Dark Island — Functional Minimal”

## Principle

> Visuals exist only to improve comprehension.

---

## Base Colors

* Background: `#0D0D0E`
* Panel: `rgba(255,255,255,0.04)`
* Border: `rgba(255,255,255,0.08)`
* Text Primary: `#FFFFFF`
* Text Secondary: `#A1A1AA`

---

## Semantic Colors

### Tokens

* Keyword → `#60A5FA`
* Identifier → `#E5E7EB`
* Literal → `#34D399`
* Operator → `#F472B6`
* Delimiter → `#A78BFA`

---

### Execution

* Active Node → White highlight
* Inactive → 40% opacity
* Active Line → subtle white background

---

### Status

* Error → `#F87171`

---

## Panels (“Islands” Simplified)

* Border radius: 16px
* Padding: 16–20px
* Optional blur: 10–15px

---

## Motion Rules

Allowed:

* Fade transitions (150–200ms)
* Node highlight transitions

Removed:

* Parallax
* Tilt
* Audio
* Decorative animations

---

# IV. System Flow

```text
User Code
   ↓
Tokenizer
   ↓
Parser → AST
   ↓
Execution Engine (AST Walk)
   ↓
Timeline Generated
```

---

# V. Data Structures

## 1. Token

```ts
type Token = {
  type: 'KEYWORD' | 'IDENTIFIER' | 'LITERAL' | 'OPERATOR' | 'DELIMITER';
  value: string;
  line: number;
  column: number;
};
```

---

## 2. AST Node

```ts
type ASTNode = {
  id: string;
  type: 'Program' | 'Declaration' | 'Assignment' | 'If' | 'Loop' | 'BinaryExpr';
  value?: any;
  children?: ASTNode[];
  line: number;
};
```

---

## 3. Execution Step

```ts
type ExecutionStep = {
  stepId: number;
  activeNodeId: string;
  line: number;
  variables: Record<string, {
    type: 'Burn';
    value: number;
  }>;
  log: string;
};
```

---

## 4. Timeline

```ts
type Timeline = ExecutionStep[];
```

---

# VI. Execution Engine (AST-Walk)

### Core Logic

```ts
function execute(node, state) {
  switch(node.type) {

    case 'Declaration':
      // evaluate expression
      // assign variable
      // push timeline step
      break;

    case 'If':
      // evaluate condition
      // push step
      // execute children if true
      break;

    case 'Loop':
      // evaluate repeatedly
      // push step per iteration
      break;
  }
}
```

---

## Rule:

👉 Every meaningful action = one timeline step

---

# VII. Timeline System

## Behavior

* Forward → next step
* Backward → previous step

---

## State Strategy

✅ Snapshot-based state

* Each step stores full variable state
* No recomputation

---

# VIII. Visual Synchronization Contract

At every step, update:

| Component    | Behavior              |
| ------------ | --------------------- |
| Editor       | Highlight active line |
| AST Graph    | Highlight node        |
| Console      | Show log              |
| Symbol Table | Replace with snapshot |

👉 Desync = system failure

---

# IX. Preloaded Demo (MANDATORY)

```startup
Burn x ::> 2?
Burn y ::> x +++ 3?

PIVOT (y >>> 4) [
  Burn z ::> y +++ 1?
]
```

---

# X. Tech Stack

* Next.js (App Router)
* Monaco Editor
* React Flow
* Tailwind CSS

---

# XI. Build Order (Non-Negotiable)

## Phase 1

* Tokenizer (even hardcoded initially)
* Token panel

## Phase 2

* Parser → AST
* Static AST render

## Phase 3

* Execution engine
* Timeline generation

## Phase 4

* Step controls
* UI synchronization

---

# Final Verdict

This version is:

* Focused
* Technically aligned
* Demo-optimized
* Actually finishable

If you fail now, it won’t be because this is unclear.

It’ll be because you:

* overbuild again
* or hesitate to implement

---
