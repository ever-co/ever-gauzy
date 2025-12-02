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

	/** Sets the toggle state for a specific plugin */
	public setToggle(pluginId: ID, enabled: boolean): void {
		this.upsert(pluginId, { pluginId, enabled });
	}

	/** Toggles the current state for a specific plugin */
	public setAutoToggle(pluginId: ID): void {
		const current = this.getValue().entities[pluginId];
		const enabled = !current?.enabled;
		this.update(pluginId, { enabled });
	}
}
