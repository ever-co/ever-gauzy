import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { ID, IPluginSource } from '@gauzy/contracts';
import { IPluginSourceState, PluginSourceStore } from '../stores/plugin-source.store';

@Injectable({ providedIn: 'root' })
export class PluginSourceQuery extends Query<IPluginSourceState> {
	public readonly sources$: Observable<IPluginSource[]> = this.select((state) => state.sources);
	public readonly source$: Observable<IPluginSource> = this.select((state) => state.source);
	public readonly versionId$: Observable<ID> = this.select((state) => state.versionId);
	public readonly pluginId$: Observable<ID> = this.select((state) => state.pluginId);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly updating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly restoring$: Observable<boolean> = this.select((state) => state.restoring);
	public readonly creating$: Observable<boolean> = this.select((state) => state.creating);

	constructor(readonly pluginSourceStore: PluginSourceStore) {
		super(pluginSourceStore);
	}

	public get source(): IPluginSource {
		return this.getValue().source;
	}

	public get sources(): IPluginSource[] {
		return this.getValue().sources || [];
	}

	public get count(): number {
		return this.getValue().count;
	}

	public get pluginId(): ID {
		return this.getValue().pluginId;
	}

	public get versionId(): ID {
		return this.getValue().versionId;
	}
}
