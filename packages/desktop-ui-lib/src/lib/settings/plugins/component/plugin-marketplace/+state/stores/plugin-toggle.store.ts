import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { ID } from '@gauzy/contracts';

export interface IPluginToggleState {
	pluginId: ID;
	enabled: boolean;
}

export interface PluginToggleState extends EntityState<IPluginToggleState, ID> {}

@StoreConfig({ name: '_plugin_toggles', idKey: 'pluginId' })
@Injectable({ providedIn: 'root' })
export class PluginToggleStore extends EntityStore<PluginToggleState, IPluginToggleState> {
	constructor() {
		super();
	}

	public setToggle(pluginId: ID, enabled: boolean): void {
		this.upsert(pluginId, { pluginId, enabled });
	}
}
