import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SessionState, StateFile } from './types.ts';
import { getMainRepoFromWorktree } from '../git/git.ts';
import { OPENCODE_CONFIG_DIR } from '../config/constants.ts';
import { STATE_FILE_NAME } from './constants.ts';

const resolveRepoRoot = (directory: string): string => {
  const mainRepo = getMainRepoFromWorktree(directory);
  return mainRepo || directory;
};

const getStateFilePath = (repoRoot: string): string =>
  join(repoRoot, OPENCODE_CONFIG_DIR, STATE_FILE_NAME);

const readStateFile = (repoRoot: string): StateFile => {
  try {
    const stateFile = getStateFilePath(repoRoot);
    if (existsSync(stateFile)) {
      return JSON.parse(readFileSync(stateFile, 'utf-8'));
    }
  } catch {
    /* empty */
  }
  return { sessions: {} };
};

const writeStateFile = (repoRoot: string, state: StateFile) => {
  const dir = join(repoRoot, OPENCODE_CONFIG_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stateFile = getStateFilePath(repoRoot);
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

export const upsertSession = (
  repoRoot: string,
  sessionId: string,
  patch: Partial<SessionState>
) => {
  const actualRoot = resolveRepoRoot(repoRoot);
  const state = readStateFile(actualRoot);
  const prev = state.sessions[sessionId] ?? {
    sessionId,
    createdAt: Date.now(),
  };
  state.sessions[sessionId] = { ...prev, ...patch, sessionId };
  writeStateFile(actualRoot, state);
};

export const getSession = (repoRoot: string, sessionId: string): SessionState | undefined => {
  const actualRoot = resolveRepoRoot(repoRoot);
  const state = readStateFile(actualRoot);

  // Try to find by session ID first
  if (state.sessions[sessionId]) {
    return state.sessions[sessionId];
  }

  // Fallback: find by matching worktreePath to current directory
  // This handles the case where a new OpenCode instance has a different session ID
  for (const session of Object.values(state.sessions)) {
    if (session.worktreePath === repoRoot) {
      return session;
    }
  }

  return undefined;
};

export const deleteSession = (repoRoot: string, sessionId: string) => {
  const actualRoot = resolveRepoRoot(repoRoot);
  const state = readStateFile(actualRoot);

  // Try to delete by session ID first
  if (state.sessions[sessionId]) {
    delete state.sessions[sessionId];
    writeStateFile(actualRoot, state);
    return;
  }

  // Fallback: find and delete by matching worktreePath
  for (const [sid, session] of Object.entries(state.sessions)) {
    if (session.worktreePath === repoRoot) {
      delete state.sessions[sid];
      writeStateFile(actualRoot, state);
      return;
    }
  }

  // If nothing found, still write the state (no-op but consistent behavior)
  writeStateFile(actualRoot, state);
};
