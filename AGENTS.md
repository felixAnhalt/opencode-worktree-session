# OpenCode Worktree Session Plugin

**Commands:**

- `bun run typecheck|lint|format|test|build` - Standard ops
- `bun test path/to/file.test.ts` - Single test
- `bun test --grep "pattern"` - Test by pattern
- `mise run test|lint|format|build` - Mise tasks

**Code Style:**

- `node:` prefix for built-ins (`node:fs`, `node:path`, `node:child_process`)
- `import type { X } from 'y'` for types, `.ts` in relative imports
- `const fn = (): RetType => {}` - no `function` keyword, explicit return types on exports
- Single quotes, semicolons required, 2-space indent, 100 char width
- camelCase vars/fns, PascalCase types/exports, UPPER_CASE constants
- Avoid `any`, unused vars prefix with `_`
- Empty catch blocks OK for non-critical, `throw new Error()` for validation
- Use `client.tui.showToast()` not console (eslint errors on console)
- `join()` for paths, `existsSync()` for checks, state in `.opencode/*.json`

**Tests (Vitest):**

- `*.test.ts` next to source, use `vi.mock()`, `vi.mocked()`, `vi.clearAllMocks()` in `beforeEach()`
