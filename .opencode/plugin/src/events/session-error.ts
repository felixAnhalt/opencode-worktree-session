import type { PluginClient } from '../types.ts';
import { getSession, upsertSession } from '../state/state.ts';

import type { Event } from '@opencode-ai/sdk';

export const handleSessionError = (
  event: Event,
  directory: string,
  _worktree: string,
  client: PluginClient
) => {
  if (event.type !== 'session.error') return;
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
};
