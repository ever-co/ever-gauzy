import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface IPendingInstallation {
	pluginId: string;
	installationId: string;
	versionId: string;
	timestamp: number;
}

export interface IPluginInstallationState {
	// Download state
	downloading: boolean;
	downloadProgress?: number;

	// Installation states
	installing: boolean;
	serverInstalling: boolean;
	completingInstallation: boolean;

	// Activation states
	activating: boolean;

	// Uninstallation states
	uninstalling: boolean;
	deactivating: boolean;

	// Current operation tracking
	currentPluginId?: string;
	currentInstallationId?: string;

	// Pending installations (for multi-step tracking)
	pendingInstallations: Record<string, IPendingInstallation>;

	// Error state
	error?: string;
}

export function createInitialInstallationState(): IPluginInstallationState {
	return {
		downloading: false,
		downloadProgress: 0,
		installing: false,
		serverInstalling: false,
		completingInstallation: false,
		activating: false,
		uninstalling: false,
		deactivating: false,
		currentPluginId: null,
		currentInstallationId: null,
		pendingInstallations: {},
		error: null
	};
}

@StoreConfig({ name: '_plugin_installation' })
@Injectable({ providedIn: 'root' })
export class PluginInstallationStore extends Store<IPluginInstallationState> {
	constructor() {
		super(createInitialInstallationState());
	}

	/**
	 * Adds a pending installation to track multi-step installation process
	 */
	public addPendingInstallation(pluginId: string, installationId: string, versionId: string): void {
		this.update((state) => ({
			...state,
			pendingInstallations: {
				...state.pendingInstallations,
				[pluginId]: {
					pluginId,
					installationId,
					versionId,
					timestamp: Date.now()
				}
			},
			currentPluginId: pluginId,
			currentInstallationId: installationId
		}));
	}

	/**
	 * Removes a pending installation when completed or failed
	 */
	public removePendingInstallation(pluginId: string): void {
		this.update((state) => {
			const { [pluginId]: removed, ...remaining } = state.pendingInstallations;
			return {
				...state,
				pendingInstallations: remaining,
				currentPluginId: null,
				currentInstallationId: null
			};
		});
	}

	/**
	 * Sets the download progress
	 */
	public setDownloadProgress(progress: number): void {
		this.update({ downloadProgress: progress });
	}

	/**
	 * Sets the downloading state
	 */
	public setDownloading(downloading: boolean): void {
		this.update({ downloading });
	}

	/**
	 * Sets the installing state
	 */
	public setInstalling(installing: boolean): void {
		this.update({ installing });
	}

	/**
	 * Sets the server installing state
	 */
	public setServerInstalling(serverInstalling: boolean): void {
		this.update({ serverInstalling });
	}

	/**
	 * Sets the completing installation state
	 */
	public setCompletingInstallation(completingInstallation: boolean): void {
		this.update({ completingInstallation });
	}

	/**
	 * Sets the activating state
	 */
	public setActivating(activating: boolean): void {
		this.update({ activating });
	}

	/**
	 * Sets the uninstalling state
	 */
	public setUninstalling(uninstalling: boolean): void {
		this.update({ uninstalling });
	}

	/**
	 * Sets the deactivating state
	 */
	public setDeactivating(deactivating: boolean): void {
		this.update({ deactivating });
	}

	/**
	 * Sets the current plugin being operated on
	 */
	public setCurrentPlugin(pluginId: string | null, installationId?: string | null): void {
		this.update({
			currentPluginId: pluginId,
			currentInstallationId: installationId ?? null
		});
	}

	/**
	 * Checks if a plugin has a pending installation
	 */
	public hasPendingInstallation(pluginId: string): boolean {
		return !!this.getValue().pendingInstallations[pluginId];
	}

	/**
	 * Gets pending installation for a plugin
	 */
	public getPendingInstallation(pluginId: string): IPendingInstallation | null {
		return this.getValue().pendingInstallations[pluginId] || null;
	}

	/**
	 * Sets error state
	 */
	public setErrorMessage(error: string | null): void {
		this.update({ error });
	}

	/**
	 * Clears error state
	 */
	public clearError(): void {
		this.update({ error: null });
	}

	/**
	 * Resets all installation states
	 */
	public resetStates(): void {
		this.update({
			downloading: false,
			downloadProgress: 0,
			installing: false,
			serverInstalling: false,
			completingInstallation: false,
			activating: false,
			uninstalling: false,
			deactivating: false,
			currentPluginId: null,
			currentInstallationId: null,
			error: null
		});
	}

	/**
	 * Resets the entire store
	 */
	public reset(): void {
		this.update(createInitialInstallationState());
	}
}
