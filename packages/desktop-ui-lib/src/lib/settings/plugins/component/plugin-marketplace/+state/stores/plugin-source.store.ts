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
}
