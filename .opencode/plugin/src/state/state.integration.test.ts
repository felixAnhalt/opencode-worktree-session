import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteSession, getSession, upsertSession } from './state.ts';

describe('state integration tests', () => {
  const testRepoRoot = '/tmp/test-repo-integration';
  const worktreePath = join(testRepoRoot, '.opencode', 'worktrees', 'feat', 'test-107');
  const stateFilePath = join(testRepoRoot, '.opencode', 'worktree-session-state.json');

  beforeEach(() => {
    // Clean up any existing test directory
    if (existsSync(testRepoRoot)) {
      rmSync(testRepoRoot, { recursive: true, force: true });
    }

    // Create test directory structure
    mkdirSync(worktreePath, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testRepoRoot)) {
      rmSync(testRepoRoot, { recursive: true, force: true });
    }
  });

  describe('upsertSession from worktree', () => {
    it('should create state file in main repo when called from worktree', () => {
      const sessionId = 'test-session-123';

      upsertSession(worktreePath, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      expect(existsSync(stateFilePath)).toBe(true);
      expect(existsSync(join(worktreePath, '.opencode', 'worktree-session-state.json'))).toBe(
        false
      );
    });

    it('should write session data correctly', () => {
      const sessionId = 'test-session-123';

      upsertSession(worktreePath, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      const session = getSession(worktreePath, sessionId);
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.branch).toBe('feat/test-107');
      expect(session?.worktreePath).toBe(worktreePath);
    });

    it('should handle nested branch names', () => {
      const deepWorktreePath = join(
        testRepoRoot,
        '.opencode',
        'worktrees',
        'feat',
        'nested',
        'deep',
        'branch'
      );
      mkdirSync(deepWorktreePath, { recursive: true });

      const sessionId = 'deep-session';
      upsertSession(deepWorktreePath, sessionId, {
        branch: 'feat/nested/deep/branch',
      });

      expect(existsSync(stateFilePath)).toBe(true);

      const session = getSession(deepWorktreePath, sessionId);
      expect(session?.branch).toBe('feat/nested/deep/branch');
    });
  });

  describe('getSession from worktree', () => {
    it('should read session from main repo when called from worktree', () => {
      const sessionId = 'test-session-456';

      // Write session from main repo
      upsertSession(testRepoRoot, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      // Read session from worktree
      const session = getSession(worktreePath, sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.branch).toBe('feat/test-107');
    });

    it('should return same session whether called from main repo or worktree', () => {
      const sessionId = 'consistent-session';

      upsertSession(testRepoRoot, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      const sessionFromMain = getSession(testRepoRoot, sessionId);
      const sessionFromWorktree = getSession(worktreePath, sessionId);

      expect(sessionFromMain).toEqual(sessionFromWorktree);
    });
  });

  describe('deleteSession from worktree', () => {
    it('should delete session from main repo when called from worktree', () => {
      const sessionId = 'delete-me';

      upsertSession(testRepoRoot, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      // Verify session exists
      expect(getSession(worktreePath, sessionId)).toBeDefined();

      // Delete from worktree
      deleteSession(worktreePath, sessionId);

      // Verify session is deleted
      expect(getSession(worktreePath, sessionId)).toBeUndefined();
      expect(getSession(testRepoRoot, sessionId)).toBeUndefined();
    });

    it('should not delete other sessions', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';

      upsertSession(testRepoRoot, sessionId1, { branch: 'feat/test-107' });
      upsertSession(testRepoRoot, sessionId2, { branch: 'feat/test-108' });

      deleteSession(worktreePath, sessionId1);

      expect(getSession(worktreePath, sessionId1)).toBeUndefined();
      expect(getSession(worktreePath, sessionId2)).toBeDefined();
    });
  });

  describe('real world scenario', () => {
    it('should handle complete worktree lifecycle', () => {
      const sessionId = 'lifecycle-session';

      // 1. Create session from main repo (simulating createworktree tool)
      upsertSession(testRepoRoot, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      // 2. New OpenCode instance opens in worktree, reads session
      const session = getSession(worktreePath, sessionId);
      expect(session).toBeDefined();
      expect(session?.worktreePath).toBe(worktreePath);

      // 3. Update session from worktree (simulating ongoing work)
      upsertSession(worktreePath, sessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      // 4. Delete session from worktree (simulating deleteworktree tool)
      deleteSession(worktreePath, sessionId);

      // 5. Verify cleanup
      expect(getSession(worktreePath, sessionId)).toBeUndefined();
    });

    it('should handle session ID mismatch (new OpenCode instance scenario)', () => {
      const originalSessionId = 'original-session-123';
      const newSessionId = 'new-session-456';

      // 1. Create session from main repo with original session ID
      upsertSession(testRepoRoot, originalSessionId, {
        branch: 'feat/test-107',
        worktreePath,
      });

      // 2. New OpenCode instance opens with DIFFERENT session ID
      // but same worktree path - should still find the session
      const session = getSession(worktreePath, newSessionId);
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(originalSessionId);
      expect(session?.worktreePath).toBe(worktreePath);

      // 3. Delete with the NEW session ID (current instance's ID)
      // should still delete the session by worktreePath match
      deleteSession(worktreePath, newSessionId);

      // 4. Verify it's deleted
      expect(getSession(worktreePath, originalSessionId)).toBeUndefined();
      expect(getSession(worktreePath, newSessionId)).toBeUndefined();
    });
  });

  describe('path resolution edge cases', () => {
    it('should handle main repo path correctly', () => {
      const sessionId = 'main-repo-session';

      upsertSession(testRepoRoot, sessionId, { branch: 'main' });

      expect(existsSync(stateFilePath)).toBe(true);
      expect(getSession(testRepoRoot, sessionId)).toBeDefined();
    });

    it('should handle worktree path with single level branch', () => {
      const singleLevelWorktree = join(testRepoRoot, '.opencode', 'worktrees', 'simple-branch');
      mkdirSync(singleLevelWorktree, { recursive: true });

      const sessionId = 'single-level';
      upsertSession(singleLevelWorktree, sessionId, { branch: 'simple-branch' });

      expect(existsSync(stateFilePath)).toBe(true);
      expect(getSession(singleLevelWorktree, sessionId)).toBeDefined();
    });

    it('should not interfere with non-worktree paths', () => {
      const randomPath = join('/tmp', 'some-random-path');
      mkdirSync(randomPath, { recursive: true });

      const sessionId = 'random-session';

      // This should create state in the random path, not resolve anything
      upsertSession(randomPath, sessionId, { branch: 'random' });

      expect(existsSync(join(randomPath, '.opencode', 'worktree-session-state.json'))).toBe(true);

      // Clean up
      rmSync(randomPath, { recursive: true, force: true });
    });
  });
});
