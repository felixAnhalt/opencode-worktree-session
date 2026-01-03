export type PostWorktreeConfig = {
  cmd: string;
  args?: string;
};

export type PluginConfig = {
  postWorktree?: PostWorktreeConfig;
};
