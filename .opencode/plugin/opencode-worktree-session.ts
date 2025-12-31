import { type Plugin, tool } from '@opencode-ai/plugin';
import { isGitRepo } from './src/git/git.ts';
import { deleteSession, getSession, upsertSession } from './src/state/state.ts';
import { openOpencodeInDefaultTerminal } from './src/terminal/terminal.ts';
import { cleanupWorktree, createWorktreeSession } from './src/git/worktree.ts';

export const GitWorktreeSessionPlugin: Plugin = async ({ client, worktree, directory }) => {
  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        if (!isGitRepo(directory)) return;
        if (worktree.includes('worktrees')) return;

        const sessionId = event.properties?.info?.id;
        upsertSession(directory, sessionId, { createdAt: Date.now() });
        return;
      }

      if (event.type === 'session.idle') {
        const sessionId = event.properties?.sessionID;
        if (typeof sessionId !== 'string') return;

        const state = getSession(directory, sessionId);
        if (!state?.pendingWorktreeSpawn) return;

        const { worktreePath, branch, sessionID } = state.pendingWorktreeSpawn;

        // Clear the pending flag first
        upsertSession(directory, sessionId, { pendingWorktreeSpawn: undefined });

        // Spawn the terminal with the session ID
        openOpencodeInDefaultTerminal(worktreePath, sessionID);

        client.tui.showToast({
          body: {
            title: 'Opening Worktree',
            message: `Launching terminal in ${branch}`,
            variant: 'info',
          },
        });

        // Create a fresh session in the master terminal
        try {
          await client.tui.executeCommand({
            body: { command: 'session_new' },
          });

          client.tui.showToast({
            body: {
              title: 'Master Session Ready',
              message: 'New session created, ready for next task',
              variant: 'success',
            },
          });
        } catch {
          // If executeCommand fails, fall back to informing the user
          client.tui.showToast({
            body: {
              title: 'Manual Action Required',
              message: 'Press Ctrl+X N to create a new session',
              variant: 'info',
            },
          });
        }
        return;
      }

      if (event.type === 'session.error') {
        const sessionId = event.properties?.sessionID;
        if (typeof sessionId !== 'string') return;

        const state = getSession(directory, sessionId);
        if (!state?.pendingWorktreeSpawn) return;

        // Cancel the pending spawn on error/interruption
        upsertSession(directory, sessionId, { pendingWorktreeSpawn: undefined });

        client.tui.showToast({
          body: {
            title: 'Worktree Spawn Cancelled',
            message: 'Response was interrupted',
            variant: 'info',
          },
        });
        return;
      }

      if (event.type === 'session.deleted') {
        const sessionId = event.properties?.info?.id;
        if (typeof sessionId !== 'string') return;
        const state = getSession(directory, sessionId);
        if (!state?.branch || !state.worktreePath) return;

        const result = cleanupWorktree(directory, state.worktreePath, state.branch);

        if (result.success) {
          client.tui.showToast({
            body: {
              title: 'Session Saved',
              message: `Committed & cleaned ${state.branch}`,
              variant: 'success',
            },
          });
        } else {
          client.tui.showToast({
            body: {
              title: 'Cleanup Failed',
              message: result.error || 'Unknown error',
              variant: 'error',
            },
          });
        }
        deleteSession(directory, sessionId);
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (!isGitRepo(directory)) return;

      if (worktree.includes('worktrees')) {
        const text =
          "WORKTREE SESSION RULES (STRICT):\n1) When finished, tell the user they can run the 'deleteworktree' tool.\n2) If 'deleteworktree' is executed: STOP. Do not run ANY shell commands (no git/pwd/ls/cat), do not list/read files, and do not call any other tools afterward. The worktree directory may no longer exist and process.cwd() can be invalid.\n3) If verification is needed, ASK the user to run verification commands from the repository root (outside the deleted worktree) and paste the output.";
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
          'Creates a git worktree for this session and automatically launches a new opencode instance in it. Starts new terminal session after tool execution and finished llm invocation.',
        args: {
          branch: tool.schema.string().describe('The branch name for the worktree'),
        },
        async execute({ branch }, context) {
          const result = createWorktreeSession(directory, branch);

          if (!result.success || !result.worktreePath) {
            return result.error || 'Failed to create worktree';
          }

          upsertSession(directory, context.sessionID, {
            branch,
            worktreePath: result.worktreePath,
            pendingWorktreeSpawn: {
              worktreePath: result.worktreePath,
              branch,
              sessionID: context.sessionID,
            },
          });

          client.tui.showToast({
            body: {
              title: 'Worktree Created',
              message: `Branch ${branch} at ${result.worktreePath}`,
              variant: 'success',
            },
          });

          return `Created worktree at ${result.worktreePath} for branch ${branch}. Terminal will open when this response completes...`;
        },
      }),
      deleteworktree: tool({
        description:
          'Deletes the current worktree session. Commits any changes, pushes to remote, and removes the worktree.',
        args: {},
        async execute(_args, context) {
          if (!isGitRepo(directory)) return 'Not a git repo';
          if (!worktree.includes('worktrees')) return 'Not in a worktree session';

          const sessionId = context.sessionID;
          const state = getSession(directory, sessionId);

          if (!state?.branch || !state.worktreePath) {
            return 'No worktree session found for this session ID';
          }

          const result = cleanupWorktree(directory, state.worktreePath, state.branch);

          if (result.success) {
            deleteSession(directory, sessionId);
            client.tui.showToast({
              body: {
                title: 'Worktree Deleted',
                message: `Committed & cleaned ${state.branch}`,
                variant: 'success',
              },
            });
            return `Worktree ${state.branch} cleaned up (committed + pushed + removed). STOP: do not run any further shell commands or access files; the deleted worktree path may be invalid.`;
          }

          client.tui.showToast({
            body: {
              title: 'Deletion Failed',
              message: result.error || 'Unknown error',
              variant: 'error',
            },
          });
          return `Failed to delete worktree: ${result.error}`;
        },
      }),
    },
  };
};
