# OpenCode Plugin Development

This is a TypeScript OpenCode plugin - no build steps required, files are loaded directly.

**Commands:**
- `npm test` - Run all tests
- `npm run test -- tests/plugin.test.ts` - Run single test file
- `npm run test:ui` - Run tests with UI
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run Biome linter and auto-fix issues
- `npm run format` - Format code with Biome

**Code Style:**
- Use `node:` prefix for built-in imports (`node:child_process`, `node:fs`, `node:path`, etc.)
- Type imports with `type` keyword: `import type { Plugin } from "@opencode-ai/plugin"`
- Use `const` for all function declarations; no semicolons
- Export plugins as named constants: `export const PluginName: Plugin = async (...) => {...}`
- CamelCase for functions, UPPER_CASE for constants, PascalCase for plugin exports
- Empty catch blocks acceptable for non-critical failures
- Use `throw new Error()` for validation errors
- Use `console.log()` for info, `console.error()` for errors
- Prefer `process.cwd()` over hardcoded paths
- State stored in `.opencode/` directory with JSON files
- Use `join()` for path construction, `existsSync()` for file checks
- Run `npm run lint` before committing to fix formatting issues
