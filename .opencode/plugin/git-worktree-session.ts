import { type Plugin, tool } from "@opencode-ai/plugin";
import { isGitRepo } from "./git";
import { deleteSession, getSession, upsertSession } from "./state";
import { openOpencodeInDefaultTerminal } from "./terminal";
import { cleanupWorktree, createWorktreeSession } from "./worktree";

export const GitWorktreeSessionPlugin: Plugin = async ({
	client,
	worktree,
	directory,
}) => {
	// Ensure directory is a string
	const repoRoot: string = String(directory);

	return {
		event: async ({ event }) => {
			if (event.type === "session.created") {
				if (!isGitRepo(repoRoot)) return;
				if (worktree.includes("worktrees")) return;

				const sessionId = event.properties?.info?.id;
				upsertSession(repoRoot, sessionId, { createdAt: Date.now() });
				return;
			}

			if (event.type === "session.deleted") {
				const sessionId = event.properties?.info?.id;
				if (typeof sessionId !== "string") return;
				const state = getSession(repoRoot, sessionId);
				if (!state?.branch || !state.worktreePath) return;

				const result = cleanupWorktree(
					repoRoot,
					state.worktreePath,
					state.branch,
				);

				if (result.success) {
					client.tui.showToast({
						body: {
							title: "Session Saved",
							message: `Committed & cleaned ${state.branch}`,
							variant: "success",
						},
					});
				} else {
					client.tui.showToast({
						body: {
							title: "Cleanup Failed",
							message: result.error || "Unknown error",
							variant: "error",
						},
					});
				}

				deleteSession(repoRoot, sessionId);
			}
		},

		"experimental.chat.system.transform": async (_input, output) => {
			if (!isGitRepo(repoRoot)) return;

			if (worktree.includes("worktrees")) {
				const text =
					"IMPORTANT: After completing a task, inform the user that they can delete this worktree session using the 'deleteworktree' tool. The tool will commit any changes, push to remote, and clean up the worktree. Example: 'Task complete! You can now delete this worktree session with the deleteworktree tool if you're done.'";
				output.system.push(text);
			} else {
				const text =
					"IMPORTANT: A 'createworktree' tool is available for creating isolated git worktrees. When the user mentions creating a branch or wants to start a new feature, proactively suggest or use this tool. Ask for a branch name if not provided.";
				output.system.push(text);
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
				async execute({ branch }, context) {
					const result = createWorktreeSession(repoRoot, branch);

					if (!result.success || !result.worktreePath) {
						return result.error || "Failed to create worktree";
					}

					upsertSession(repoRoot, context.sessionID, {
						branch,
						worktreePath: result.worktreePath,
					});

					client.tui.showToast({
						body: {
							title: "Launching Session",
							message: `Opening opencode in ${branch} with session ${context.sessionID}`,
							variant: "info",
						},
					});

					openOpencodeInDefaultTerminal(result.worktreePath, context.sessionID);

					return `Created worktree ${result.worktreePath} for branch ${branch}. A new opencode instance is opening there now.`;
				},
			}),

			deleteworktree: tool({
				description:
					"Deletes the current worktree session. Commits any changes, pushes to remote, and removes the worktree.",
				args: {},
				async execute(_args, context) {
					if (!isGitRepo(repoRoot)) return "Not a git repo";
					if (!worktree.includes("worktrees"))
						return "Not in a worktree session";

					const sessionId = context.sessionID;
					const state = getSession(repoRoot, sessionId);

					if (!state?.branch || !state.worktreePath) {
						return "No worktree session found for this session ID";
					}

					const result = cleanupWorktree(
						repoRoot,
						state.worktreePath,
						state.branch,
					);

					if (result.success) {
						deleteSession(repoRoot, sessionId);
						client.tui.showToast({
							body: {
								title: "Worktree Deleted",
								message: `Committed & cleaned ${state.branch}`,
								variant: "success",
							},
						});
						return `Worktree ${state.branch} has been cleaned up. Changes committed and pushed to remote. You can now close this session.`;
					}

					client.tui.showToast({
						body: {
							title: "Deletion Failed",
							message: result.error || "Unknown error",
							variant: "error",
						},
					});
					return `Failed to delete worktree: ${result.error}`;
				},
			}),
		},
	};
};
