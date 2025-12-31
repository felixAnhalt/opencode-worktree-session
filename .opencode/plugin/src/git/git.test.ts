import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const {
  isGitRepo,
  currentBranch,
  hasChanges,
  branchExistsLocal,
  branchExistsRemote,
  commitAndPush,
  removeWorktree,
  createWorktree,
} = await import('./git.ts');

describe('git service', () => {
  const mockCwd = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGitRepo', () => {
    it('should return true when inside git work tree', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('true'));

      const result = isGitRepo(mockCwd);

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --is-inside-work-tree',
        expect.objectContaining({
          cwd: mockCwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });

    it('should return false when not inside git work tree', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('not a git repo');
      });

      const result = isGitRepo(mockCwd);

      expect(result).toBe(false);
    });

    it('should handle execSync errors gracefully', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('fatal: not a git repository');
      });

      expect(() => isGitRepo(mockCwd)).not.toThrow();
      expect(isGitRepo(mockCwd)).toBe(false);
    });
  });

  describe('currentBranch', () => {
    it('should return current branch name', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('main\n'));

      const result = currentBranch(mockCwd);

      expect(result).toBe('main');
      expect(execSync).toHaveBeenCalledWith(
        'git branch --show-current',
        expect.objectContaining({ cwd: mockCwd })
      );
    });

    it('should trim whitespace from branch name', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('  feature/test  \n'));

      const result = currentBranch(mockCwd);

      expect(result).toBe('feature/test');
    });

    it('should return empty string for detached HEAD', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));

      const result = currentBranch(mockCwd);

      expect(result).toBe('');
    });
  });

  describe('hasChanges', () => {
    it('should return true when there are changes', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(' M file.txt\n?? newfile.txt'));

      const result = hasChanges(mockCwd);

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git status --porcelain',
        expect.objectContaining({ cwd: mockCwd })
      );
    });

    it('should return false when there are no changes', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));

      const result = hasChanges(mockCwd);

      expect(result).toBe(false);
    });

    it('should return true for staged changes', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('M  staged.txt'));

      const result = hasChanges(mockCwd);

      expect(result).toBe(true);
    });

    it('should return true for untracked files', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('?? untracked.txt'));

      const result = hasChanges(mockCwd);

      expect(result).toBe(true);
    });
  });

  describe('branchExistsLocal', () => {
    it('should return true when local branch exists', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));

      const result = branchExistsLocal('feature/test', mockCwd);

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git show-ref --verify --quiet refs/heads/feature/test',
        expect.objectContaining({ cwd: mockCwd })
      );
    });

    it('should return false when local branch does not exist', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('ref does not exist');
      });

      const result = branchExistsLocal('nonexistent', mockCwd);

      expect(result).toBe(false);
    });

    it('should handle branch names with slashes', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from(''));

      branchExistsLocal('feature/foo/bar', mockCwd);

      expect(execSync).toHaveBeenCalledWith(
        'git show-ref --verify --quiet refs/heads/feature/foo/bar',
        expect.any(Object)
      );
    });
  });

  describe('branchExistsRemote', () => {
    it('should return true when remote branch exists', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('abc123 refs/heads/feature/test'));

      const result = branchExistsRemote('feature/test', mockCwd);

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git ls-remote --exit-code --heads origin feature/test',
        expect.objectContaining({ cwd: mockCwd })
      );
    });

    it('should return false when remote branch does not exist', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('exit code 2');
      });

      const result = branchExistsRemote('nonexistent', mockCwd);

      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Could not resolve host');
      });

      expect(() => branchExistsRemote('test', mockCwd)).not.toThrow();
      expect(branchExistsRemote('test', mockCwd)).toBe(false);
    });
  });

  describe('commitAndPush', () => {
    it('should stage all changes, commit and push', () => {
      const worktreePath = '/test/worktree';
      const branch = 'feature/test';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      commitAndPush(worktreePath, branch);

      expect(execSync).toHaveBeenCalledTimes(3);
      expect(execSync).toHaveBeenNthCalledWith(
        1,
        'git add -A',
        expect.objectContaining({ cwd: worktreePath })
      );
      expect(execSync).toHaveBeenNthCalledWith(
        2,
        'git commit -m "chore(opencode): session snapshot"',
        expect.objectContaining({ cwd: worktreePath })
      );
      expect(execSync).toHaveBeenNthCalledWith(
        3,
        `git push -u origin "${branch}"`,
        expect.objectContaining({ cwd: worktreePath })
      );
    });

    it('should use correct commit message', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      commitAndPush('/test/worktree', 'branch');

      const commitCall = vi.mocked(execSync).mock.calls.find((call) => call[0].includes('commit'));
      expect(commitCall?.[0]).toContain('chore(opencode): session snapshot');
    });

    it('should set upstream when pushing', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      commitAndPush('/test/worktree', 'feature/test');

      const pushCall = vi.mocked(execSync).mock.calls.find((call) => call[0].includes('push'));
      expect(pushCall?.[0]).toContain('-u origin');
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree with force flag', () => {
      const worktreePath = '/test/worktree';
      const directory = '/test/repo';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      removeWorktree(worktreePath, directory);

      expect(execSync).toHaveBeenCalledWith(
        `git worktree remove "${worktreePath}" --force`,
        expect.objectContaining({ cwd: directory })
      );
    });

    it('should handle paths with spaces', () => {
      const worktreePath = '/test/path with spaces/worktree';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      removeWorktree(worktreePath, mockCwd);

      expect(execSync).toHaveBeenCalledWith(
        `git worktree remove "${worktreePath}" --force`,
        expect.any(Object)
      );
    });
  });

  describe('createWorktree', () => {
    it('should create worktree with new branch from base branch', () => {
      const worktreePath = '/test/worktree';
      const branch = 'feature/new';
      const baseBranch = 'main';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      createWorktree(worktreePath, branch, baseBranch, mockCwd);

      expect(execSync).toHaveBeenCalledWith(
        `git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
        expect.objectContaining({ cwd: mockCwd })
      );
    });

    it('should handle branch names with special characters', () => {
      const worktreePath = '/test/worktree';
      const branch = 'feature/test-123';
      const baseBranch = 'develop';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      createWorktree(worktreePath, branch, baseBranch, mockCwd);

      expect(execSync).toHaveBeenCalledWith(
        `git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`,
        expect.any(Object)
      );
    });

    it('should use correct working directory', () => {
      const customCwd = '/custom/repo';

      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      createWorktree('/test/worktree', 'branch', 'main', customCwd);

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: customCwd })
      );
    });
  });

  describe('error handling', () => {
    it('should propagate errors from git commands', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('git command failed');
      });

      expect(() => currentBranch(mockCwd)).toThrow('git command failed');
    });

    it('should handle git command with non-zero exit code', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        const err = new Error('Command failed') as Error & { status: number };
        err.status = 128;
        throw err;
      });

      expect(() => createWorktree('/test', 'branch', 'main', mockCwd)).toThrow();
    });
  });

  describe('stdio configuration', () => {
    it('should use pipe for stdout and stderr', () => {
      vi.mocked(execSync).mockReturnValueOnce(Buffer.from('main'));

      currentBranch(mockCwd);

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
    });
  });
});
