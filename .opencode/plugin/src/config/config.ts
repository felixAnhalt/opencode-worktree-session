import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PluginConfig } from './types.ts';
import { getMainRepoFromWorktree } from '../git/git.ts';
import { OPENCODE_CONFIG_DIR, OPENCODE_CONFIG_NAME } from './constants.ts';

const resolveRepoRoot = (directory: string): string => {
  const mainRepo = getMainRepoFromWorktree(directory);
  return mainRepo || directory;
};

const getConfigFilePath = (repoRoot: string): string =>
  join(repoRoot, OPENCODE_CONFIG_DIR, OPENCODE_CONFIG_NAME);

export const loadConfig = (directory: string): PluginConfig => {
  try {
    const repoRoot = resolveRepoRoot(directory);
    const configFile = getConfigFilePath(repoRoot);
    if (existsSync(configFile)) {
      const content = readFileSync(configFile, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    /* Failed to load config - return empty */
  }
  return {};
};

export const writeConfig = (directory: string, config: PluginConfig) => {
  const repoRoot = resolveRepoRoot(directory);
  const dir = join(repoRoot, OPENCODE_CONFIG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const configFile = getConfigFilePath(repoRoot);
  writeFileSync(configFile, JSON.stringify(config, null, 2));
};

export const updateConfig = (directory: string, patch: Partial<PluginConfig>) => {
  const current = loadConfig(directory);
  const updated = { ...current, ...patch };
  writeConfig(directory, updated);
};
