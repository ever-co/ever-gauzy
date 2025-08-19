export type WorkspaceOperation =
	| 'workspace-created'
	| 'workspace-switched'
	| 'workspace-signin'
	| 'workspace-updated'
	| 'workspace-deleted';

export type WorkspaceSyncPayload = Record<string, unknown>;

export interface WorkspaceSyncMessage {
	type: WorkspaceOperation;
	payload: WorkspaceSyncPayload;
	timestamp: number;
	tabId: string;
}
