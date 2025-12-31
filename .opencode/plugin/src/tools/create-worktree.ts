import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { createWorktreeSession } from '../git/worktree.ts';
import { upsertSession } from '../state/state.ts';

export const createWorktreeTool = (directory: string, client: PluginClient) =>
  tool({
    description:
      'Creates a git worktree for this session and automatically launches a new opencode instance in it. Starts new terminal session after tool execution and finished llm invocation.',
    args: {
      branch: tool.schema.string().describe('The branch name for the worktree'),
    },
    async execute({ branch }, context) {
      const result = createWorktreeSession(directory, branch);

      if (!result.success || !result.worktreePath) {
        return result.error || 'Failed to create worktree';
      }

      upsertSession(directory, context.sessionID, {
        branch,
        worktreePath: result.worktreePath,
        pendingWorktreeSpawn: {
          worktreePath: result.worktreePath,
          branch,
          sessionID: context.sessionID,
        },
      });

      client.tui.showToast({
        body: {
          title: 'Worktree Created',
          message: `Branch ${branch} at ${result.worktreePath}`,
          variant: 'success',
        },
      });

      return `Created worktree at ${result.worktreePath} for branch ${branch}. Terminal will open when this response completes...`;
    },
  });
