import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionState, StateFile } from "./types.ts";
import * as process from "node:process";

const getStateFilePath = (repoRoot: string): string =>
	join(repoRoot, ".opencode", "worktree-session-state.json");

const readStateFile = (repoRoot: string): StateFile => {
	try {
		const stateFile = getStateFilePath(repoRoot);
		if (existsSync(stateFile)) {
			return JSON.parse(readFileSync(stateFile, "utf-8"));
		}
	} catch {}
	return { sessions: {} };
};

const writeStateFile = (repoRoot: string, state: StateFile) => {
	const dir = join(repoRoot, ".opencode");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const stateFile = getStateFilePath(repoRoot);
	writeFileSync(stateFile, JSON.stringify(state, null, 2));
};

export const upsertSession = (
	repoRoot: string,
	sessionId: string,
	patch: Partial<SessionState>,
) => {
	const state = readStateFile(repoRoot);
	const prev = state.sessions[sessionId] ?? {
		sessionId,
		createdAt: Date.now(),
	};
	state.sessions[sessionId] = { ...prev, ...patch, sessionId };
	writeStateFile(repoRoot, state);
};

export const getSession = (
	repoRoot: string,
	sessionId: string,
): SessionState | undefined => {
	const state = readStateFile(repoRoot);
	return state.sessions[sessionId];
};

export const deleteSession = (repoRoot: string, sessionId: string) => {
	const state = readStateFile(repoRoot);
	delete state.sessions[sessionId];
	writeStateFile(repoRoot, state);
};
