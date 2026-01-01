import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CleanupResult } from '../state/types.ts';
import {
  branchExistsLocal,
  branchExistsRemote,
  commitAndPush,
  createWorktree as gitCreateWorktree,
  currentBranch,
  hasChanges,
  isGitRepo,
  removeWorktree,
  pruneWorktrees,
} from './git.ts';

export const cleanupWorktree = (
  directory: string,
  worktreePath: string,
  branch: string
): CleanupResult => {
  try {
    // Prune stale worktree references before cleanup
    pruneWorktrees(directory);

    if (hasChanges(worktreePath)) {
      commitAndPush(worktreePath, branch);
    }

    removeWorktree(worktreePath, directory);

    // Prune again after removal to clean up references
    pruneWorktrees(directory);

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
};

export const createWorktreeSession = (
  directory: string,
  branch: string
): { success: boolean; worktreePath?: string; error?: string } => {
  if (!isGitRepo(directory)) {
    return { success: false, error: 'Not a git repo' };
  }

  const baseBranch = currentBranch(directory);
  if (!baseBranch) {
    return { success: false, error: 'Detached HEAD state' };
  }

  if (branchExistsLocal(branch, directory)) {
    return { success: false, error: 'Local branch exists' };
  }

  if (branchExistsRemote(branch, directory)) {
    return { success: false, error: 'Remote branch exists' };
  }

  const worktreesRoot = join(directory, '.opencode', 'worktrees');
  const worktreePath = join(worktreesRoot, branch);

  try {
    if (!existsSync(worktreesRoot)) {
      mkdirSync(worktreesRoot, { recursive: true });
    }

    gitCreateWorktree(worktreePath, branch, baseBranch, directory);

    return { success: true, worktreePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
};
