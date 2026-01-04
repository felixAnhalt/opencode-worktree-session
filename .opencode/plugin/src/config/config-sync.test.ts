import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadConfig, writeConfig } from './config.ts';
import type { SyncBehavior } from './types.ts';

describe('config worktree sync behavior', () => {
  let tmp: string;
  let repo: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'opencode-config-sync-test-'));
    repo = join(tmp, 'repo');
    mkdirSync(repo);
  });

  afterEach(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  });

  it('writes and reads sync behavior config', () => {
    const cfg = { worktreeSync: { behavior: 'always' as SyncBehavior } };

    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.worktreeSync?.behavior).toBe('always');
  });

  it('defaults to undefined when sync config not set', () => {
    const cfg = { postWorktree: { cmd: 'nvim' } };
    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.worktreeSync).toBeUndefined();
  });

  it('updates sync behavior without losing other config', () => {
    const initial = {
      postWorktree: { cmd: 'code' },
      worktreeSync: { behavior: 'never' as SyncBehavior },
    };
    writeConfig(repo, initial);

    const updated = {
      ...loadConfig(repo),
      worktreeSync: { behavior: 'prefer-local' as SyncBehavior },
    };
    writeConfig(repo, updated);

    const final = loadConfig(repo);
    expect(final.postWorktree?.cmd).toBe('code');
    expect(final.worktreeSync?.behavior).toBe('prefer-local');
  });
});
