import { execSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tool, type Plugin } from "@opencode-ai/plugin";

type State = {
    branch?: string;
    worktreePath?: string;
};

const STATE_FILE = join(process.cwd(), ".opencode", "worktree-session-state.json");

function getState(): State {
    try {
        if (existsSync(STATE_FILE)) {
            return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
        }
    } catch {}
    return {};
}

function setState(state: State): void {
    const dir = join(process.cwd(), ".opencode");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
    try {
        unlinkSync(STATE_FILE);
    } catch {}
}

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
    })
        .toString()
        .trim();
}

function isGitRepo(cwd: string): boolean {
    try {
        run("git rev-parse --is-inside-work-tree", cwd);
        return true;
    } catch {
        return false;
    }
}

function currentBranch(cwd: string): string {
    return run("git branch --show-current", cwd);
}

function hasChanges(cwd: string): boolean {
    return run("git status --porcelain", cwd).length > 0;
}

function branchExistsLocal(branch: string, cwd: string): boolean {
    try {
        run(`git show-ref --verify --quiet refs/heads/${branch}`, cwd);
        return true;
    } catch {
        return false;
    }
}

function branchExistsRemote(branch: string, cwd: string): boolean {
    try {
        run(`git ls-remote --exit-code --heads origin ${branch}`, cwd);
        return true;
    } catch {
        return false;
    }
}

export const GitWorktreeSessionPlugin: Plugin = async ({ client }) => {
    return {
        event: async ({ event }) => {
            if (event.type === "session.created") {
                const root = process.cwd();

                if (!isGitRepo(root)) {
                    client.tui.showToast({
                        body: {
                            title: "Git Error",
                            message: "Not a git repo",
                            variant: "error",
                        },
                    });
                    return;
                }

                const baseBranch = currentBranch(root);
                if (!baseBranch) return;

                if (baseBranch === "main") {
                    client.tui.showToast({
                        body: {
                            title: "Blocked",
                            message: "Refusing on main",
                            variant: "warning",
                        },
                    });
                    return;
                }

                client.tui.showToast({
                    body: {
                        title: "Session Created",
                        message: "Run /createWorktree branch=feat/... to start",
                        variant: "info",
                    },
                });
            }

            if (event.type === "session.deleted") {
                const state = getState();
                if (!state.branch || !state.worktreePath) return;

                const root = process.cwd();
                const cwd = state.worktreePath;

                try {
                    if (hasChanges(cwd)) {
                        run("git add -A", cwd);
                        run(`git commit -m "chore(opencode): session snapshot"`, cwd);
                        run(`git push -u origin "${state.branch}"`, cwd);
                    }

                    run(`git worktree remove "${state.worktreePath}" --force`, root);

                    client.tui.showToast({
                        body: {
                            title: "Session Saved",
                            message: `Committed & cleaned ${state.branch}`,
                            variant: "success",
                        },
                    });
                } catch (err) {
                    client.tui.showToast({
                        body: {
                            title: "Cleanup Failed",
                            message: String(err),
                            variant: "error",
                        },
                    });
                } finally {
                    clearState();
                }
            }
        },

        tool: {
            createWorktree: tool({
                description: "Create git worktree for this session",
                args: {
                    branch: tool.schema.string(),
                },
                async execute({ branch }) {
                    const root = process.cwd();

                    if (!isGitRepo(root)) return "Not a git repo";

                    const baseBranch = currentBranch(root);
                    if (!baseBranch) return "Detached HEAD";

                    if (branchExistsLocal(branch, root)) return "Local branch exists";
                    if (branchExistsRemote(branch, root)) return "Remote exists";

                    const worktreesRoot = join(root, ".opencode", "worktrees");
                    const worktreePath = join(worktreesRoot, branch);

                    if (!existsSync(worktreesRoot)) mkdirSync(worktreesRoot, { recursive: true });

                    run(`git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`, root);

                    setState({ branch, worktreePath });

                    // Inside your execute function
                    await client.tui.executeCommand({
                        body: {
                            command: `cd ${worktreePath}`
                        }
                    });

                    client.tui.showToast({
                        body: {
                            title: "Worktree Active",
                            message: `AI context moved to ${worktreePath}`,
                            variant: "success",
                        },
                    });

                    return `Created worktree ${branch}`;
                },
            }),
        },
    };
};
