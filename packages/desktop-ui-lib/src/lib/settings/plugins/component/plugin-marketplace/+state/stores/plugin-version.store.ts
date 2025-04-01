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
}
