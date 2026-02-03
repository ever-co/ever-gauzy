import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin } from '@gauzy/contracts';

/**
 * Interface representing a subscribed plugin that is not yet installed locally
 */
export interface IPendingPluginInstallation {
	plugin: IPlugin;
	subscriptionId: string;
	isInstalling: boolean;
	isInstalled: boolean;
	error: string | null;
	/** Whether the plugin can be auto-installed without user interaction */
	canAutoInstall?: boolean;
	/** Whether the plugin is mandatory for the tenant/organization */
	isMandatory?: boolean;
}

/**
 * Pagination details for pending installations
 */
export interface IPendingPagination {
	total: number;
	skip: number;
	take: number;
}

/**
 * State interface for pending plugin installations
 */
export interface IPendingInstallationState {
	/** List of subscribed plugins that are not installed locally */
	pendingPlugins: IPendingPluginInstallation[];
	/** Loading state for fetching pending plugins */
	loading: boolean;
	/** Global error state */
	error: string | null;
	/** Whether the check has been performed */
	checked: boolean;
	/** Whether force install mode is enabled (auto-install without dialog) */
	forceInstallEnabled: boolean;
	/** Pagination details for pending plugins*/
	pagination: IPendingPagination;
}

/**
 * Creates the initial state for pending installations
 */
export function createInitialPendingInstallationState(): IPendingInstallationState {
	return {
		pendingPlugins: [],
		loading: false,
		error: null,
		checked: false,
		forceInstallEnabled: false,
		pagination: {
			total: 0,
			skip: 1,
			take: 10
		}
	};
}

@StoreConfig({ name: '_pending_plugin_installations' })
@Injectable({ providedIn: 'root' })
export class PendingInstallationStore extends Store<IPendingInstallationState> {
	constructor() {
		super(createInitialPendingInstallationState());
	}

	/**
	 * Sets the pending plugins list
	 */
	public setPendingPlugins(plugins: IPendingPluginInstallation[], total: number): void {
		this.update((state) => ({
			pendingPlugins: plugins,
			checked: true,
			loading: false,
			pagination: {
				...state.pagination,
				skip: state.pagination.skip + 1,
				total
			}
		}));
	}

	/**
	 * Appends more pending plugins to the existing list (for pagination)
	 */
	public appendPendingPlugins(plugins: IPendingPluginInstallation[], total: number): void {
		this.update((state) => {
			const existingIds = new Set(state.pendingPlugins.map((p) => p.plugin.id));
			const newPlugins = plugins.filter((p) => !existingIds.has(p.plugin.id));
			return {
				pendingPlugins: [...state.pendingPlugins, ...newPlugins],
				checked: true,
				loading: false,
				pagination: {
					...state.pagination,
					skip: state.pagination.skip + 1,
					total
				}
			};
		});
	}

	/**
	 * Updates the installing state for a specific plugin
	 */
	public setPluginInstalling(pluginId: string, isInstalling: boolean): void {
		this.update((state) => ({
			pendingPlugins: state.pendingPlugins.map((p) =>
				p.plugin.id === pluginId ? { ...p, isInstalling, error: isInstalling ? null : p.error } : p
			)
		}));
	}

	/**
	 * Marks a plugin as installed (shows success state before removal)
	 */
	public setPluginInstalled(pluginId: string, isInstalled: boolean): void {
		this.update((state) => ({
			pendingPlugins: state.pendingPlugins.map((p) =>
				p.plugin.id === pluginId ? { ...p, isInstalling: false, isInstalled, error: null } : p
			)
		}));
	}

	/**
	 * Sets the error for a specific plugin
	 */
	public setPluginError(pluginId: string, error: string | null): void {
		this.update((state) => ({
			pendingPlugins: state.pendingPlugins.map((p) =>
				p.plugin.id === pluginId ? { ...p, error, isInstalling: false, isInstalled: false } : p
			)
		}));
	}

	/**
	 * Removes a plugin from the pending list (after successful installation)
	 */
	public removePlugin(pluginId: string): void {
		this.update((state) => ({
			pendingPlugins: state.pendingPlugins.filter((p) => p.plugin.id !== pluginId)
		}));
	}

	/**
	 * Enables or disables force install mode
	 */
	public setForceInstallEnabled(enabled: boolean): void {
		this.update({ forceInstallEnabled: enabled });
	}

	/**
	 * Gets plugins that can be auto-installed
	 */
	public getAutoInstallablePlugins(): IPendingPluginInstallation[] {
		return this.getValue().pendingPlugins.filter((p) => p.canAutoInstall === true);
	}

	/**
	 * Gets mandatory plugins that must be installed
	 */
	public getMandatoryPlugins(): IPendingPluginInstallation[] {
		return this.getValue().pendingPlugins.filter((p) => p.isMandatory === true);
	}

	/**
	 * Resets the store state
	 */
	public resetState(): void {
		this.update(createInitialPendingInstallationState());
	}
}
