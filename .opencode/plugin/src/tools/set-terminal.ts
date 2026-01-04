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
      bin: tool.schema
        .string()
        .optional()
        .describe(
          'Binary path for custom mode. Will be run with ${cmd} ${args including workdir and commandflag} "${worktreePath}"'
        ),
      args: tool.schema
        .string()
        .optional()
        .describe(
          'Additional arguments for custom binary (e.g., "--single-instance" for kitty). These are placed before the working directory and command execution flags.'
        ),
      workingDirectoryArgument: tool.schema
        .string()
        .optional()
        .describe(
          'Flag for setting working directory (e.g., "--working-directory" for Alacritty, "--cwd" for wezterm, "-d" for kitty). Required for custom mode.'
        ),
      commandFlag: tool.schema
        .string()
        .optional()
        .describe(
          'Flag for executing command (e.g., "-e" for Alacritty/kitty, "start --" for wezterm). Required for custom mode.'
        ),
      terminal: tool.schema
        .string()
        .optional()
        .describe('Terminal name for specific mode: Alacritty, iTerm, iTerm2, or Terminal'),
    },
    async execute({ mode, bin, args, workingDirectoryArgument, commandFlag, terminal }) {
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

        if (!workingDirectoryArgument) {
          client.tui.showToast({
            body: {
              title: 'Invalid Config',
              message: 'Custom mode requires workingDirectoryArgument',
              variant: 'error',
            },
          });
          return 'Error: Custom mode requires workingDirectoryArgument (e.g., "--working-directory", "--cwd", "-d")';
        }

        if (!commandFlag) {
          client.tui.showToast({
            body: {
              title: 'Invalid Config',
              message: 'Custom mode requires commandFlag',
              variant: 'error',
            },
          });
          return 'Error: Custom mode requires commandFlag (e.g., "-e", "start --")';
        }

        updateConfig(directory, {
          terminal: {
            mode: 'custom',
            bin,
            args,
            workingDirectoryArgument,
            commandFlag,
          },
        });

        const configParts = [bin];
        if (args) configParts.push(args);
        configParts.push(`${workingDirectoryArgument} <path>`);
        configParts.push(commandFlag);
        configParts.push('opencode --session <id>');

        client.tui.showToast({
          body: {
            title: 'Terminal Config Updated',
            message: `Using custom: ${configParts.join(' ')}`,
            variant: 'success',
          },
        });

        return `Terminal mode set to: custom (${configParts.join(' ')})`;
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
