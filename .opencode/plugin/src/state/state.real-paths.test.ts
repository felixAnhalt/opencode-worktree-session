import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deleteSession, getSession, upsertSession } from './state.ts';
import { getMainRepoFromWorktree } from '../git/git.ts';

describe('real paths integration test', () => {
  const mainRepoRoot = '/Users/fanhalt/WebstormProjects/personal/opencode-worktree-session';
  const worktreePath = join(mainRepoRoot, '.opencode', 'worktrees', 'feat', 'test-107');
  const expectedStateFilePath = join(mainRepoRoot, '.opencode', 'worktree-session-state.json');

  it('should resolve main repo from actual worktree path', () => {
    const resolved = getMainRepoFromWorktree(worktreePath);
    expect(resolved).toBe(mainRepoRoot);
  });

  it('should create state file in correct location', () => {
    const sessionId = 'real-path-test';

    // Clean up if exists
    if (existsSync(expectedStateFilePath)) {
      const state = getSession(mainRepoRoot, sessionId);
      if (state) {
        deleteSession(mainRepoRoot, sessionId);
      }
    }

    // Create session from worktree path
    upsertSession(worktreePath, sessionId, {
      branch: 'feat/test-107',
      worktreePath,
    });

    // Verify state file is in correct location
    expect(existsSync(expectedStateFilePath)).toBe(true);
    expect(existsSync(join(worktreePath, '.opencode', 'worktree-session-state.json'))).toBe(false);

    // Verify we can read it back
    const session = getSession(worktreePath, sessionId);
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe(sessionId);
    expect(session?.branch).toBe('feat/test-107');

    // Clean up
    deleteSession(worktreePath, sessionId);
  });

  it('should handle reads and deletes from worktree path', () => {
    const sessionId = 'real-path-test-2';

    // Create from main repo
    upsertSession(mainRepoRoot, sessionId, {
      branch: 'feat/test-107',
      worktreePath,
    });

    // Read from worktree
    const sessionFromWorktree = getSession(worktreePath, sessionId);
    expect(sessionFromWorktree).toBeDefined();
    expect(sessionFromWorktree?.branch).toBe('feat/test-107');

    // Delete from worktree
    deleteSession(worktreePath, sessionId);

    // Verify it's gone
    expect(getSession(worktreePath, sessionId)).toBeUndefined();
    expect(getSession(mainRepoRoot, sessionId)).toBeUndefined();
  });
});
