import { tool } from '@opencode-ai/plugin';
import type { PluginClient } from '../types.ts';
import { updateConfig } from '../config/config.ts';
import type { SupportedTerminal } from '../config/types.ts';

export const setTerminalTool = (directory: string, client: PluginClient) =>
  tool({
    description:
      'Configure terminal behavior for opening worktrees. Modes: "default" (auto-detect), "custom" (custom binary with args), "specific" (use a specific supported terminal like Alacritty, iTerm, iTerm2, Terminal).',
    args: {
      mode: tool.schema.string().describe('Terminal mode: "default", "custom", or "specific"'),
      bin: tool.schema.string().optional().describe('Binary path for custom mode'),
      args: tool.schema.string().optional().describe('Arguments for custom binary'),
      terminal: tool.schema
        .string()
        .optional()
        .describe('Terminal name for specific mode: Alacritty, iTerm, iTerm2, or Terminal'),
    },
    async execute({ mode, bin, args, terminal }) {
      if (mode === 'default') {
        updateConfig(directory, {
          terminal: { mode: 'default' },
        });

        client.tui.showToast({
          body: {
            title: 'Terminal Config Updated',
            message: 'Using default auto-detection',
            variant: 'success',
          },
        });

        return 'Terminal mode set to: default (auto-detection)';
      }

      if (mode === 'custom') {
        if (!bin) {
          client.tui.showToast({
            body: {
              title: 'Invalid Config',
              message: 'Custom mode requires a binary path',
              variant: 'error',
            },
          });
          return 'Error: Custom mode requires a binary path (bin parameter)';
        }

        updateConfig(directory, {
          terminal: { mode: 'custom', bin, args },
        });

        client.tui.showToast({
          body: {
            title: 'Terminal Config Updated',
            message: `Using custom: ${bin}${args ? ' ' + args : ''}`,
            variant: 'success',
          },
        });

        return `Terminal mode set to: custom (${bin}${args ? ' ' + args : ''})`;
      }

      if (mode === 'specific') {
        const validTerminals: SupportedTerminal[] = ['Alacritty', 'iTerm', 'iTerm2', 'Terminal'];
        if (!terminal || !validTerminals.includes(terminal as SupportedTerminal)) {
          client.tui.showToast({
            body: {
              title: 'Invalid Terminal',
              message: `Terminal must be one of: ${validTerminals.join(', ')}`,
              variant: 'error',
            },
          });
          return `Error: Terminal must be one of: ${validTerminals.join(', ')}`;
        }

        updateConfig(directory, {
          terminal: { mode: 'specific', terminal: terminal as SupportedTerminal },
        });

        client.tui.showToast({
          body: {
            title: 'Terminal Config Updated',
            message: `Using specific: ${terminal}`,
            variant: 'success',
          },
        });

        return `Terminal mode set to: specific (${terminal})`;
      }

      client.tui.showToast({
        body: {
          title: 'Invalid Mode',
          message: 'Mode must be: default, custom, or specific',
          variant: 'error',
        },
      });

      return 'Error: Mode must be one of: default, custom, specific';
    },
  });
