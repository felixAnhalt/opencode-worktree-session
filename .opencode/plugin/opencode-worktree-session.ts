import { type Plugin } from '@opencode-ai/plugin';
import { isGitRepo } from './src/git/git.ts';
import { handleSessionCreated } from './src/events/session-created.ts';
import { handleSessionDeleted } from './src/events/session-deleted.ts';
import { handleSessionError } from './src/events/session-error.ts';
import { handleSessionIdle } from './src/events/session-idle.ts';
import { getSystemPromptForWorktree } from './src/system-prompt/system-prompt.ts';
import { createWorktreeTool } from './src/tools/create-worktree.ts';
import { deleteWorktreeTool } from './src/tools/delete-worktree.ts';
import { setPostWorktreeTool } from './src/tools/set-post-worktree.ts';
import { setWorktreeSyncTool } from './src/tools/set-worktree-sync.ts';
import { setTerminalTool } from './src/tools/set-terminal.ts';
import { loadConfig } from './src/config/config.ts';
import type { ToolDefinition } from '@opencode-ai/plugin/tool';

export const GitWorktreeSessionPlugin: Plugin = async ({ client, worktree, directory }) => {
  const config = loadConfig(directory);
  const configToolsAvailable = config.configToolsAvailable ?? true;

  const tools: Record<string, ToolDefinition> = {
    createworktree: createWorktreeTool(directory, client),
    deleteworktree: deleteWorktreeTool(directory, worktree, client),
  };

  if (configToolsAvailable) {
    tools.setpostworktree = setPostWorktreeTool(directory, client);
    tools.setworktreesync = setWorktreeSyncTool(directory, client);
    tools.setterminal = setTerminalTool(directory, client);
  }

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        handleSessionCreated(event, directory, worktree);
        return;
      }

      if (event.type === 'session.idle') {
        try {
          await handleSessionIdle(event, directory, worktree, client);
        } catch (err) {
          client.tui.showToast({
            body: {
              title: 'Session Idle Error',
              message: String(err),
              variant: 'error',
            },
          });
        }
        return;
      }

      if (event.type === 'session.error') {
        handleSessionError(event, directory, worktree, client);
        return;
      }

      if (event.type === 'session.deleted') {
        handleSessionDeleted(event, directory, worktree, client);
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      if (!isGitRepo(directory)) return;

      const prompts = getSystemPromptForWorktree(worktree);
      output.system.push(...prompts);
    },

    tool: tools,
  };
};
