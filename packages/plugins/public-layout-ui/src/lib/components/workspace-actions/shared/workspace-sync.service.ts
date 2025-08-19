import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

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
	private destroy$ = new Subject<void>();

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

		this.broadcastChannel.addEventListener('message', (event) => {
			this.handleIncomingMessage(event.data);
		});
	}

	/**
	 * Handle incoming messages from other tabs
	 */
	private handleIncomingMessage(data: any): void {
		if (!data || !data.type) return;

		const { type, payload, timestamp, tabId } = data;

		// Ignore messages from the same tab
		if (tabId === this.getTabId()) return;

		// Check if message is recent (within last 5 seconds to avoid stale messages)
		const messageAge = Date.now() - timestamp;
		if (messageAge > 5000) return;

		// Handle workspace operation messages
		if (Object.values(this.WORKSPACE_OPERATIONS).includes(type)) {
			this.reloadCurrentTab(type, payload);
		}
	}

	/**
	 * Broadcast a workspace operation to other tabs
	 */
	public broadcastWorkspaceOperation(operation: string, payload?: any): void {
		if (!this.broadcastChannel) return;

		const message = {
			type: operation,
			payload: payload || {},
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
	public broadcastWorkspaceCreated(workspaceData?: any): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.CREATED, workspaceData);
	}

	/**
	 * Broadcast workspace switch event
	 */
	public broadcastWorkspaceSwitched(workspaceData?: any): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.SWITCHED, workspaceData);
	}

	/**
	 * Broadcast workspace signin event
	 */
	public broadcastWorkspaceSignin(workspaceData?: any): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.SIGNIN, workspaceData);
	}

	/**
	 * Broadcast workspace update event
	 */
	public broadcastWorkspaceUpdated(workspaceData?: any): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.UPDATED, workspaceData);
	}

	/**
	 * Broadcast workspace deletion event
	 */
	public broadcastWorkspaceDeleted(workspaceData?: any): void {
		this.broadcastWorkspaceOperation(this.WORKSPACE_OPERATIONS.DELETED, workspaceData);
	}

	/**
	 * Reload the current tab to reflect workspace changes
	 */
	private reloadCurrentTab(_operation: string, _payload?: any): void {
		// Add a small delay to ensure any ongoing operations complete
		setTimeout(() => {
			// Force a complete page reload to refresh the workspace state
			window.location.reload();
		}, 100);
	}

	/**
	 * Generate a unique tab identifier
	 */
	private getTabId(): string {
		// Use sessionStorage to create a unique ID per tab
		let tabId = sessionStorage.getItem('gauzy-tab-id');
		if (!tabId) {
			tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
			sessionStorage.setItem('gauzy-tab-id', tabId);
		}
		return tabId;
	}

	/**
	 * Check if Broadcast Channel is supported and available
	 */
	public isSupported(): boolean {
		return typeof BroadcastChannel !== 'undefined' && this.broadcastChannel !== null;
	}

	/**
	 * Cleanup resources when service is destroyed
	 */
	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();

		if (this.broadcastChannel) {
			this.broadcastChannel.close();
			this.broadcastChannel = null;
		}
	}
}
