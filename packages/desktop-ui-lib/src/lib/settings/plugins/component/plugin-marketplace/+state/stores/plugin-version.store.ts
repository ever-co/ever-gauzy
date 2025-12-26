import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IPluginVersion } from '@gauzy/contracts';

export interface IPluginVersionState {
	creating: Record<string, boolean>;
	updating: Record<string, boolean>;
	deleting: Record<string, boolean>;
	restoring: Record<string, boolean>;
	versions: IPluginVersion[];
	version: IPluginVersion;
	pluginId: ID;
	count: number;
}

export function createInitialPluginVersionState(): IPluginVersionState {
	return {
		creating: {},
		updating: {},
		deleting: {},
		restoring: {},
		versions: [],
		version: null,
		pluginId: null,
		count: 0
	};
}

@StoreConfig({ name: '_plugin_versions' })
@Injectable({ providedIn: 'root' })
export class PluginVersionStore extends Store<IPluginVersionState> {
	constructor() {
		super(createInitialPluginVersionState());
	}

	// Loading states
	public setCreating(pluginId: string, creating: boolean): void {
		this.update((state) => ({
			creating: {
				...state.creating,
				[pluginId]: creating
			}
		}));
	}

	public setUpdating(pluginId: string, updating: boolean): void {
		this.update((state) => ({
			updating: {
				...state.updating,
				[pluginId]: updating
			}
		}));
	}

	public setDeleting(pluginId: string, deleting: boolean): void {
		this.update((state) => ({
			deleting: {
				...state.deleting,
				[pluginId]: deleting
			}
		}));
	}

	public setRestoring(pluginId: string, restoring: boolean): void {
		this.update((state) => ({
			restoring: {
				...state.restoring,
				[pluginId]: restoring
			}
		}));
	}

	// Version management
	public setVersions(versions: IPluginVersion[], count?: number): void {
		this.update((state) => ({
			versions: [...new Map([...state.versions, ...versions].map((item) => [item.id, item])).values()],
			version: state.version ?? state.versions[0] ?? versions[0],
			count: count ?? versions.length
		}));
	}

	public addVersion(version: IPluginVersion): void {
		this.update((state) => ({
			versions: [...state.versions, version],
			count: state.count + 1
		}));
	}

	public updateVersion(versionId: ID, updates: Partial<IPluginVersion>): void {
		this.update((state) => ({
			versions: state.versions.map((v) => (v.id === versionId ? { ...v, ...updates } : v)),
			version: state.version?.id === versionId ? { ...state.version, ...updates } : state.version
		}));
	}

	public removeVersion(versionId: ID): void {
		this.update((state) => ({
			versions: state.versions.filter((v) => v.id !== versionId),
			count: state.count - 1,
			version: state.version?.id === versionId ? null : state.version
		}));
	}

	// Selection
	public selectVersion(version: IPluginVersion | null): void {
		this.update({ version });
	}

	// Context management
	public setPluginId(pluginId: ID): void {
		this.update({ pluginId });
	}

	// Reset
	public reset(): void {
		this.update({ versions: [], version: null });
	}
}
