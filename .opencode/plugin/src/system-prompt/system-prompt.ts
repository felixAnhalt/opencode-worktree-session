export const getSystemPromptForWorktree = (worktree: string): string[] => {
  const prompts: string[] = [];

  // If in a worktree, add strict rules for deletion
  if (worktree.includes('worktrees')) {
    prompts.push(
      "WORKTREE SESSION RULES (STRICT):\n1) When finished, tell the user they can run the 'deleteworktree' tool.\n2) If 'deleteworktree' is executed: STOP. Do not run ANY shell commands (no git/pwd/ls/cat), do not list/read files, and do not call any other tools afterward. The worktree directory may no longer exist and process.cwd() can be invalid.\n3) If verification is needed, ASK the user to run verification commands from the repository root (outside the deleted worktree) and paste the output."
    );
  } else {
    prompts.push(
      "IMPORTANT: A 'createworktree' tool is available for creating isolated git worktrees. When the user mentions creating a branch or wants to start a new feature, proactively suggest or use this tool. Ask for a branch name if not provided."
    );
  }

  return prompts;
};
