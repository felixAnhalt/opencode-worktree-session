import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadConfig } from '../config/config.ts';
import type { SupportedTerminal } from '../config/types.ts';

/* eslint-disable */
type MacOsTerminalRunner = (_worktreePath: string, _sessionId: string) => void;

const spawnDetached = (cmd: string, args: string[], opts?: Parameters<typeof spawn>[2]) => {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts });
  child.unref();
};

const isMacAppInstalled = (appName: string): boolean => {
  const res = spawnSync('open', ['-Ra', appName], { stdio: 'ignore' });
  return res.status === 0;
};

const resolveTerminalFromEnv = (): string | null => {
  const opencodeTerminal = process.env.OPENCODE_TERMINAL;
  const terminal = process.env.TERMINAL;

  const candidate = opencodeTerminal || terminal;
  if (!candidate) {
    return null;
  }

  return candidate;
};

const isValidTerminalPath = (path: string): boolean => {
  // Check if it's an absolute path that exists
  if (path.startsWith('/')) {
    return existsSync(path);
  }
  return false;
};

const tryLaunchCustomTerminal = (
  terminal: string,
  worktreePath: string,
  sessionId: string
): boolean => {
  // Try as full path first
  if (isValidTerminalPath(terminal)) {
    try {
      spawnDetached(terminal, [
        '--working-directory',
        worktreePath,
        '-e',
        'opencode',
        '--session',
        sessionId,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  // Try as app name on macOS
  if (process.platform === 'darwin') {
    if (isMacAppInstalled(terminal)) {
      const terminalLower = terminal.toLowerCase();
      if (terminalLower === 'alacritty') {
        runInAlacritty(worktreePath, sessionId);
        return true;
      }
      if (terminalLower === 'iterm' || terminalLower === 'iterm2') {
        runInITerm(worktreePath, sessionId);
        return true;
      }
      if (terminalLower === 'terminal') {
        runInAppleTerminal(worktreePath, sessionId);
        return true;
      }
    }
  }

  return false;
};

const runInAppleTerminal: MacOsTerminalRunner = (worktreePath: string, sessionId: string) => {
  const script = `
on run argv
  set worktreePath to item 1 of argv
  set sessionId to item 2 of argv
  set cmd to "cd " & quoted form of worktreePath & " && opencode --session " & quoted form of sessionId

  tell application "Terminal"
    activate
    do script cmd
  end tell
end run
`.trim();

  spawnDetached('osascript', ['-e', script, worktreePath, sessionId]);
};

const runInITerm: MacOsTerminalRunner = (worktreePath: string, sessionId: string) => {
  const script = `
on run argv
  set worktreePath to item 1 of argv
  set sessionId to item 2 of argv
  set cmd to "cd " & quoted form of worktreePath & " && opencode --session " & quoted form of sessionId

  tell application "iTerm"
    activate
    if (count of windows) = 0 then
      create window with default profile
    end if
    tell current window
      tell current session
        write text cmd
      end tell
    end tell
  end tell
end run
`.trim();

  spawnDetached('osascript', ['-e', script, worktreePath, sessionId]);
};

const runInAlacritty: MacOsTerminalRunner = (worktreePath: string, sessionId: string) => {
  // Use direct binary path instead of 'open -a' for more reliable argument passing
  spawnDetached('/Applications/Alacritty.app/Contents/MacOS/alacritty', [
    '--working-directory',
    worktreePath,
    '-e',
    'opencode',
    '--session',
    sessionId,
  ]);
};

const openOnMacOS = (worktreePath: string, sessionId: string) => {
  const candidates: Array<{
    name: string;
    run: MacOsTerminalRunner;
  }> = [
    { name: 'Alacritty', run: runInAlacritty },
    { name: 'iTerm', run: runInITerm },
    { name: 'iTerm2', run: runInITerm },
  ];

  for (const candidate of candidates) {
    if (isMacAppInstalled(candidate.name)) {
      candidate.run(worktreePath, sessionId);
      return;
    }
  }

  runInAppleTerminal(worktreePath, sessionId);
};

const openOnWindows = (worktreePath: string, sessionId: string) => {
  spawnDetached('cmd', [
    '/c',
    'start',
    'cmd',
    '/k',
    `cd /d "${worktreePath}" && opencode --session ${sessionId}`,
  ]);
};

const openOnLinux = (worktreePath: string, sessionId: string) => {
  spawnDetached('xdg-terminal-exec', [
    'bash',
    '-lc',
    `cd "${worktreePath}" && opencode --session "${sessionId}"`,
  ]);
};

export const openOpencodeInDefaultTerminal = (
  worktreePath: string,
  sessionId: string,
  directory?: string
) => {
  // Check config first
  if (directory) {
    const config = loadConfig(directory);
    if (config.terminal) {
      const termConfig = config.terminal;

      if (termConfig.mode === 'custom') {
        // Custom binary with optional args
        const baseArgs = termConfig.args ? termConfig.args.split(/\s+/) : [];
        const cmdArgs = [
          ...baseArgs,
          termConfig.workingDirectoryArgument!,
          worktreePath,
          termConfig.commandFlag!,
          'opencode',
          '--session',
          sessionId,
        ];

        try {
          spawnDetached(termConfig.bin, cmdArgs);
          return;
        } catch {
          // Fall through to default behavior
        }
      } else if (termConfig.mode === 'specific') {
        // Use a specific supported terminal
        const terminal = termConfig.terminal;
        if (process.platform === 'darwin' && isMacAppInstalled(terminal)) {
          const runner = getTerminalRunner(terminal);
          if (runner) {
            runner(worktreePath, sessionId);
            return;
          }
        }
        // Fall through if not available
      }
      // mode === 'default' falls through to default behavior below
    }
  }

  // Try environment variable first
  const envTerminal = resolveTerminalFromEnv();
  if (envTerminal) {
    const launched = tryLaunchCustomTerminal(envTerminal, worktreePath, sessionId);
    if (launched) {
      return;
    }
    // Log warning and fallback to auto-detection
    console.log(
      `Warning: Terminal '${envTerminal}' from environment variable not found or failed to launch. Falling back to auto-detection.`
    );
  }

  // Fallback to platform-specific auto-detection
  const platform = process.platform;

  if (platform === 'darwin') {
    openOnMacOS(worktreePath, sessionId);
    return;
  }

  if (platform === 'win32') {
    openOnWindows(worktreePath, sessionId);
    return;
  }

  openOnLinux(worktreePath, sessionId);
};

const getTerminalRunner = (terminal: SupportedTerminal): MacOsTerminalRunner | null => {
  switch (terminal) {
    case 'Alacritty':
      return runInAlacritty;
    case 'iTerm':
    case 'iTerm2':
      return runInITerm;
    case 'Terminal':
      return runInAppleTerminal;
    default:
      return null;
  }
};
