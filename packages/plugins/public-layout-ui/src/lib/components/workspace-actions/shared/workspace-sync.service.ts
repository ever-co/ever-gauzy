import { Injectable, OnDestroy } from '@angular/core';

type WorkspaceOperation =
	| 'workspace-created'
	| 'workspace-switched'
	| 'workspace-signin'
	| 'workspace-updated'
	| 'workspace-deleted';

type WorkspaceSyncPayload = Record<string, unknown>;

interface WorkspaceSyncMessage {
	type: WorkspaceOperation;
	payload: WorkspaceSyncPayload;
	timestamp: number;
	tabId: string;
}

/**
 * Service for synchronizing workspace operations across multiple browser tabs.
 * Uses Broadcast Channel API to communicate workspace changes between tabs.
 */
@Injectable({
	providedIn: 'root'
})
export class WorkspaceSyncService implements OnDestroy {
	private readonly CHANNEL_NAME = 'gauzy-workspace-sync';
	private broadcastChannel: BroadcastChannel | null = null;

	/**
	 * Types of workspace operations that trigger cross-tab synchronization
	 */
	public readonly WORKSPACE_OPERATIONS = {
		CREATED: 'workspace-created',
		SWITCHED: 'workspace-switched',
		SIGNIN: 'workspace-signin',
		UPDATED: 'workspace-updated',
		DELETED: 'workspace-deleted'
	} as const;

	constructor() {
		this.initializeBroadcastChannel();
	}

	/**
	 * Initialize the Broadcast Channel for cross-tab communication
	 */
	private initializeBroadcastChannel(): void {
		// Check if Broadcast Channel API is supported
		if (typeof BroadcastChannel !== 'undefined') {
			try {
				this.broadcastChannel = new BroadcastChannel(this.CHANNEL_NAME);
				this.setupMessageListener();
			} catch (error) {
				console.warn('Failed to initialize Broadcast Channel:', error);
			}
		} else {
			console.warn('Broadcast Channel API is not supported in this browser');
		}
	}

	/**
	 * Setup listener for incoming messages from other tabs
	 */
	private setupMessageListener(): void {
		if (!this.broadcastChannel) return;

		this.broadcastChannel.addEventListener('message', (event: MessageEvent<WorkspaceSyncMessage>) => {
			this.handleIncomingMessage(event.data);
		});
	}

	/**
	 * Handle incoming messages from other tabs
	 */
	private handleIncomingMessage(data: WorkspaceSyncMessage): void {
		if (!data || typeof data !== 'object') return;
		const { type, timestamp, tabId } = data;

		if (typeof type !== 'string') return;

		// Ignore messages from the same tab
		const myTabId = this.getTabId();
		if (tabId === myTabId) return;

		// Check if message is recent (within last 5 seconds to avoid stale messages)
		if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return;
		const messageAge = Date.now() - timestamp;
		if (messageAge > 5000) return;

		// Handle workspace operation messages
		if (Object.values(this.WORKSPACE_OPERATIONS).includes(type as any)) {
			this.reloadCurrentTab();
		}
	}

	/**
	 * Broadcast a workspace operation to other tabs
	 */
	public broadcastWorkspaceOperation(operation: WorkspaceOperation, payload?: WorkspaceSyncPayload): void {
		if (!this.broadcastChannel) return;

		const message: WorkspaceSyncMessage = {
			type: operation,
			payload: (payload ?? {}) as WorkspaceSyncPayload,
			timestamp: Date.now(),
			tabId: this.getTabId()
		};

		try {
			this.broadcastChannel.postMessage(message);
		} catch (error) {
			console.warn('Failed to broadcast workspace operation:', error);
		}
	}

	/**
	 * Broadcast workspace creation event
	 */
	public broadcastWorkspaceCreated(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.CREATED, workspaceData);
	}

	/**
	 * Broadcast workspace switch event
	 */
	public broadcastWorkspaceSwitched(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.SWITCHED, workspaceData);
	}

	/**
	 * Broadcast workspace signin event
	 */
	public broadcastWorkspaceSignin(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.SIGNIN, workspaceData);
	}

	/**
	 * Broadcast workspace update event
	 */
	public broadcastWorkspaceUpdated(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.UPDATED, workspaceData);
	}

	/**
	 * Broadcast workspace deletion event
	 */
	public broadcastWorkspaceDeleted(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.DELETED, workspaceData);
	}

	/**
	 * Reload the current tab to reflect workspace changes
	 */
	private reloadTimer: ReturnType<typeof setTimeout> | null = null;

	private reloadCurrentTab(): void {
		if (this.reloadTimer) {
			clearTimeout(this.reloadTimer);
		}
		this.reloadTimer = setTimeout(() => window.location.reload(), 100);
	}

	/**
	 * Generate a unique tab identifier
	 */
	private getTabId(): string {
		// Use sessionStorage to create a unique ID per tab (with safe fallback)
		try {
			if (typeof sessionStorage !== 'undefined') {
				let tabId = sessionStorage.getItem('gauzy-tab-id');
				if (!tabId) {
					tabId = this.generateTabId();
					sessionStorage.setItem('gauzy-tab-id', tabId);
				}
				return tabId;
			}
		} catch {
			// ignore and fallback
		}
		return this.generateTabId();
	}

	/**
	 * Check if Broadcast Channel is supported and available
	 */
	public isSupported(): boolean {
		return typeof BroadcastChannel !== 'undefined';
	}

	private generateTabId(): string {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? `tab-${crypto.randomUUID()}`
			: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
	/**
	 * Cleanup resources when service is destroyed
	 */
    ngOnDestroy(): void {
        clearTimeout(this.reloadTimer);
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
    }
}
