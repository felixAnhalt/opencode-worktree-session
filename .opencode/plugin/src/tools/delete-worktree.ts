import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { getMainRepoFromWorktree, isGitRepo } from '../git/git.ts';
import { getSession, upsertSession } from '../state/state.ts';

export const deleteWorktreeTool = (directory: string, worktree: string, client: PluginClient) =>
  tool({
    description:
      'Deletes the current worktree session. Commits any changes, pushes to remote, and removes the worktree.',
    args: {},
    async execute(_args, context) {
      if (!isGitRepo(directory)) {
        return `Error: Not a git repo\nDirectory: ${directory}`;
      }

      if (!worktree.includes('worktrees')) {
        return `Error: Not in a worktree session\nCurrent directory: ${directory}\nWorktree value: ${worktree}`;
      }

      const sessionId = context.sessionID;
      const mainRepo = getMainRepoFromWorktree(directory);

      // Get session state
      const state = getSession(directory, sessionId);

      // Debug information
      const debugInfo = {
        sessionId,
        currentDirectory: directory,
        worktreeValue: worktree,
        resolvedMainRepo: mainRepo || 'Not in worktree path',
        stateFound: !!state,
        state: state || null,
      };

      if (!state?.branch || !state.worktreePath) {
        return [
          'Error: No worktree session found',
          '',
          'Debug Information:',
          JSON.stringify(debugInfo, null, 2),
          '',
          'Possible causes:',
          '- Session was not properly created',
          '- State file is missing or corrupted',
          '- Session ID mismatch',
        ].join('\n');
      }

      // Set pending deletion flag instead of deleting immediately
      upsertSession(directory, sessionId, {
        pendingWorktreeDeletion: {
          worktreePath: state.worktreePath,
          branch: state.branch,
          sessionID: sessionId,
        },
      });

      client.tui.showToast({
        body: {
          title: 'Worktree Deletion Scheduled',
          message: `Will clean up ${state.branch} after response completes`,
          variant: 'info',
        },
      });

      return `Worktree deletion scheduled for ${state.branch}. Cleanup will happen after this response completes. STOP: do not run any further shell commands or access files after this response.`;
    },
  });
