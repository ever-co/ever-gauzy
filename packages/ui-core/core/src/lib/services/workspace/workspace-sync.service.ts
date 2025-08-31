import { Injectable, OnDestroy } from '@angular/core';
import {
	WORKSPACE_OPERATIONS,
	WorkspaceOperation,
	WorkspaceSyncMessage,
	WorkspaceSyncPayload
} from './types/workspace-sync-type';

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
	private tabIdCache: string | null = null;

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

		this.broadcastChannel.onmessage = (event: MessageEvent<WorkspaceSyncMessage>) => {
			this.handleIncomingMessage(event.data);
		};
	}

	/**
	 * Handle incoming messages from other tabs
	 */
	private handleIncomingMessage(data: WorkspaceSyncMessage): void {
		// Ignore malformed messages and messages from the same tab
		if (!data || data.tabId === this.getTabId()) {
			return;
		}

		// Handle workspace operation messages
		if (Object.values(WORKSPACE_OPERATIONS).includes(data.type)) {
			this.reloadCurrentTab();
		}
	}

	/**
	 * Broadcast a workspace operation to other tabs
	 */
public broadcastWorkspaceOperation(
    operation: WorkspaceOperation,
    payload: WorkspaceSyncPayload = {}
): void {
    if (!this.broadcastChannel) {
        return;
    }

    const message: WorkspaceSyncMessage = {
        type: operation,
        payload,
        timestamp: Date.now(),
        tabId: this.getTabId()
    };

    try {
        this.broadcastChannel.postMessage(message);
    } catch (error) {
        console.warn(
            'Failed to broadcast workspace operation (payload must be structured-cloneable):',
            error
        );
    }
}

	/**
	 * Broadcast workspace creation event
	 */
	public broadcastWorkspaceCreated(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(WORKSPACE_OPERATIONS.CREATED, workspaceData);
	}

	/**
	 * Broadcast workspace switch event
	 */
	public broadcastWorkspaceSwitched(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(WORKSPACE_OPERATIONS.SWITCHED, workspaceData);
	}

	/**
	 * Broadcast workspace signin event
	 */
	public broadcastWorkspaceSignin(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(WORKSPACE_OPERATIONS.SIGNIN, workspaceData);
	}

	/**
	 * Broadcast workspace update event
	 */
	public broadcastWorkspaceUpdated(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(WORKSPACE_OPERATIONS.UPDATED, workspaceData);
	}

	/**
	 * Broadcast workspace deletion event
	 */
	public broadcastWorkspaceDeleted(workspaceData?: WorkspaceSyncPayload): void {
		this.broadcastWorkspaceOperation(WORKSPACE_OPERATIONS.DELETED, workspaceData);
	}

	/**
	 * Reload the current tab to reflect workspace changes
	 */
	private reloadTimer: ReturnType<typeof setTimeout> | null = null;

	private reloadCurrentTab(): void {
		if (this.reloadTimer) {
			clearTimeout(this.reloadTimer);
			this.reloadTimer = null;
		}
		if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
			this.reloadTimer = setTimeout(() => window.location.reload(), 150);
		}
	}

	/**
	 * Generate a unique tab identifier
	 */
	private getTabId(): string {
		// Memoize to ensure stability even if sessionStorage is unavailable
		if (this.tabIdCache) {
			return this.tabIdCache;
		}
		try {
			if (typeof sessionStorage !== 'undefined') {
				let tabId = sessionStorage.getItem('gauzy-tab-id');
				if (!tabId) {
					tabId = this.generateTabId();
					sessionStorage.setItem('gauzy-tab-id', tabId);
				}
				this.tabIdCache = tabId;
				return tabId;
			}
		} catch {
			// ignore and fallback
		}
		this.tabIdCache = this.generateTabId();
		return this.tabIdCache;
	}

	/**
	 * Check if Broadcast Channel is supported and available
	 */
	public isSupported(): boolean {
		const hasAPI = typeof BroadcastChannel !== 'undefined';
		if (hasAPI && !this.broadcastChannel) {
			this.initializeBroadcastChannel();
		}
		return hasAPI && !!this.broadcastChannel;
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
		if (this.reloadTimer !== null) {
			clearTimeout(this.reloadTimer);
			this.reloadTimer = null;
		}
		if (this.broadcastChannel) {
			this.broadcastChannel.close();
			this.broadcastChannel = null;
		}
	}
}
