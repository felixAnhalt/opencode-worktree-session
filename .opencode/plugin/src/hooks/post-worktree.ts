import { spawn } from 'node:child_process';
import { loadConfig } from '../config/config.ts';

export type PostHookResult = {
  executed: boolean;
  message: string;
};

const executeDetached = (cmd: string, args: string[], worktreePath: string): void => {
  const allArgs = [...args, worktreePath];
  const child = spawn(cmd, allArgs, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
};

export const runPostWorktreeHook = (directory: string, worktreePath: string): PostHookResult => {
  // 1. Check environment variables first (highest priority)
  const envCmd = process.env.OPENCODE_POST_CMD;
  if (envCmd) {
    const envArgs = process.env.OPENCODE_POST_CMD_ARGS ?? '';
    const argsArray = envArgs ? envArgs.split(/\s+/) : [];
    const fullCommand = `${envCmd} ${envArgs} "${worktreePath}"`.trim();

    try {
      executeDetached(envCmd, argsArray, worktreePath);
      return {
        executed: true,
        message: `Executed env hook: ${fullCommand}`,
      };
    } catch (err) {
      return {
        executed: false,
        message: `Failed to execute env hook: ${String(err)}`,
      };
    }
  }

  // 2. Fallback to config file
  const config = loadConfig(directory);
  if (config.postWorktree?.cmd) {
    const { cmd, args = '' } = config.postWorktree;
    const argsArray = args ? args.split(/\s+/) : [];
    const fullCommand = `${cmd} ${args} "${worktreePath}"`.trim();

    try {
      executeDetached(cmd, argsArray, worktreePath);
      return {
        executed: true,
        message: `Executed config hook: ${fullCommand}`,
      };
    } catch (err) {
      return {
        executed: false,
        message: `Failed to execute config hook: ${String(err)}`,
      };
    }
  }

  // 3. No hook configured
  return {
    executed: false,
    message: 'No post-worktree hook configured',
  };
};
