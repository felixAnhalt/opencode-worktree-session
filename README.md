# opencode-worktree-session

A plugin for [OpenCode](https://opencode.ai) that automatically manages Git worktrees for every AI session. It was not built by the OpenCode team and is not affiliated with them in any way.

This plugin ensures your main working directory remains clean while the AI works in an isolated branch. On session end, it automatically generates a commit message, pushes the branch, and removes the worktree.

## Features

- **Isolation:** Automatically creates a new Git worktree in `.opencode/worktrees/`.
- **Safety:** Refuses to run on the `main` branch to prevent accidental corruption.
- **Context-Aware:** Pivots the AI's working directory (`cwd`) to the worktree automatically.
- **Automated Cleanup:** Commits changes using AI-generated messages and deletes the worktree upon exit.

## Installation

1. Create a directory for the plugin in your OpenCode project:
   ```bash
   mkdir -p .opencode/plugins/git-worktree-session

2. Copy the plugin file into that directory.
3. OpenCode will automatically detect and load the plugin on the next session start.

## Workflow

1. **Start Session:** Run `opencode`.
2. **Branch Prompt:** You will be prompted for a branch suffix (e.g., `feature-xyz`).
3. **Worktree Creation:** The plugin creates `opencode/feature-xyz` and moves the session into that path.
4. **Execution:** The AI performs tasks inside the isolated worktree.
5. **Exit:** Upon closing the session, the plugin:
* Stages all changes.
* Generates a commit message via OpenCode API.
* Pushes to `origin`.
* Removes the worktree safely.



## Requirements

* Node.js runtime
* Git installed and configured in PATH
* OpenCode CLI

## License

Apache License 2.0
