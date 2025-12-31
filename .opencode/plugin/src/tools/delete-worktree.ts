import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { isGitRepo } from '../git/git.ts';
import { cleanupWorktree } from '../git/worktree.ts';
import { deleteSession, getSession } from '../state/state.ts';

export const deleteWorktreeTool = (directory: string, worktree: string, client: PluginClient) =>
  tool({
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
  });
