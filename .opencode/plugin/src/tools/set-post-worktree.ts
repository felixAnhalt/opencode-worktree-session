import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { updateConfig } from '../config/config.ts';

export const setPostWorktreeTool = (directory: string, client: PluginClient) =>
  tool({
    description:
      'Configure a post-worktree hook command to execute after worktree creation (e.g., nvim, code, webstorm). The command will receive the worktree path as the last argument.',
    args: {
      cmd: tool.schema
        .string()
        .describe('The command to execute (e.g., "nvim", "code", "webstorm")'),
      args: tool.schema
        .string()
        .optional()
        .describe('Optional arguments for the command (e.g., "--reuse-window", "--remote-tab")'),
    },
    async execute({ cmd, args }) {
      updateConfig(directory, {
        postWorktree: {
          cmd,
          args,
        },
      });

      const fullCmd = args ? `${cmd} ${args}` : cmd;
      client.tui.showToast({
        body: {
          title: 'Post-Worktree Hook Updated',
          message: `Will execute: ${fullCmd} <worktree-path>`,
          variant: 'success',
        },
      });

      return `Post-worktree hook configured: ${fullCmd} <worktree-path>`;
    },
  });
