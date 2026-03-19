# Startup Compiler Visualizer - Improvements

## Phase 1: Semantic Analysis Visualization

- [x] **Type Check Panel** - Add dedicated panel showing type inference for each variable
  - Display inferred type vs declared type
  - Show type errors with source line/column locations
  - Display symbol table (variable name → type mapping)

## Phase 2: Cross-Reference Visualizations

- [x] **Token↔AST Binding** - Hover/click token highlights related AST node(s)
- [x] **AST→Token Binding** - Click AST node highlights source token range

## Phase 3: Parser Visualization

- [x] **Step-through Parser Mode** - Build AST node-by-node showing grammar rules
- [x] **Production Rule Highlighting** - Show which BNF rule matched at each step

## Phase 4: Error Handling

- [x] **Error Token Highlighting** - Mark error tokens in red in TokenPanel
- [x] **Error Node Highlighting** - Mark error nodes in red in AST
- [ ] **Error Arrows** - Draw arrows from error messages to source location

## Phase 5: Lower-Level Visualization

- [ ] **IR/Bytecode Panel** - Show intermediate representation before execution
- [ ] **Execution Stack View** - Show call stack during execution

## Phase 6: Scope & Environment

- [ ] **Scope Visualization** - Show nested scopes created by PIVOT/SPRINT blocks
- [ ] **Environment Table** - Display active variables per scope level

## Phase 7: Polish

- [x] **Pipeline Stage Indicators** - Show which pipeline stage is currently active
- [ ] **Animated Transitions** - Smooth animations between pipeline stages
- [x] **Keyboard Navigation** - Arrow keys to step through timeline
