# OpenCode Plugin Development

This is a TypeScript OpenCode plugin - no build steps required, files are loaded directly.

**Commands:**
- `bun run typecheck` - TypeScript type checking
- `bun run lint` - Fix linting issues
- `bun run format` - Format code with Prettier
- `bun run test` - Run tests
- `bun run build` - Build the plugin

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
