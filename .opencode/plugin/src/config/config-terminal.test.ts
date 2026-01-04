import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadConfig, writeConfig } from './config.ts';
import type { SupportedTerminal } from './types.ts';

describe('config terminal behavior', () => {
  let tmp: string;
  let repo: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'opencode-config-terminal-test-'));
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

  it('writes and reads default terminal config', () => {
    const cfg = { terminal: { mode: 'default' as const } };

    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.terminal?.mode).toBe('default');
  });

  it('writes and reads custom terminal config', () => {
    const cfg = { terminal: { mode: 'custom' as const, bin: 'kitty', args: '--single-instance' } };

    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.terminal?.mode).toBe('custom');
    if (loaded.terminal?.mode === 'custom') {
      expect(loaded.terminal.bin).toBe('kitty');
      expect(loaded.terminal.args).toBe('--single-instance');
    }
  });

  it('writes and reads specific terminal config', () => {
    const cfg = {
      terminal: { mode: 'specific' as const, terminal: 'Alacritty' as SupportedTerminal },
    };

    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.terminal?.mode).toBe('specific');
    if (loaded.terminal?.mode === 'specific') {
      expect(loaded.terminal.terminal).toBe('Alacritty');
    }
  });

  it('defaults to undefined when terminal config not set', () => {
    const cfg = { postWorktree: { cmd: 'nvim' } };
    writeConfig(repo, cfg);

    const loaded = loadConfig(repo);
    expect(loaded.terminal).toBeUndefined();
  });

  it('updates terminal config without losing other config', () => {
    const initial = {
      postWorktree: { cmd: 'code' },
      terminal: { mode: 'default' as const },
    };
    writeConfig(repo, initial);

    const updated = {
      ...loadConfig(repo),
      terminal: { mode: 'custom' as const, bin: 'wezterm' },
    };
    writeConfig(repo, updated);

    const final = loadConfig(repo);
    expect(final.postWorktree?.cmd).toBe('code');
    expect(final.terminal?.mode).toBe('custom');
    if (final.terminal?.mode === 'custom') {
      expect(final.terminal.bin).toBe('wezterm');
    }
  });
});
