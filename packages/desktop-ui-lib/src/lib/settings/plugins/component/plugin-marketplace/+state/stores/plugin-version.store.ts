import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IPluginVersion } from '@gauzy/contracts';

export interface IPluginVersionState {
	creating: boolean;
	updating: boolean;
	deleting: boolean;
	restoring: boolean;
	versions: IPluginVersion[];
	version: IPluginVersion;
	pluginId: ID;
	count: number;
}

export function createInitialPluginVersionState(): IPluginVersionState {
	return {
		creating: false,
		updating: false,
		deleting: false,
		restoring: false,
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
	public setCreating(creating: boolean): void {
		this.update({ creating });
	}

	public setUpdating(updating: boolean): void {
		this.update({ updating });
	}

	public setDeleting(deleting: boolean): void {
		this.update({ deleting });
	}

	public setRestoring(restoring: boolean): void {
		this.update({ restoring });
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
