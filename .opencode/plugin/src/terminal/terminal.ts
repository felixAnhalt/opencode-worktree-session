import { spawn, spawnSync } from 'node:child_process';

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
  const command = 'cd "$WORKTREE" && opencode --session "$SESSION"';

  spawnDetached('open', ['-a', 'Alacritty', '--args', '-e', 'zsh', '-lc', command], {
    env: { ...process.env, WORKTREE: worktreePath, SESSION: sessionId },
  });
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

export const openOpencodeInDefaultTerminal = (worktreePath: string, sessionId: string) => {
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
