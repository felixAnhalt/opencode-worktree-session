import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Plugin } from "@opencode-ai/plugin";

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
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
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

export const GitWorktreeSessionPlugin: Plugin = async ({ $ }) => {
	console.log("[git-worktree-session] Plugin loaded");
	return {
		event: async ({ event }) => {
			console.log(`[git-worktree-session] Event: ${event.type}`);
            await $`osascript -e 'display notification "${event.type}" with title "opencode"'`


            if (event.type === "session.created") {
				console.log("[git-worktree-session] Session created");
				const root = process.cwd();

				if (!isGitRepo(root)) {
					throw new Error("Not a git repository");
				}

				const baseBranch = currentBranch(root);
				if (!baseBranch) {
					throw new Error("Detached HEAD not supported");
				}

				if (baseBranch === "main") {
					throw new Error("Refusing to run on main");
				}

				const input = await prompt({
					message: "Branch name (e.g. feat/ABC-123):",
					required: true,
				});

				const branch = `opencode/${input}`;

				if (branchExistsLocal(branch, root)) {
					throw new Error(`Local branch already exists: ${branch}`);
				}

				if (branchExistsRemote(branch, root)) {
					throw new Error(`Remote branch already exists: origin/${branch}`);
				}

				const worktreesRoot = join(root, ".opencode", "worktrees");
				const worktreePath = join(worktreesRoot, branch);

				if (!existsSync(worktreesRoot)) {
					mkdirSync(worktreesRoot, { recursive: true });
				}

				run(
					`git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
					root,
				);

				const state: State = {
					branch,
					worktreePath,
				};
				setState(state);

				console.log(`Worktree created: ${worktreePath}`);
				console.log(`Branch: ${branch}`);
			}

			if (event.type === "session.deleted") {
				console.log("[git-worktree-session] Session deleted");
				const state = getState();
				if (!state.branch || !state.worktreePath) return;

				const root = process.cwd();
				const cwd = state.worktreePath;

				try {
					if (hasChanges(cwd)) {
						const message = "chore(opencode): session snapshot";

						run("git add -A", cwd);
						run(`git commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
						run(`git push -u origin "${state.branch}"`, cwd);
					}

					run(`git worktree remove "${state.worktreePath}" --force`, root);

					console.log("Session committed, pushed, and cleaned up");
				} catch (err) {
					console.error(`Session cleanup failed: ${String(err)}`);
				} finally {
					clearState();
				}
			}
		},
	};
};

function prompt(options: {
	message: string;
	required?: boolean;
}): Promise<string> {
	const mock = (
		globalThis as unknown as {
			__test_prompt_mock__?: (opts: typeof options) => Promise<string>;
		}
	).__test_prompt_mock__;

	if (mock) {
		return mock(options);
	}

	const readline = require("node:readline");
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(`${options.message} `, (answer: string) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}
