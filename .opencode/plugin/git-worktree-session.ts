import { execSync, spawn } from "node:child_process";
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

const STATE_FILE = join(
	process.cwd(),
	".opencode",
	"worktree-session-state.json",
);

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

function openNewOpencodeSession(worktreePath: string) {
	const platform = process.platform;

	if (platform === "darwin") {
		const child = spawn(
			"osascript",
			[
				`-e`,
				`tell application "Terminal" to do script "cd ${worktreePath} && opencode"`,
			],
			{ detached: true, stdio: "ignore" },
		);
		child.unref();
		return;
	}

	if (platform === "win32") {
		const child = spawn(
			"wt",
			["-w", "0", "nt", "-d", worktreePath, "opencode"],
			{ detached: true, stdio: "ignore" },
		);
		child.unref();
		return;
	}

	const child = spawn(
		"gnome-terminal",
		["--", "bash", "-c", `cd '${worktreePath}' && opencode`],
		{ detached: true, stdio: "ignore" },
	);
	child.unref();
}

export const GitWorktreeSessionPlugin: Plugin = async ({
	client,
	worktree,
}) => {
	return {
		event: async ({ event }) => {
			if (event.type === "session.created") {
				const root = process.cwd();
				if (!isGitRepo(root)) return;
				if (worktree.includes("worktrees")) return;

				// Delay to ensure session is fully initialized
				setTimeout(async () => {
					try {
						const result = await client.session.prompt({
							path: { id: event.properties.info.id },
							body: {
								noReply: true,
								parts: [
									{
										type: "text",
										text: "IMPORTANT: A 'createworktree' tool is available for creating isolated git worktrees. When the user mentions creating a branch or feature, proactively suggest or use this tool.",
									},
								],
							},
						});
                        // log data to file for debugging
                        writeFileSync(
                            join(process.cwd(), ".opencode", "worktree-hint-log.json"),
                            JSON.stringify(result, null, 2),
                        );
					} catch (error) {
						const errorDetails = {
							message: error instanceof Error ? error.message : String(error),
							stack: error instanceof Error ? error.stack : undefined,
							error: error,
						};
						writeFileSync(
							join(process.cwd(), ".opencode", "worktree-hint-error.json"),
							JSON.stringify(errorDetails, null, 2),
						);
                        // show toast on error
                        client.tui.showToast({
                            body: {
                                title: "Worktree Hint Error",
                                message: String(error),
                                variant: "error",
                            },
                        });
					}
				}, 1000);
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
			createworktree: tool({
				description:
					"Creates a git worktree for this session and automatically launches a new opencode instance in it.",
				args: {
					branch: tool.schema
						.string()
						.describe("The branch name for the worktree"),
				},
				async execute({ branch }) {
					const root = process.cwd();

					if (!isGitRepo(root)) return "Not a git repo";

					const baseBranch = currentBranch(root);
					if (!baseBranch) return "detached";

					if (branchExistsLocal(branch, root)) return "Local branch exists";
					if (branchExistsRemote(branch, root)) return "Remote exists";

					const worktreesRoot = join(root, ".opencode", "worktrees");
					const worktreePath = join(worktreesRoot, branch);

					if (!existsSync(worktreesRoot))
						mkdirSync(worktreesRoot, { recursive: true });

					run(
						`git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
						root,
					);

					setState({ branch, worktreePath });

					client.tui.showToast({
						body: {
							title: "Launching Session",
							message: `Opening opencode in ${branch}`,
							variant: "info",
						},
					});

					openNewOpencodeSession(worktreePath);

					return `Created worktree ${worktreePath} for branch ${branch}. A new opencode instance is opening there now.`;
				},
			}),
		},
	};
};
