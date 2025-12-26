import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { ID } from '@gauzy/contracts';
import { map, Observable } from 'rxjs';
import { IPluginToggleState, PluginToggleState, PluginToggleStore } from '../stores/plugin-toggle.store';

@Injectable({ providedIn: 'root' })
export class PluginToggleQuery extends QueryEntity<PluginToggleState, IPluginToggleState> {
	constructor(readonly pluginToggleStore: PluginToggleStore) {
		super(pluginToggleStore);
	}

	/**
	 * Select a single toggle O(1)
	 */
	private selectById(pluginId: ID) {
		return this.selectEntity(pluginId);
	}

	/**
	 * Direct synchronous getter O(1)
	 */
	private getById(pluginId: ID) {
		return this.getEntity(pluginId);
	}

	/**
	 * Synchronous isEnabled check
	 * @param pluginId
	 * @returns
	 */
	public isEnabled(pluginId: ID): boolean {
		return this.getById(pluginId)?.enabled ?? false;
	}

	/**
	 * Observable isEnabled check
	 * @param pluginId
	 * @returns
	 */
	public isEnabled$(pluginId: ID): Observable<boolean> {
		return this.selectById(pluginId).pipe(map((toggle) => toggle?.enabled ?? false));
	}
}
