import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { updateConfig } from '../config/config.ts';
import type { SyncBehavior } from '../config/types.ts';

export const setWorktreeSyncTool = (directory: string, client: PluginClient) =>
  tool({
    description:
      'Configure worktree sync behavior when checking out existing branches. Options: "always" (always fetch and fast-forward), "never" (never fetch, use local as-is), "prefer-local" (default: only fetch when remote is ahead and local is not).',
    args: {
      behavior: tool.schema
        .string()
        .describe(
          'Sync behavior: "always", "never", or "prefer-local". Default is "prefer-local".'
        ),
    },
    async execute({ behavior }) {
      const validBehaviors: SyncBehavior[] = ['always', 'never', 'prefer-local'];
      if (!validBehaviors.includes(behavior as SyncBehavior)) {
        client.tui.showToast({
          body: {
            title: 'Invalid Sync Behavior',
            message: `Behavior must be one of: ${validBehaviors.join(', ')}`,
            variant: 'error',
          },
        });
        return `Invalid behavior. Use one of: ${validBehaviors.join(', ')}`;
      }

      updateConfig(directory, {
        worktreeSync: {
          behavior: behavior as SyncBehavior,
        },
      });

      client.tui.showToast({
        body: {
          title: 'Worktree Sync Updated',
          message: `Sync behavior: ${behavior}`,
          variant: 'success',
        },
      });

      return `Worktree sync behavior set to: ${behavior}`;
    },
  });
