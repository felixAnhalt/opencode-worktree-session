export type SessionState = {
  sessionId: string;
  branch?: string;
  worktreePath?: string;
  createdAt: number;
  pendingWorktreeSpawn?: {
    worktreePath: string;
    branch: string;
    sessionID: string;
  };
  pendingWorktreeDeletion?: {
    worktreePath: string;
    branch: string;
    sessionID: string;
  };
};

export type StateFile = {
  sessions: Record<string, SessionState>;
};

export type CleanupResult = {
  success: boolean;
  error?: string;
};
