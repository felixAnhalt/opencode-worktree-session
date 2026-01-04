import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadConfig, writeConfig, updateConfig } from './config.ts';
import { OPENCODE_CONFIG_DIR, OPENCODE_CONFIG_NAME } from './constants.ts';

describe('config integration (real fs)', () => {
  let tmp: string;
  let repo: string;
  let opencodeDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'opencode-config-test-'));
    repo = join(tmp, 'repo');
    mkdirSync(repo);
    opencodeDir = join(repo, OPENCODE_CONFIG_DIR);
  });

  afterEach(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  });

  it('writes and reads config file on disk', () => {
    const cfg = { postWorktree: { cmd: 'nvim', args: '' } };

    writeConfig(repo, cfg);

    const cfgPath = join(opencodeDir, OPENCODE_CONFIG_NAME);
    expect(existsSync(cfgPath)).toBe(true);

    const raw = readFileSync(cfgPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual(cfg);

    const loaded = loadConfig(repo);
    expect(loaded).toEqual(cfg);
  });

  it('updateConfig merges with existing config and resolves from worktree path', () => {
    const initial = { postWorktree: { cmd: 'code', args: '--reuse-window' }, other: 1 };
    writeConfig(repo, initial);

    const worktreePath = join(repo, OPENCODE_CONFIG_DIR, 'worktrees', 'feat', 'branch');

    const loadedBefore = loadConfig(worktreePath);
    expect(loadedBefore).toEqual(initial);

    updateConfig(worktreePath, { postWorktree: { cmd: 'webstorm' } });

    const updated = loadConfig(repo);
    expect(updated.postWorktree?.cmd).toBe('webstorm');
    expect((updated as unknown as { other: number }).other).toBe(1);
  });
});
