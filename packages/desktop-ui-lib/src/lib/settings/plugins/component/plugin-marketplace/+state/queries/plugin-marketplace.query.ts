import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { IPluginMarketplaceState, PluginMarketplaceStore } from '../stores/plugin-market.store';
import { IPlugin } from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceQuery extends Query<IPluginMarketplaceState> {
	public readonly plugins$: Observable<IPlugin[]> = this.select((state) => state.plugins);
	public readonly plugin$: Observable<IPlugin> = this.select((state) => state.plugin);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly updating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly uploading$: Observable<boolean> = this.select((state) => state.upload.uploading);
	public readonly progress$: Observable<number> = this.select((state) => state.upload.progress);

	public readonly isLoading$: Observable<boolean> = this.selectLoading();

	constructor(readonly pluginMarketplaceStore: PluginMarketplaceStore) {
		super(pluginMarketplaceStore);
	}

	public get plugin(): IPlugin {
		return this.getValue().plugin;
	}

	public get plugins(): IPlugin[] {
		return this.getValue().plugins || [];
	}

	public get count(): number {
		return this.getValue().count;
	}
}
