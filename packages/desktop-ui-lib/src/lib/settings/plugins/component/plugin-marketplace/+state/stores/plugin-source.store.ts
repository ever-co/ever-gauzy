import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IPluginSource } from '@gauzy/contracts';

export interface IPluginSourceState {
	sources: IPluginSource[];
	source: IPluginSource;
	pluginId: ID;
	versionId: ID;
	count: number;
	creating: boolean;
	updating: boolean;
	deleting: boolean;
	restoring: boolean;
}

export function createInitialPluginSourceState(): IPluginSourceState {
	return {
		sources: [],
		source: null,
		pluginId: null,
		versionId: null,
		creating: false,
		updating: false,
		deleting: false,
		restoring: false,
		count: 0
	};
}

@StoreConfig({ name: '_plugin_sources' })
@Injectable({ providedIn: 'root' })
export class PluginSourceStore extends Store<IPluginSourceState> {
	constructor() {
		super(createInitialPluginSourceState());
	}

	// Loading states
	public setLoading(loading: boolean): void {
		this.setLoading(loading);
	}

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

	// Source management
	public setSources(sources: IPluginSource[], count?: number): void {
		this.update({
			sources,
			count: count ?? sources.length
		});
	}

	public addSource(source: IPluginSource): void {
		this.update((state) => ({
			sources: [...state.sources, source],
			count: state.count + 1
		}));
	}

	public updateSource(sourceId: ID, updates: Partial<IPluginSource>): void {
		this.update((state) => ({
			sources: state.sources.map((s) => (s.id === sourceId ? { ...s, ...updates } : s)),
			source: state.source?.id === sourceId ? { ...state.source, ...updates } : state.source
		}));
	}

	public removeSource(sourceId: ID): void {
		this.update((state) => ({
			sources: state.sources.filter((s) => s.id !== sourceId),
			count: state.count - 1,
			source: state.source?.id === sourceId ? null : state.source
		}));
	}

	// Selection
	public selectSource(source: IPluginSource | null): void {
		this.update({ source });
	}

	// Context management
	public setPluginVersion(pluginId: ID, versionId: ID): void {
		this.update({ pluginId, versionId });
	}

	// Reset
	public reset(): void {
		this.update(createInitialPluginSourceState());
	}
}
