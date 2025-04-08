import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { ID, IPluginVersion } from '@gauzy/contracts';
import { IPluginVersionState, PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginVersionQuery extends Query<IPluginVersionState> {
	public readonly versions$: Observable<IPluginVersion[]> = this.select((state) => state.versions);
	public readonly version$: Observable<IPluginVersion> = this.select((state) => state.version);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly updating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly restoring$: Observable<boolean> = this.select((state) => state.restoring);
	public readonly creating$: Observable<boolean> = this.select((state) => state.creating);
	public readonly pluginId$: Observable<ID> = this.select((state) => state.pluginId);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(readonly pluginVersionStore: PluginVersionStore) {
		super(pluginVersionStore);
	}

	public get version(): IPluginVersion {
		return this.getValue().version;
	}

	public get versions(): IPluginVersion[] {
		return this.getValue().versions || [];
	}

	public get count(): number {
		return this.getValue().count;
	}

	public get pluginId(): ID {
		return this.getValue().pluginId;
	}
}
