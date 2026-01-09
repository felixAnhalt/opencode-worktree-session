# opencode-worktree-session

A plugin for [OpenCode](https://opencode.ai) that automatically manages Git worktrees for every AI session created from the [opencode-plugin-template](https://github.com/zenobi-us/opencode-plugin-template).

This plugin ensures your main working directory remains clean while the AI works in an isolated branch. On session end, it automatically generates a commit message, pushes the branch, and removes the worktree.

## Features

- **Isolation:** Automatically creates a new Git worktree in `.opencode/worktrees/`.
- **Safety:** Refuses to run on the `main` branch to prevent accidental corruption.
- **Context-Aware:** Pivots the AI's working directory (`cwd`) to the worktree automatically.
- **Automated Cleanup:** Commits changes using AI-generated messages and deletes the worktree upon exit.

## Installation

### NPM

Add to your `opencode.json`:

```json
{
  "plugin": ["@tmegit/opencode-worktree-session"]
}
```

## Workflow

1. **Start Session:** Run `opencode`.
2. **Branch Prompt:** You will be prompted for a branch suffix (e.g., `feature-xyz`).
3. **Worktree Creation:** The plugin creates `opencode/feature-xyz` and moves the session into that path.
4. **Execution:** The AI performs tasks inside the isolated worktree.
5. **Exit:** Upon closing the session, the plugin:

- Stages all changes.
- Generates a commit message via OpenCode API.
- Pushes to `origin`.
- Removes the worktree safely.

### Demo Videos

- **[Creating a Worktree](resources/create_worktree.mov)** - See how the plugin automatically sets up an isolated Git worktree for your session.
- **[Deleting a Worktree](resources/delete_worktree.mov)** - Watch the automatic cleanup process as the session ends.


## Requirements

- Node.js runtime
- Git installed and configured in PATH
- OpenCode CLI

## Config

Example (save as `.opencode/opencode-worktree-session-config.json`):

```json
{
  "terminal": {
    "mode": "custom",
    "bin": "alacritty",
    "args": "",
    "workingDirectoryArgument": "--working-directory",
    "commandFlag": "-e"
  },
  "postWorktree": {
    "cmd": "webstorm",
    "args": ""
  },
  "configToolsAvailable": false
}
```

Configure the plugin in `.opencode/opencode-worktree-session-config.json`.

- `terminal` — Controls how the plugin launches a terminal.
  - `mode` — launch mode: `default` | `custom` | `specific`
  - `bin` — terminal binary
  - `args` — extra args
  - `workingDirectoryArgument` — workdir flag
  - `commandFlag` — command flag
  - `terminal` (specific mode) — `Alacritty`, `iTerm`, `iTerm2`, `Terminal`

- `postWorktree` — Command run after worktree creation.
  - `cmd` — command to run
  - `args` — command args

- `configToolsAvailable` — Enable or disable config helper tools (affects `setpostworktree`, `setworktreesync`, `setterminal`).
  - `boolean` — true/false

Note: change `configToolsAvailable` and restart your OpenCode session for it to take effect.

## Development

- `bun run typecheck` - TypeScript type checking
- `bun run lint` - Fix linting issues
- `bun run format` - Format code with Prettier
- `bun run test` - Run tests
- `bun run build` - Build the plugin

## License

Apache License 2.0
