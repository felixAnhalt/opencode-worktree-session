export type PostWorktreeConfig = {
  cmd: string;
  args?: string;
};

export type SyncBehavior = 'always' | 'never' | 'prefer-local';

export type WorktreeSyncConfig = {
  behavior: SyncBehavior;
};

export type PluginConfig = {
  postWorktree?: PostWorktreeConfig;
  worktreeSync?: WorktreeSyncConfig;
};
