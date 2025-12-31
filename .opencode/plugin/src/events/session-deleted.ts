import type { PluginClient } from '../types.ts';
import { cleanupWorktree } from '../git/worktree.ts';
import { deleteSession, getSession } from '../state/state.ts';

import type { Event } from '@opencode-ai/sdk';

export const handleSessionDeleted = (
  event: Event,
  directory: string,
  _worktree: string,
  client: PluginClient
) => {
  if (event.type !== 'session.deleted') return;
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
};
