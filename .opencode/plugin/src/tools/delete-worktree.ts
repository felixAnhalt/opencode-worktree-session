import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { getMainRepoFromWorktree, isGitRepo } from '../git/git.ts';
import { cleanupWorktree } from '../git/worktree.ts';
import { deleteSession, getSession } from '../state/state.ts';

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

      return [
        `Error: Failed to delete worktree`,
        `Reason: ${result.error}`,
        '',
        'Debug Information:',
        JSON.stringify(debugInfo, null, 2),
      ].join('\n');
    },
  });
