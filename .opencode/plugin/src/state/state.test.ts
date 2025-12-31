import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionState, StateFile } from './types.ts';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const { upsertSession, getSession, deleteSession } = await import('./state.ts');

describe('state service', () => {
  const mockRepoRoot = '/test/repo';
  const stateFilePath = join(mockRepoRoot, '.opencode', 'worktree-session-state.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('upsertSession', () => {
    it('should create new session when state file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const sessionId = 'session-123';
      const patch = { branch: 'feature/test', worktreePath: '/test/worktree' };

      upsertSession(mockRepoRoot, sessionId, patch);

      expect(mkdirSync).toHaveBeenCalledWith(join(mockRepoRoot, '.opencode'), {
        recursive: true,
      });
      expect(writeFileSync).toHaveBeenCalledWith(stateFilePath, expect.stringContaining(sessionId));

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions[sessionId]).toEqual(
        expect.objectContaining({
          sessionId,
          branch: 'feature/test',
          worktreePath: '/test/worktree',
          createdAt: expect.any(Number),
        })
      );
    });

    it('should create new session when state file exists', () => {
      const existingState: StateFile = {
        sessions: {
          'existing-session': {
            sessionId: 'existing-session',
            branch: 'main',
            createdAt: 1000,
          },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existingState));

      const sessionId = 'new-session';
      const patch = { branch: 'feature/new' };

      upsertSession(mockRepoRoot, sessionId, patch);

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).toHaveProperty('existing-session');
      expect(writtenData.sessions).toHaveProperty(sessionId);
      expect(writtenData.sessions[sessionId].branch).toBe('feature/new');
    });

    it('should update existing session preserving createdAt', () => {
      const createdAt = 1000;
      const existingState: StateFile = {
        sessions: {
          'session-123': {
            sessionId: 'session-123',
            branch: 'old-branch',
            createdAt,
          },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existingState));

      upsertSession(mockRepoRoot, 'session-123', { branch: 'new-branch' });

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions['session-123']).toEqual({
        sessionId: 'session-123',
        branch: 'new-branch',
        createdAt,
      });
    });

    it('should merge partial updates with existing session data', () => {
      const existingState: StateFile = {
        sessions: {
          'session-123': {
            sessionId: 'session-123',
            branch: 'main',
            worktreePath: '/old/path',
            createdAt: 1000,
          },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(existingState));

      upsertSession(mockRepoRoot, 'session-123', { branch: 'new-branch' });

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions['session-123']).toEqual({
        sessionId: 'session-123',
        branch: 'new-branch',
        worktreePath: '/old/path',
        createdAt: 1000,
      });
    });

    it('should create .opencode directory if it does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(mockRepoRoot, 'session-123', { branch: 'test' });

      expect(mkdirSync).toHaveBeenCalledWith(join(mockRepoRoot, '.opencode'), {
        recursive: true,
      });
    });

    it('should write formatted JSON with 2 space indentation', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(mockRepoRoot, 'session-123', { branch: 'test' });

      const writtenJson = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
      expect(writtenJson).toContain('\n  ');
    });

    it('should handle corrupted state file gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json{');

      expect(() => {
        upsertSession(mockRepoRoot, 'session-123', { branch: 'test' });
      }).not.toThrow();

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions['session-123']).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return session when it exists', () => {
      const session: SessionState = {
        sessionId: 'session-123',
        branch: 'feature/test',
        worktreePath: '/test/worktree',
        createdAt: 1000,
      };

      const state: StateFile = {
        sessions: { 'session-123': session },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      const result = getSession(mockRepoRoot, 'session-123');

      expect(result).toEqual(session);
    });

    it('should return undefined when session does not exist', () => {
      const state: StateFile = {
        sessions: {
          'other-session': { sessionId: 'other-session', createdAt: 1000 },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      const result = getSession(mockRepoRoot, 'nonexistent');

      expect(result).toBeUndefined();
    });

    it('should return undefined when state file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getSession(mockRepoRoot, 'session-123');

      expect(result).toBeUndefined();
    });

    it('should handle corrupted state file gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      const result = getSession(mockRepoRoot, 'session-123');

      expect(result).toBeUndefined();
    });

    it('should read from correct file path', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ sessions: {} }));

      getSession(mockRepoRoot, 'session-123');

      expect(readFileSync).toHaveBeenCalledWith(stateFilePath, 'utf-8');
    });

    it('should find session by worktreePath when session ID does not match', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feat/test-1';
      const session: SessionState = {
        sessionId: 'original-session-id',
        branch: 'feat/test-1',
        worktreePath,
        createdAt: 1000,
      };

      const state: StateFile = {
        sessions: { 'original-session-id': session },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      // Looking for different session ID, but same worktreePath
      const result = getSession(worktreePath, 'different-session-id');

      expect(result).toEqual(session);
    });

    it('should prefer session ID match over worktreePath match', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feat/test-1';
      const sessionById: SessionState = {
        sessionId: 'correct-id',
        branch: 'feat/test-1',
        worktreePath: '/some/other/path',
        createdAt: 1000,
      };
      const sessionByPath: SessionState = {
        sessionId: 'other-id',
        branch: 'feat/test-1',
        worktreePath,
        createdAt: 2000,
      };

      const state: StateFile = {
        sessions: {
          'correct-id': sessionById,
          'other-id': sessionByPath,
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      const result = getSession(worktreePath, 'correct-id');

      expect(result).toEqual(sessionById);
    });
  });

  describe('deleteSession', () => {
    it('should delete session from state file', () => {
      const state: StateFile = {
        sessions: {
          'session-1': { sessionId: 'session-1', createdAt: 1000 },
          'session-2': { sessionId: 'session-2', createdAt: 2000 },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      deleteSession(mockRepoRoot, 'session-1');

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).not.toHaveProperty('session-1');
      expect(writtenData.sessions).toHaveProperty('session-2');
    });

    it('should handle deleting nonexistent session gracefully', () => {
      const state: StateFile = {
        sessions: { 'session-1': { sessionId: 'session-1', createdAt: 1000 } },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      expect(() => {
        deleteSession(mockRepoRoot, 'nonexistent');
      }).not.toThrow();

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).toHaveProperty('session-1');
    });

    it('should create empty sessions object when state file does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      deleteSession(mockRepoRoot, 'session-123');

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).toEqual({});
    });

    it('should handle corrupted state file gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid json');

      expect(() => {
        deleteSession(mockRepoRoot, 'session-123');
      }).not.toThrow();
    });

    it('should delete session by worktreePath when session ID does not match', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feat/test-1';
      const state: StateFile = {
        sessions: {
          'original-session-id': {
            sessionId: 'original-session-id',
            branch: 'feat/test-1',
            worktreePath,
            createdAt: 1000,
          },
          'other-session': {
            sessionId: 'other-session',
            branch: 'feat/test-2',
            worktreePath: '/other/path',
            createdAt: 2000,
          },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      // Delete with different session ID but matching worktreePath
      deleteSession(worktreePath, 'different-session-id');

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).not.toHaveProperty('original-session-id');
      expect(writtenData.sessions).toHaveProperty('other-session');
    });

    it('should prefer session ID match over worktreePath match when deleting', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feat/test-1';
      const state: StateFile = {
        sessions: {
          'correct-id': {
            sessionId: 'correct-id',
            branch: 'feat/test-1',
            worktreePath: '/some/other/path',
            createdAt: 1000,
          },
          'other-id': {
            sessionId: 'other-id',
            branch: 'feat/test-1',
            worktreePath,
            createdAt: 2000,
          },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      deleteSession(worktreePath, 'correct-id');

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).not.toHaveProperty('correct-id');
      expect(writtenData.sessions).toHaveProperty('other-id');
    });
  });

  describe('state file path resolution', () => {
    it('should use correct path for state file', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(mockRepoRoot, 'session-123', {});

      expect(writeFileSync).toHaveBeenCalledWith(
        join(mockRepoRoot, '.opencode', 'worktree-session-state.json'),
        expect.any(String)
      );
    });

    it('should handle different repo roots', () => {
      const customRoot = '/custom/repo/path';
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(customRoot, 'session-123', {});

      expect(writeFileSync).toHaveBeenCalledWith(
        join(customRoot, '.opencode', 'worktree-session-state.json'),
        expect.any(String)
      );
    });

    it('should resolve main repo from worktree path', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feature-branch';
      const mainRepoRoot = '/test/repo';
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(worktreePath, 'session-123', { branch: 'feature-branch' });

      expect(writeFileSync).toHaveBeenCalledWith(
        join(mainRepoRoot, '.opencode', 'worktree-session-state.json'),
        expect.any(String)
      );
    });

    it('should resolve main repo from nested worktree path', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feat/nested/branch';
      const mainRepoRoot = '/test/repo';
      vi.mocked(existsSync).mockReturnValue(false);

      upsertSession(worktreePath, 'session-123', { branch: 'feat/nested/branch' });

      expect(writeFileSync).toHaveBeenCalledWith(
        join(mainRepoRoot, '.opencode', 'worktree-session-state.json'),
        expect.any(String)
      );
    });

    it('should getSession from main repo when called from worktree', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feature-branch';
      const mainRepoRoot = '/test/repo';
      const session: SessionState = {
        sessionId: 'session-123',
        branch: 'feature-branch',
        worktreePath,
        createdAt: 1000,
      };

      const state: StateFile = {
        sessions: { 'session-123': session },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      const result = getSession(worktreePath, 'session-123');

      expect(readFileSync).toHaveBeenCalledWith(
        join(mainRepoRoot, '.opencode', 'worktree-session-state.json'),
        'utf-8'
      );
      expect(result).toEqual(session);
    });

    it('should getSession from main repo when called from worktree with doubly nested feature branch', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feature/branch';
      const mainRepoRoot = '/test/repo';
      const session: SessionState = {
        sessionId: 'session-123',
        branch: 'feature/branch',
        worktreePath,
        createdAt: 1000,
      };

      const state: StateFile = {
        sessions: { 'session-123': session },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      const result = getSession(worktreePath, 'session-123');

      expect(readFileSync).toHaveBeenCalledWith(
        join(mainRepoRoot, '.opencode', 'worktree-session-state.json'),
        'utf-8'
      );
      expect(result).toEqual(session);
    });

    it('should deleteSession from main repo when called from worktree', () => {
      const worktreePath = '/test/repo/.opencode/worktrees/feature-branch';
      const mainRepoRoot = '/test/repo';
      const state: StateFile = {
        sessions: {
          'session-123': { sessionId: 'session-123', createdAt: 1000 },
        },
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(state));

      deleteSession(worktreePath, 'session-123');

      expect(writeFileSync).toHaveBeenCalledWith(
        join(mainRepoRoot, '.opencode', 'worktree-session-state.json'),
        expect.any(String)
      );

      const writtenData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string);
      expect(writtenData.sessions).not.toHaveProperty('session-123');
    });
  });
});
