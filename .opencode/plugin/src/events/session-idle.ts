import type { PluginClient } from '../types.ts';
import { getSession, upsertSession } from '../state/state.ts';
import { openOpencodeInDefaultTerminal } from '../terminal/terminal.ts';

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
};
