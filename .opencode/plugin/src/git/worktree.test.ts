import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('./git.ts', () => ({
  isGitRepo: vi.fn(),
  currentBranch: vi.fn(),
  hasChanges: vi.fn(),
  branchExistsLocal: vi.fn(),
  branchExistsRemote: vi.fn(),
  commitAndPush: vi.fn(),
  removeWorktree: vi.fn(),
  createWorktree: vi.fn(),
}));

const gitMock = await import('./git.ts');
const { cleanupWorktree, createWorktreeSession } = await import('./worktree.ts');

describe('worktree service', () => {
  const mockDirectory = '/test/repo';
  const mockWorktreePath = '/test/repo/.opencode/worktrees/feature/test';
  const mockBranch = 'feature/test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupWorktree', () => {
    it('should commit and push when there are changes', () => {
      vi.mocked(gitMock.hasChanges).mockReturnValue(true);

      const result = cleanupWorktree(mockDirectory, mockWorktreePath, mockBranch);

      expect(gitMock.hasChanges).toHaveBeenCalledWith(mockWorktreePath);
      expect(gitMock.commitAndPush).toHaveBeenCalledWith(mockWorktreePath, mockBranch);
      expect(gitMock.removeWorktree).toHaveBeenCalledWith(mockWorktreePath, mockDirectory);
      expect(result).toEqual({ success: true });
    });

    it('should skip commit when there are no changes', () => {
      vi.mocked(gitMock.hasChanges).mockReturnValue(false);

      const result = cleanupWorktree(mockDirectory, mockWorktreePath, mockBranch);

      expect(gitMock.hasChanges).toHaveBeenCalledWith(mockWorktreePath);
      expect(gitMock.commitAndPush).not.toHaveBeenCalled();
      expect(gitMock.removeWorktree).toHaveBeenCalledWith(mockWorktreePath, mockDirectory);
      expect(result).toEqual({ success: true });
    });

    it('should return error when commit fails', () => {
      vi.mocked(gitMock.hasChanges).mockReturnValue(true);
      vi.mocked(gitMock.commitAndPush).mockImplementation(() => {
        throw new Error('commit failed');
      });

      const result = cleanupWorktree(mockDirectory, mockWorktreePath, mockBranch);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('commit failed'),
      });
    });

    it('should return error when worktree removal fails', () => {
      vi.mocked(gitMock.hasChanges).mockReturnValue(false);
      vi.mocked(gitMock.removeWorktree).mockImplementation(() => {
        throw new Error('removal failed');
      });

      const result = cleanupWorktree(mockDirectory, mockWorktreePath, mockBranch);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('removal failed'),
      });
    });

    it('should handle git errors gracefully', () => {
      vi.mocked(gitMock.hasChanges).mockImplementation(() => {
        throw new Error('git error');
      });

      const result = cleanupWorktree(mockDirectory, mockWorktreePath, mockBranch);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('createWorktreeSession', () => {
    beforeEach(() => {
      vi.mocked(gitMock.isGitRepo).mockReturnValue(true);
      vi.mocked(gitMock.currentBranch).mockReturnValue('main');
      vi.mocked(gitMock.branchExistsLocal).mockReturnValue(false);
      vi.mocked(gitMock.branchExistsRemote).mockReturnValue(false);
      vi.mocked(existsSync).mockReturnValue(true);
    });

    it('should create worktree successfully', () => {
      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(gitMock.isGitRepo).toHaveBeenCalledWith(mockDirectory);
      expect(gitMock.currentBranch).toHaveBeenCalledWith(mockDirectory);
      expect(gitMock.branchExistsLocal).toHaveBeenCalledWith(mockBranch, mockDirectory);
      expect(gitMock.branchExistsRemote).toHaveBeenCalledWith(mockBranch, mockDirectory);
      expect(gitMock.createWorktree).toHaveBeenCalledWith(
        join(mockDirectory, '.opencode', 'worktrees', mockBranch),
        mockBranch,
        'main',
        mockDirectory
      );
      expect(result).toEqual({
        success: true,
        worktreePath: join(mockDirectory, '.opencode', 'worktrees', mockBranch),
      });
    });

    it('should return error when not a git repo', () => {
      vi.mocked(gitMock.isGitRepo).mockReturnValue(false);

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: 'Not a git repo',
      });
      expect(gitMock.createWorktree).not.toHaveBeenCalled();
    });

    it('should return error when in detached HEAD state', () => {
      vi.mocked(gitMock.currentBranch).mockReturnValue('');

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: 'Detached HEAD state',
      });
      expect(gitMock.createWorktree).not.toHaveBeenCalled();
    });

    it('should return error when local branch exists', () => {
      vi.mocked(gitMock.branchExistsLocal).mockReturnValue(true);

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: 'Local branch exists',
      });
      expect(gitMock.createWorktree).not.toHaveBeenCalled();
    });

    it('should return error when remote branch exists', () => {
      vi.mocked(gitMock.branchExistsRemote).mockReturnValue(true);

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: 'Remote branch exists',
      });
      expect(gitMock.createWorktree).not.toHaveBeenCalled();
    });

    it('should create worktrees directory if it does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      createWorktreeSession(mockDirectory, mockBranch);

      expect(mkdirSync).toHaveBeenCalledWith(join(mockDirectory, '.opencode', 'worktrees'), {
        recursive: true,
      });
    });

    it('should not create worktrees directory if it exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      createWorktreeSession(mockDirectory, mockBranch);

      expect(mkdirSync).not.toHaveBeenCalled();
    });

    it('should use base branch from current branch', () => {
      vi.mocked(gitMock.currentBranch).mockReturnValue('develop');

      createWorktreeSession(mockDirectory, mockBranch);

      expect(gitMock.createWorktree).toHaveBeenCalledWith(
        expect.any(String),
        mockBranch,
        'develop',
        mockDirectory
      );
    });

    it('should handle git worktree creation errors', () => {
      vi.mocked(gitMock.createWorktree).mockImplementation(() => {
        throw new Error('worktree creation failed');
      });

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('worktree creation failed'),
      });
    });

    it('should construct correct worktree path', () => {
      const branch = 'feature/foo/bar';

      vi.mocked(gitMock.createWorktree).mockReturnValue(undefined);

      const result = createWorktreeSession(mockDirectory, branch);

      expect(result.worktreePath).toBe(join(mockDirectory, '.opencode', 'worktrees', branch));
    });

    it('should handle directory creation errors', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('mkdir failed');
      });

      const result = createWorktreeSession(mockDirectory, mockBranch);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('mkdir failed'),
      });
    });
  });

  describe('validation order', () => {
    it('should check git repo first', () => {
      vi.mocked(gitMock.isGitRepo).mockReturnValue(false);

      createWorktreeSession(mockDirectory, mockBranch);

      expect(gitMock.isGitRepo).toHaveBeenCalled();
      expect(gitMock.currentBranch).not.toHaveBeenCalled();
    });

    it('should check HEAD state before branch conflicts', () => {
      vi.mocked(gitMock.isGitRepo).mockReturnValue(true);
      vi.mocked(gitMock.currentBranch).mockReturnValue('');

      createWorktreeSession(mockDirectory, mockBranch);

      expect(gitMock.currentBranch).toHaveBeenCalled();
      expect(gitMock.branchExistsLocal).not.toHaveBeenCalled();
    });

    it('should check local branch before remote branch', () => {
      vi.mocked(gitMock.isGitRepo).mockReturnValue(true);
      vi.mocked(gitMock.currentBranch).mockReturnValue('main');
      vi.mocked(gitMock.branchExistsLocal).mockReturnValue(true);

      createWorktreeSession(mockDirectory, mockBranch);

      expect(gitMock.branchExistsLocal).toHaveBeenCalled();
      expect(gitMock.branchExistsRemote).not.toHaveBeenCalled();
    });
  });
});
