# Architecture Principles & Code Style Guide

This document contains the architectural principles, code patterns, and style guidelines observed in this codebase.

## Core Architectural Principles

### Separation of Concerns (SoC)

Each module/file should have a single, well-defined responsibility:

- Configuration logic separate from state management
- Business logic separate from I/O operations
- Type definitions separate from implementation

### Common Closure Principle

Things that change together should be packaged together:

- All config-related code in `config/` module
- All git operations in `git/` module
- All state management in `state/` module

### Small, Composable Units

- Methods max 20 lines of logic (can be longer for formatting/boilerplate)
- Functions should have explicit inputs/outputs
- No speculative abstractions - every abstraction must earn its existence

## Module Organization Pattern

Every module should follow this structure:

```
module-name/
├── types.ts          # Type definitions only (interfaces, types, enums)
├── constants.ts      # All hardcoded values externalized
├── module-name.ts    # Core business logic
└── module-name.test.ts  # Co-located tests
```

### types.ts

- **Purpose**: Type definitions only
- **Contains**: `interface`, `type`, `enum` declarations
- **Exports**: Only types using `export type` or `export interface`
- **Imports**: Other type files only

### constants.ts

- **Purpose**: Externalize all magic strings, numbers, and configuration values
- **Exports**: Named constants in UPPER_SNAKE_CASE
- **See**: "Constants Externalization Rules" section below

### module-name.ts

- **Purpose**: Core business logic and implementation
- **Imports**: Types using `import type`, constants, utilities
- **Exports**: Functions with explicit return types

### module-name.test.ts

- **Purpose**: Unit tests co-located with source
- **Uses**: Vitest (`describe`, `it`, `expect`, `vi.mock()`)

## Constants Externalization Rules

**Golden Rule**: If it's a literal value with semantic meaning, externalize it.

### Always Externalize

**File & Directory Names**

```typescript
// ✅ Good
export const OPENCODE_CONFIG_DIR = ".opencode";
export const STATE_FILE_NAME = "worktree-session-state.json";
export const WORKTREES_DIR = "worktrees";

// ❌ Bad
const configPath = join(repoRoot, ".opencode", "config.json");
```

**Path Components & Separators**

```typescript
// ✅ Good
export const WORKTREE_PATH_SEPARATOR = '/.opencode/worktrees/';
export const CONFIG_SUBDIR = 'config';

// ❌ Bad
if (path.includes('/.opencode/worktrees/')) { ... }
```

**Environment Variable Names**

```typescript
// ✅ Good
export const ENV_OPENCODE_TERMINAL = "OPENCODE_TERMINAL";
export const ENV_TERMINAL = "TERMINAL";

// ❌ Bad
const terminal = process.env.OPENCODE_TERMINAL;
```

**Default Values & Configuration**

```typescript
// ✅ Good
export const DEFAULT_TIMEOUT_MS = 5000;
export const MAX_RETRIES = 3;
export const DEFAULT_BRANCH_PREFIX = "feature/";

// ❌ Bad
setTimeout(callback, 5000);
```

**Command Strings & Messages**

```typescript
// ✅ Good
export const GIT_COMMIT_MESSAGE = "chore(opencode): session snapshot";
export const ERROR_NOT_A_GIT_REPO = "Not a git repository";

// ❌ Bad
execSync('git commit -m "chore(opencode): session snapshot"');
```

**Binary Paths & URLs**

```typescript
// ✅ Good
export const ALACRITTY_BINARY_PATH = '/Applications/Alacritty.app/Contents/MacOS/alacritty';
export const API_BASE_URL = 'https://api.example.com';

// ❌ Bad
if (existsSync('/Applications/Alacritty.app/Contents/MacOS/alacritty')) { ... }
```

**Magic Numbers with Meaning**

```typescript
// ✅ Good
export const HTTP_STATUS_OK = 200;
export const BUFFER_SIZE_KB = 1024;
export const PAGINATION_DEFAULT_LIMIT = 50;

// ❌ Bad
if (response.status === 200) { ... }
```

### When NOT to Externalize

**Obvious Literals**

```typescript
// ✅ OK - self-explanatory
if (arr.length === 0) return [];
const isValid = count > 0;
```

**Single-Use Values**

```typescript
// ✅ OK - used once, no semantic meaning
const padding = " ".repeat(4);
```

**Loop Indices & Common Patterns**

```typescript
// ✅ OK - common patterns
for (let i = 0; i < items.length; i++) { ... }
array.slice(1);
```

## Code Style Rules

### Import Style

**Built-in Modules**

```typescript
// ✅ Good - use node: prefix
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ❌ Bad
import { readFileSync } from "fs";
```

**Type Imports**

```typescript
// ✅ Good - separate type imports
import type { PluginConfig } from "./types.ts";
import { loadConfig } from "./config.ts";

// ❌ Bad
import { PluginConfig, loadConfig } from "./config.ts";
```

**Relative Imports**

```typescript
// ✅ Good - include .ts extension
import { helper } from "./utils.ts";
import type { MyType } from "../types.ts";

// ❌ Bad
import { helper } from "./utils";
```

### Function Style

**Arrow Functions Only**

```typescript
// ✅ Good
const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// ❌ Bad
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Explicit Return Types on Exports**

```typescript
// ✅ Good
export const loadConfig = (dir: string): PluginConfig => { ... };
export const isValidPath = (path: string): boolean => { ... };

// ❌ Bad
export const loadConfig = (dir: string) => { ... };
```

### Naming Conventions

**Variables & Functions**: camelCase

```typescript
const userName = 'john';
const getUserById = (id: string): User => { ... };
```

**Types & Interfaces**: PascalCase

```typescript
interface PluginConfig { ... }
type WorktreeState = { ... };
```

**Constants**: UPPER_SNAKE_CASE

```typescript
export const CONFIG_FILE_NAME = "config.json";
export const MAX_RETRY_ATTEMPTS = 3;
```

**Private/Unused**: Prefix with underscore

```typescript
const _internalHelper = () => { ... };
const handleClick = (_event: Event) => { ... };
```

### Formatting

**Quotes**: Single quotes for strings

```typescript
const message = "Hello world";
```

**Semicolons**: Always required

```typescript
const x = 10;
const y = 20;
```

**Indentation**: 2 spaces

```typescript
const obj = {
  name: "test",
  value: 42,
};
```

**Line Width**: 100 characters max

### Type Safety

**Avoid `any`**

```typescript
// ✅ Good
const parseData = (input: unknown): ParsedData => { ... };

// ❌ Bad
const parseData = (input: any): any => { ... };
```

**Prefer Explicit Types**

```typescript
// ✅ Good
const config: PluginConfig = { ... };
const items: string[] = [];

// ⚠️ OK if obvious
const name = 'john'; // inferred as string
```

## Error Handling

**Empty Catch Blocks OK for Non-Critical**

```typescript
// ✅ OK - expected to fail sometimes
export const loadConfig = (dir: string): PluginConfig => {
  try {
    return JSON.parse(readFileSync(configFile, "utf-8"));
  } catch {
    /* Failed to load config - return empty */
  }
  return {};
};
```

**Throw for Validation Errors**

```typescript
// ✅ Good
if (!isValidInput(input)) {
  throw new Error("Invalid input format");
}
```

## User Communication

**Use TUI not Console**

```typescript
// ✅ Good
client.tui.showToast("Configuration saved");

// ❌ Bad - eslint will error
console.log("Configuration saved");
```

## File System Operations

**Use Path Utilities**

```typescript
// ✅ Good
import { join } from "node:path";
const configPath = join(repoRoot, OPENCODE_CONFIG_DIR, CONFIG_FILE_NAME);

// ❌ Bad
const configPath = `${repoRoot}/.opencode/config.json`;
```

**Check Existence Before Operations**

```typescript
// ✅ Good
import { existsSync, mkdirSync } from "node:fs";
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}
```

## State Management

**Store State in `.opencode/*.json`**

```typescript
// State files go in .opencode directory
const stateFile = join(repoRoot, OPENCODE_CONFIG_DIR, STATE_FILE_NAME);
```

## Testing (Vitest)

**Co-locate Tests**

```
config/
├── config.ts
└── config.test.ts
```

**Mock Pattern**

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("node:fs");

describe("loadConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load valid config", () => {
    vi.mocked(readFileSync).mockReturnValue('{"key": "value"}');
    // test implementation
  });
});
```
