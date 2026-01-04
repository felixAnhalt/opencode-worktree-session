import type { PluginClient } from '../types.ts';
import { deleteSession, getSession, upsertSession } from '../state/state.ts';
import { openOpencodeInDefaultTerminal } from '../terminal/terminal.ts';
import { cleanupWorktree } from '../git/worktree.ts';
import { getMainRepoFromWorktree } from '../git/git.ts';

import type { Event } from '@opencode-ai/sdk';

export const handleSessionIdle = async (
  event: Event,
  directory: string,
  _worktree: string,
  client: PluginClient
) => {
  if (event.type !== 'session.idle') return;
  const sessionId = event.properties?.sessionID;
  if (typeof sessionId !== 'string') return;

  const state = getSession(directory, sessionId);
  if (!state) return;

  // Handle pending worktree deletion
  if (state.pendingWorktreeDeletion) {
    const { worktreePath, branch } = state.pendingWorktreeDeletion;

    // Clear the pending flag first
    upsertSession(directory, sessionId, { pendingWorktreeDeletion: undefined });

    // Get the main repo root - critical for cleanup to work from correct directory
    const mainRepo = getMainRepoFromWorktree(directory) || directory;

    try {
      // Perform the actual cleanup from the main repo
      const result = cleanupWorktree(mainRepo, worktreePath, branch);

      if (result.success) {
        deleteSession(directory, sessionId);
        client.tui.showToast({
          body: {
            title: 'Worktree Deleted',
            message: `Committed & cleaned ${branch}`,
            variant: 'success',
          },
        });
      } else {
        client.tui.showToast({
          body: {
            title: 'Deletion Failed',
            message: result.error || 'Unknown error',
            variant: 'error',
          },
        });
      }
    } catch (err) {
      // Catch any synchronous errors that weren't caught by cleanupWorktree
      client.tui.showToast({
        body: {
          title: 'Deletion Error',
          message: String(err),
          variant: 'error',
        },
      });
    }
    return;
  }

  // Handle pending worktree spawn
  if (state.pendingWorktreeSpawn) {
    const { worktreePath, branch, sessionID } = state.pendingWorktreeSpawn;

    // Clear the pending flag first
    upsertSession(directory, sessionId, { pendingWorktreeSpawn: undefined });

    // Spawn the terminal with the session ID
    openOpencodeInDefaultTerminal(worktreePath, sessionID, directory);

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
  }
};
