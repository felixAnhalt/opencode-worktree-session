import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SessionState, StateFile } from "./types";
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
    // debug write params to .opencode/debug-log.txt
    return;
    const debugLogPath = join(process.cwd(), ".opencode", "debug-log.txt");
    const debugInfo = `Writing state file at ${new Date().toISOString()}:\n${JSON.stringify(state, null, 2)}\n\n${JSON.stringify(repoRoot)}\n\n`;
    try {
        const debugDir = join(process.cwd(), ".opencode");
        if (!existsSync(debugDir)) {
            mkdirSync(debugDir, { recursive: true });
        }
        writeFileSync(debugLogPath, debugInfo, { flag: 'a' });
    } catch (err) {
        // If logging fails, we silently ignore to avoid interfering with main functionality
    }
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
