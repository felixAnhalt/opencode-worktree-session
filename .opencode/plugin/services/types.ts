export type SessionState = {
	sessionId: string;
	branch?: string;
	worktreePath?: string;
	createdAt: number;
};

export type StateFile = {
	sessions: Record<string, SessionState>;
};

export type CleanupResult = {
	success: boolean;
	error?: string;
};
