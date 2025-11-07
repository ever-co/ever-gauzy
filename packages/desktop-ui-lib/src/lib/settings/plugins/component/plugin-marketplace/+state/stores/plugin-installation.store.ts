import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin } from '@gauzy/contracts';

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

	// Toggle state (for UI)
	toggle: {
		isChecked: boolean;
		plugin: IPlugin;
	};

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
		toggle: {
			isChecked: false,
			plugin: null
		},
		error: null
	};
}

@StoreConfig({ name: '_plugin_installation' })
@Injectable({ providedIn: 'root' })
export class PluginInstallationStore extends Store<IPluginInstallationState> {
	constructor() {
		super(createInitialInstallationState());
	}

	public setToggle({ isChecked, plugin }: Partial<IPluginInstallationState['toggle']>): void {
		this.update((state) => ({
			...state,
			toggle: {
				...state.toggle,
				isChecked: isChecked ?? state.toggle.isChecked,
				plugin: plugin ?? state.toggle.plugin
			}
		}));
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
	 * Sets error state
	 */
	public setInstallationError(error: string): void {
		this.update({ error });
	}

	/**
	 * Clears error state
	 */
	public clearError(): void {
		this.update({ error: null });
	}
}
