import type { ChildProcess, SpawnSyncReturns } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NonSharedBuffer } from 'buffer';

// Mock node:child_process before importing terminal module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

const { openOpencodeInDefaultTerminal } = await import('./terminal.ts');

describe('terminal service', () => {
  const mockWorktreePath = '/test/worktree/path';
  const mockSessionId = 'test-session-123';
  const mockChildProcess = {
    unref: vi.fn(),
  } as unknown as ChildProcess;

  const mockSpawnSync = (status: number): Partial<SpawnSyncReturns<Buffer>> => ({
    status,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spawn).mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('macOS terminal detection and launching', () => {
    beforeEach(() => {
      vi.stubEnv('TERM_PROGRAM', '');
    });

    it('should detect Alacritty when installed and launch it', () => {
      vi.stubEnv('platform', 'darwin');
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      // Mock Alacritty as installed
      vi.mocked(spawnSync).mockReturnValueOnce(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      // Verify Alacritty detection
      expect(spawnSync).toHaveBeenCalledWith(
        'open',
        ['-Ra', 'Alacritty'],
        expect.objectContaining({ stdio: 'ignore' })
      );

      // Verify Alacritty launch with correct command
      expect(spawn).toHaveBeenCalledWith(
        '/Applications/Alacritty.app/Contents/MacOS/alacritty',
        ['--working-directory', mockWorktreePath, '-e', 'opencode', '--session', mockSessionId],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });

    it('should try iTerm when Alacritty is not installed', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      // Mock Alacritty not installed, iTerm installed
      vi.mocked(spawnSync)
        .mockReturnValueOnce(mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>) // Alacritty not found
        .mockReturnValueOnce(mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>); // iTerm found

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      // Verify it checked for both terminals
      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'Alacritty'], expect.any(Object));
      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'iTerm'], expect.any(Object));

      // Verify iTerm launch with osascript
      expect(spawn).toHaveBeenCalledWith(
        'osascript',
        expect.arrayContaining([
          '-e',
          expect.stringContaining('tell application "iTerm"'),
          mockWorktreePath,
          mockSessionId,
        ]),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );
    });

    it('should try iTerm2 when iTerm is not found', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      // Mock Alacritty and iTerm not installed, iTerm2 installed
      vi.mocked(spawnSync)
        .mockReturnValueOnce(mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>) // Alacritty
        .mockReturnValueOnce(mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>) // iTerm
        .mockReturnValueOnce(mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>); // iTerm2

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'iTerm2'], expect.any(Object));
    });

    it('should fallback to Apple Terminal when no preferred terminals found', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      // Mock all preferred terminals not installed
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      // Should fallback to Apple Terminal
      expect(spawn).toHaveBeenCalledWith(
        'osascript',
        expect.arrayContaining([
          '-e',
          expect.stringContaining('tell application "Terminal"'),
          mockWorktreePath,
          mockSessionId,
        ]),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );
    });

    it('should use detached process with stdio ignore', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('Windows terminal launching', () => {
    it('should launch cmd on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawn).toHaveBeenCalledWith(
        'cmd',
        [
          '/c',
          'start',
          'cmd',
          '/k',
          `cd /d "${mockWorktreePath}" && opencode --session ${mockSessionId}`,
        ],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('Linux terminal launching', () => {
    it('should use xdg-terminal-exec on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawn).toHaveBeenCalledWith(
        'xdg-terminal-exec',
        ['bash', '-lc', `cd "${mockWorktreePath}" && opencode --session "${mockSessionId}"`],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('AppleScript generation', () => {
    it('should properly quote paths with spaces in Terminal script', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      const pathWithSpaces = '/path/with spaces/worktree';
      openOpencodeInDefaultTerminal(pathWithSpaces, mockSessionId);

      const scriptArg = vi.mocked(spawn).mock.calls[0]?.[1]?.[1];
      expect(scriptArg).toContain('quoted form');
    });

    it('should properly quote session ID in Terminal script', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      const sessionWithSpaces = 'session with spaces';
      openOpencodeInDefaultTerminal(mockWorktreePath, sessionWithSpaces);

      const scriptArg = vi.mocked(spawn).mock.calls[0]?.[1]?.[1];
      expect(scriptArg).toContain('quoted form');
    });
  });
});
