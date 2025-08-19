export const WORKSPACE_OPERATIONS = {
	CREATED: 'workspace-created',
	SWITCHED: 'workspace-switched',
	SIGNIN: 'workspace-signin',
	UPDATED: 'workspace-updated',
	DELETED: 'workspace-deleted'
} as const;

/**
 * Union type of workspace operations derived from the constants
 */
export type WorkspaceOperation = (typeof WORKSPACE_OPERATIONS)[keyof typeof WORKSPACE_OPERATIONS];

export type WorkspaceSyncPayload = Record<string, unknown>;

export interface WorkspaceSyncMessage {
	type: WorkspaceOperation;
	payload: WorkspaceSyncPayload;
	timestamp: number;
	tabId: string;
}
