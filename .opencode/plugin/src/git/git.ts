import { execSync } from 'node:child_process';

const run = (cmd: string, cwd?: string): string =>
  execSync(cmd, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString()
    .trim();

export const isGitRepo = (cwd: string): boolean => {
  try {
    run('git rev-parse --is-inside-work-tree', cwd);
    return true;
  } catch {
    return false;
  }
};

export const currentBranch = (cwd: string): string => run('git branch --show-current', cwd);

export const hasChanges = (cwd: string): boolean => run('git status --porcelain', cwd).length > 0;

export const branchExistsLocal = (branch: string, cwd: string): boolean => {
  try {
    run(`git show-ref --verify --quiet refs/heads/${branch}`, cwd);
    return true;
  } catch {
    return false;
  }
};

export const branchExistsRemote = (branch: string, cwd: string): boolean => {
  try {
    run(`git ls-remote --exit-code --heads origin ${branch}`, cwd);
    return true;
  } catch {
    return false;
  }
};

export const commitAndPush = (worktreePath: string, branch: string) => {
  run('git add -A', worktreePath);
  run(`git commit -m "chore(opencode): session snapshot"`, worktreePath);
  run(`git push -u origin "${branch}"`, worktreePath);
};

export const removeWorktree = (worktreePath: string, directory: string) => {
  run(`git worktree remove "${worktreePath}" --force`, directory);
};

export const pruneWorktrees = (directory: string) => {
  run('git worktree prune', directory);
};

export const createWorktree = (
  worktreePath: string,
  branch: string,
  baseBranch: string,
  directory: string
) => {
  run(`git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`, directory);
};

export const checkoutExistingBranch = (
  worktreePath: string,
  branch: string,
  directory: string,
  isRemote: boolean
) => {
  if (isRemote) {
    run(`git fetch origin "${branch}"`, directory);
    run(`git worktree add "${worktreePath}" "${branch}"`, directory);
  } else {
    run(`git worktree add "${worktreePath}" "${branch}"`, directory);
  }
};

export const fetchBranch = (branch: string, directory: string) => {
  run(`git fetch origin "${branch}"`, directory);
};

export const getAheadBehind = (
  branch: string,
  directory: string
): { originAhead: number; localAhead: number } => {
  try {
    const out = run(`git rev-list --left-right --count origin/${branch}...${branch}`, directory);
    const parts = out.split(/\s+/).filter(Boolean);
    const originAhead = Number(parts[0] ?? 0);
    const localAhead = Number(parts[1] ?? 0);
    return { originAhead, localAhead };
  } catch {
    return { originAhead: 0, localAhead: 0 };
  }
};

export const mergeFastForward = (branch: string, worktreePath: string) => {
  run(`git merge --ff-only origin/${branch}`, worktreePath);
};

export const getMainRepoFromWorktree = (directory: string): string | null => {
  // Check if directory path contains '/.opencode/worktrees/'
  if (directory.includes('/.opencode/worktrees/')) {
    // Extract main repo by going up to before .opencode
    const parts = directory.split('/.opencode/worktrees/');
    return parts[0];
  }
  return null;
};
