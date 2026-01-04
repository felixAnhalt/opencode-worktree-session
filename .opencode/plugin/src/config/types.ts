export type PostWorktreeConfig = {
  cmd: string;
  args?: string;
};

export type SyncBehavior = 'always' | 'never' | 'prefer-local';

export type WorktreeSyncConfig = {
  behavior: SyncBehavior;
};

export type SupportedTerminal = 'Alacritty' | 'iTerm' | 'iTerm2' | 'Terminal';

export type TerminalConfig =
  | { mode: 'default' }
  | {
      mode: 'custom';
      bin: string;
      workingDirectoryArgument: string;
      commandFlag: string;
      args?: string;
    }
  | { mode: 'specific'; terminal: SupportedTerminal };

export type PluginConfig = {
  postWorktree?: PostWorktreeConfig;
  worktreeSync?: WorktreeSyncConfig;
  terminal?: TerminalConfig;
  configToolsAvailable?: boolean;
};
