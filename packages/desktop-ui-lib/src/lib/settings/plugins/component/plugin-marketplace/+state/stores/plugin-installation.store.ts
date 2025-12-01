import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface IPendingInstallation {
	pluginId: string;
	installationId: string;
	versionId: string;
	timestamp: number;
}

export interface IPluginInstallationState {
	// Download state (per plugin ID)
	downloading: Record<string, boolean>;
	downloadProgress: Record<string, number>;

	// Installation states (per plugin ID)
	installing: Record<string, boolean>;
	serverInstalling: Record<string, boolean>;
	completingInstallation: Record<string, boolean>;

	// Activation states (per plugin ID)
	activating: Record<string, boolean>;

	// Uninstallation states (per plugin ID)
	uninstalling: Record<string, boolean>;
	deactivating: Record<string, boolean>;

	// Pending installations (for multi-step tracking)
	pendingInstallations: Record<string, IPendingInstallation>;

	// Error state (per plugin ID)
	error: Record<string, string>;
}

export function createInitialInstallationState(): IPluginInstallationState {
	return {
		downloading: {},
		downloadProgress: {},
		installing: {},
		serverInstalling: {},
		completingInstallation: {},
		activating: {},
		uninstalling: {},
		deactivating: {},
		pendingInstallations: {},
		error: {}
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
			}
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
				pendingInstallations: remaining
			};
		});
	}

	/**
	 * Sets the download progress for a specific plugin
	 */
	public setDownloadProgress(pluginId: string, progress: number): void {
		this.update((state) => ({
			downloadProgress: {
				...state.downloadProgress,
				[pluginId]: progress
			}
		}));
	}

	/**
	 * Sets the downloading state for a specific plugin
	 */
	public setDownloading(pluginId: string, downloading: boolean): void {
		this.update((state) => ({
			downloading: {
				...state.downloading,
				[pluginId]: downloading
			}
		}));
	}

	/**
	 * Sets the installing state for a specific plugin
	 */
	public setInstalling(pluginId: string, installing: boolean): void {
		this.update((state) => ({
			installing: {
				...state.installing,
				[pluginId]: installing
			}
		}));
	}

	/**
	 * Sets the server installing state for a specific plugin
	 */
	public setServerInstalling(pluginId: string, serverInstalling: boolean): void {
		this.update((state) => ({
			serverInstalling: {
				...state.serverInstalling,
				[pluginId]: serverInstalling
			}
		}));
	}

	/**
	 * Sets the completing installation state for a specific plugin
	 */
	public setCompletingInstallation(pluginId: string, completingInstallation: boolean): void {
		this.update((state) => ({
			completingInstallation: {
				...state.completingInstallation,
				[pluginId]: completingInstallation
			}
		}));
	}

	/**
	 * Sets the activating state for a specific plugin
	 */
	public setActivating(pluginId: string, activating: boolean): void {
		this.update((state) => ({
			activating: {
				...state.activating,
				[pluginId]: activating
			}
		}));
	}

	/**
	 * Sets the uninstalling state for a specific plugin
	 */
	public setUninstalling(pluginId: string, uninstalling: boolean): void {
		this.update((state) => ({
			uninstalling: {
				...state.uninstalling,
				[pluginId]: uninstalling
			}
		}));
	}

	/**
	 * Sets the deactivating state for a specific plugin
	 */
	public setDeactivating(pluginId: string, deactivating: boolean): void {
		this.update((state) => ({
			deactivating: {
				...state.deactivating,
				[pluginId]: deactivating
			}
		}));
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
	 * Sets error state for a specific plugin
	 */
	public setErrorMessage(pluginId: string, error: string | null): void {
		this.update((state) => ({
			error: {
				...state.error,
				[pluginId]: error
			}
		}));
	}

	/**
	 * Clears error state for a specific plugin or all plugins
	 */
	public clearError(pluginId?: string): void {
		if (pluginId) {
			this.update((state) => {
				const { [pluginId]: removed, ...remaining } = state.error;
				return { error: remaining };
			});
		} else {
			this.update({ error: {} });
		}
	}

	/**
	 * Resets installation states for a specific plugin or all plugins
	 */
	public resetStates(pluginId?: string): void {
		if (pluginId) {
			this.update((state) => {
				const cleanRecord = (record: Record<string, any>) => {
					const { [pluginId]: removed, ...remaining } = record;
					return remaining;
				};

				return {
					downloading: cleanRecord(state.downloading),
					downloadProgress: cleanRecord(state.downloadProgress),
					installing: cleanRecord(state.installing),
					serverInstalling: cleanRecord(state.serverInstalling),
					completingInstallation: cleanRecord(state.completingInstallation),
					activating: cleanRecord(state.activating),
					uninstalling: cleanRecord(state.uninstalling),
					deactivating: cleanRecord(state.deactivating),
					error: cleanRecord(state.error)
				};
			});
		} else {
			this.update({
				downloading: {},
				downloadProgress: {},
				installing: {},
				serverInstalling: {},
				completingInstallation: {},
				activating: {},
				uninstalling: {},
				deactivating: {},
				error: {}
			});
		}
	}

	/**
	 * Resets the entire store
	 */
	public reset(): void {
		this.update(createInitialInstallationState());
	}
}
