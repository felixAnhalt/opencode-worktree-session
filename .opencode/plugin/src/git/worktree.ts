import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CleanupResult } from '../state/types.ts';
import type { SyncBehavior } from '../config/types.ts';
import { loadConfig } from '../config/config.ts';
import { OPENCODE_CONFIG_DIR } from '../config/constants.ts';
import { WORKTREES_DIR } from './constants.ts';
import {
  branchExistsLocal,
  branchExistsRemote,
  checkoutExistingBranch,
  commitAndPush,
  createWorktree as gitCreateWorktree,
  currentBranch,
  hasChanges,
  isGitRepo,
  removeWorktree,
  pruneWorktrees,
  fetchBranch,
  getAheadBehind,
  mergeFastForward,
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

  const localExists = branchExistsLocal(branch, directory);
  // check remote as well; we'll prefer local when it's newer
  const remoteExists = branchExistsRemote(branch, directory);

  const worktreesRoot = join(directory, OPENCODE_CONFIG_DIR, WORKTREES_DIR);
  const worktreePath = join(worktreesRoot, branch);

  try {
    if (!existsSync(worktreesRoot)) {
      mkdirSync(worktreesRoot, { recursive: true });
    }

    // If local branch exists, create a worktree for it and try to sync with remote when appropriate
    if (localExists) {
      // Create the worktree pointing to the local branch
      checkoutExistingBranch(worktreePath, branch, directory, false);

      // Determine sync behavior from config (default: 'prefer-local')
      const config = loadConfig(directory);
      const syncBehavior: SyncBehavior = config.worktreeSync?.behavior ?? 'prefer-local';

      try {
        if (syncBehavior === 'always') {
          // Always fetch and fast-forward (fail if diverged)
          fetchBranch(branch, directory);
          mergeFastForward(branch, worktreePath);
        } else if (syncBehavior === 'prefer-local') {
          // Check ahead/behind to decide whether to fetch/fast-forward
          const { originAhead, localAhead } = getAheadBehind(branch, directory);
          if (originAhead > 0 && localAhead === 0) {
            // origin has commits that local doesn't -> fetch and fast-forward
            fetchBranch(branch, directory);
            mergeFastForward(branch, worktreePath);
          } else {
            // Local is ahead or equal — prefer local; do not fetch
          }
        } else if (syncBehavior === 'never') {
          // Never fetch - use local as-is
        }
      } catch {
        // ignore fetch/merge errors - user can reconcile manually
      }

      return { success: true, worktreePath };
    }

    // If local doesn't exist but remote does, fetch and create worktree from remote
    if (!localExists && remoteExists) {
      // fetch remote branch and add worktree
      fetchBranch(branch, directory);
      checkoutExistingBranch(worktreePath, branch, directory, true);
      return { success: true, worktreePath };
    }

    // Otherwise, create a new branch worktree from base branch
    gitCreateWorktree(worktreePath, branch, baseBranch, directory);

    return { success: true, worktreePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
};
