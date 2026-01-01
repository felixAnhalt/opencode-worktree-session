import type { ChildProcess, SpawnSyncReturns } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NonSharedBuffer } from 'buffer';

// Mock node:child_process and node:fs before importing terminal module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
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

  describe('environment variable terminal selection', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    });

    it('should use OPENCODE_TERMINAL when set and valid', () => {
      vi.stubEnv('OPENCODE_TERMINAL', 'Alacritty');
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'Alacritty'], expect.any(Object));
      expect(spawn).toHaveBeenCalledWith(
        '/Applications/Alacritty.app/Contents/MacOS/alacritty',
        ['--working-directory', mockWorktreePath, '-e', 'opencode', '--session', mockSessionId],
        expect.any(Object)
      );
    });

    it('should use TERMINAL when OPENCODE_TERMINAL is not set', () => {
      vi.stubEnv('TERMINAL', 'iTerm');
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'iTerm'], expect.any(Object));
    });

    it('should prioritize OPENCODE_TERMINAL over TERMINAL', () => {
      vi.stubEnv('OPENCODE_TERMINAL', 'Alacritty');
      vi.stubEnv('TERMINAL', 'iTerm');
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'Alacritty'], expect.any(Object));
      expect(spawnSync).not.toHaveBeenCalledWith('open', ['-Ra', 'iTerm'], expect.any(Object));
    });

    it('should use full path when OPENCODE_TERMINAL is an absolute path', () => {
      const customPath = '/usr/local/bin/alacritty';
      vi.stubEnv('OPENCODE_TERMINAL', customPath);
      vi.mocked(existsSync).mockReturnValue(true);

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(existsSync).toHaveBeenCalledWith(customPath);
      expect(spawn).toHaveBeenCalledWith(
        customPath,
        ['--working-directory', mockWorktreePath, '-e', 'opencode', '--session', mockSessionId],
        expect.any(Object)
      );
    });

    it('should fallback to auto-detection when env terminal is not found', () => {
      vi.stubEnv('OPENCODE_TERMINAL', 'NonExistentTerminal');
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock NonExistentTerminal not found, then Alacritty found
      vi.mocked(spawnSync)
        .mockReturnValueOnce(mockSpawnSync(1) as SpawnSyncReturns<string | NonSharedBuffer>) // NonExistentTerminal
        .mockReturnValueOnce(mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>); // Alacritty

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Terminal 'NonExistentTerminal'")
      );
      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'Alacritty'], expect.any(Object));

      consoleLogSpy.mockRestore();
    });

    it('should fallback to auto-detection when env path does not exist', () => {
      const customPath = '/nonexistent/path/terminal';
      vi.stubEnv('OPENCODE_TERMINAL', customPath);
      vi.mocked(existsSync).mockReturnValue(false);
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock auto-detection finding Alacritty
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Warning: Terminal '${customPath}'`)
      );
      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'Alacritty'], expect.any(Object));

      consoleLogSpy.mockRestore();
    });

    it('should handle case-insensitive terminal names', () => {
      vi.stubEnv('OPENCODE_TERMINAL', 'ALACRITTY');
      vi.mocked(spawnSync).mockReturnValue(
        mockSpawnSync(0) as SpawnSyncReturns<string | NonSharedBuffer>
      );

      openOpencodeInDefaultTerminal(mockWorktreePath, mockSessionId);

      expect(spawnSync).toHaveBeenCalledWith('open', ['-Ra', 'ALACRITTY'], expect.any(Object));
    });
  });

  describe('macOS terminal detection and launching', () => {
    beforeEach(() => {
      vi.stubEnv('platform', 'darwin');
      vi.stubEnv('OPENCODE_TERMINAL', '');
      vi.stubEnv('TERMINAL', '');
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
    beforeEach(() => {
      vi.stubEnv('OPENCODE_TERMINAL', '');
      vi.stubEnv('TERMINAL', '');
    });

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
    beforeEach(() => {
      vi.stubEnv('OPENCODE_TERMINAL', '');
      vi.stubEnv('TERMINAL', '');
    });

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
    beforeEach(() => {
      vi.stubEnv('OPENCODE_TERMINAL', '');
      vi.stubEnv('TERMINAL', '');
    });

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
