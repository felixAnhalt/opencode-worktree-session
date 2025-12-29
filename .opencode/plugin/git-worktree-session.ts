import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Plugin, tool } from "@opencode-ai/plugin";

type SessionState = {
	sessionId: string;
	branch?: string;
	worktreePath?: string;
	createdAt: number;
};

type StateFile = {
	sessions: Record<string, SessionState>;
};

function getStateFilePath(repoRoot: string): string {
	return join(repoRoot, ".opencode", "worktree-session-state.json");
}

function readStateFile(repoRoot: string): StateFile {
	try {
		const stateFile = getStateFilePath(repoRoot);
		if (existsSync(stateFile)) {
			return JSON.parse(readFileSync(stateFile, "utf-8"));
		}
	} catch {}
	return { sessions: {} };
}

function writeStateFile(repoRoot: string, state: StateFile) {
	const dir = join(repoRoot, ".opencode");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const stateFile = getStateFilePath(repoRoot);
	writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function upsertSession(
	repoRoot: string,
	sessionId: string,
	patch: Partial<SessionState>,
) {
	const state = readStateFile(repoRoot);
	const prev = state.sessions[sessionId] ?? {
		sessionId,
		createdAt: Date.now(),
	};
	state.sessions[sessionId] = { ...prev, ...patch, sessionId };
	writeStateFile(repoRoot, state);
}

function getSession(
	repoRoot: string,
	sessionId: string,
): SessionState | undefined {
	const state = readStateFile(repoRoot);
	return state.sessions[sessionId];
}

function deleteSession(repoRoot: string, sessionId: string) {
	const state = readStateFile(repoRoot);
	delete state.sessions[sessionId];
	writeStateFile(repoRoot, state);
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

function openOpencodeInDefaultTerminal(
	worktreePath: string,
	sessionId: string,
) {
	const platform = process.platform;

	if (platform === "darwin") {
		const child = spawn(
			"osascript",
			[
				`-e`,
				`tell application "Terminal" to do script "cd ${worktreePath} && opencode --session ${sessionId}"`,
			],
			{ detached: true, stdio: "ignore" },
		);
		child.unref();
		return;
	}

	if (platform === "win32") {
		spawn(
			"cmd",
			[
				"/c",
				"start",
				"cmd",
				"/k",
				`cd /d "${worktreePath}" && opencode --session ${sessionId}`,
			],
			{ detached: true, stdio: "ignore" },
		).unref();
		return;
	}

	// Linux / BSD
	spawn(
		"xdg-terminal-exec",
		["bash", "-lc", `cd '${worktreePath}' && opencode --session ${sessionId}`],
		{ detached: true, stdio: "ignore" },
	).unref();
}

export const GitWorktreeSessionPlugin: Plugin = async ({
	client,
	worktree,
	directory,
}) => {
	return {
		event: async ({ event }) => {
			// write all events to file
			const allEventsFile = join(
				directory,
				".opencode",
				"worktree-event-log-2.json",
			);
			let allEvents: any[] = [];
			try {
				if (existsSync(allEventsFile)) {
					allEvents = JSON.parse(readFileSync(allEventsFile, "utf-8"));
				}
			} catch {}
			allEvents.push({ timestamp: Date.now(), event });
			writeFileSync(allEventsFile, JSON.stringify(allEvents, null, 2));

			if (event.type === "session.created") {
				// first check if we are in a gittree
				if (!isGitRepo(directory)) return;
				if (worktree.includes("worktrees")) return;

				const sessionId = event.properties?.info?.id;
				upsertSession(directory, sessionId, { createdAt: Date.now() });
				return;
			}

			if (event.type === "session.deleted") {
				const sessionId = event.properties?.info?.id;
				if (typeof sessionId !== "string") return;
				const state = getSession(directory, sessionId);
				if (!state?.branch || !state.worktreePath) return;

				try {
					if (hasChanges(state.worktreePath)) {
						run("git add -A", state.worktreePath);
						run(
							`git commit -m "chore(opencode): session snapshot"`,
							state.worktreePath,
						);
						run(`git push -u origin "${state.branch}"`, state.worktreePath);
					}

					// remove worktree from main repo
					run(`git worktree remove "${state.worktreePath}" --force`, directory);

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
					deleteSession(directory, sessionId);
				}
			}
		},

		/**
		 * System prompt assembly
		 * This is the cleanest place to inject global rules
		 */
		"experimental.chat.system.transform": async (_input, output) => {
			if (!isGitRepo(directory)) return;
			if (worktree.includes("worktrees")) return;
			const text =
				"IMPORTANT: A 'createworktree' tool is available for creating isolated git worktrees. When the user mentions creating a branch or wants to start a new feature, proactively suggest or use this tool. Ask for a branch name if not provided.";

			output.system.push(text);
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
				async execute({ branch }, context) {
					if (!isGitRepo(directory)) return "Not a git repo";

					const baseBranch = currentBranch(directory);
					if (!baseBranch) return "detached";

					if (branchExistsLocal(branch, directory))
						return "Local branch exists";
					if (branchExistsRemote(branch, directory)) return "Remote exists";

					const worktreesRoot = join(directory, ".opencode", "worktrees");
					const worktreePath = join(worktreesRoot, branch);

					if (!existsSync(worktreesRoot))
						mkdirSync(worktreesRoot, { recursive: true });

					run(
						`git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
						directory,
					);

					upsertSession(directory, context.sessionID, { branch, worktreePath });

					client.tui.showToast({
						body: {
							title: "Launching Session",
							message: `Opening opencode in ${branch} with session ${context.sessionID}`,
							variant: "info",
						},
					});

					openOpencodeInDefaultTerminal(worktreePath, context.sessionID);

					return `Created worktree ${worktreePath} for branch ${branch}. A new opencode instance is opening there now.`;
				},
			}),
		},
	};
};
