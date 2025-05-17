import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IPluginSource } from '@gauzy/contracts';

export interface IPluginSourceState {
	sources: IPluginSource[];
	source: IPluginSource;
	pluginId: ID;
	versionId: ID;
	count: number;
}

export function createInitialPluginSourceState(): IPluginSourceState {
	return {
		sources: [],
		source: null,
		pluginId: null,
		versionId: null,
		count: 0
	};
}

@StoreConfig({ name: '_plugin_sources' })
@Injectable({ providedIn: 'root' })
export class PluginSourceStore extends Store<IPluginSourceState> {
	constructor() {
		super(createInitialPluginSourceState());
	}
}
