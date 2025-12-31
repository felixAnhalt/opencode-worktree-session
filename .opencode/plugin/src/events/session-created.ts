import { isGitRepo } from '../git/git.ts';
import { upsertSession } from '../state/state.ts';

import type { Event } from '@opencode-ai/sdk';

export const handleSessionCreated = (event: Event, directory: string, worktree: string) => {
  if (event.type !== 'session.created') return;

  if (!isGitRepo(directory)) return;
  if (worktree.includes('worktrees')) return;

  const sessionId = event.properties?.info?.id;
  upsertSession(directory, sessionId, { createdAt: Date.now() });
};
