import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';

import { IPlugin } from '@gauzy/contracts';
import { IPluginFilter, IPluginMarketplaceState, PluginMarketplaceStore } from '../stores/plugin-market.store';

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceQuery extends Query<IPluginMarketplaceState> {
	public readonly plugins$: Observable<IPlugin[]> = this.select((state) => state.plugins);
	public readonly plugin$: Observable<IPlugin> = this.select((state) => state.plugin);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly totalCount$: Observable<number> = this.select((state) => state.totalCount);
	public readonly filteredCount$: Observable<number> = this.select((state) => state.filteredCount);
	public readonly filters$: Observable<IPluginFilter> = this.select((state) => state.filters);
	public readonly appliedFilters$: Observable<IPluginFilter> = this.select((state) => state.appliedFilters);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly updating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly uploading$: Observable<boolean> = this.select((state) => state.upload.uploading);
	public readonly progress$: Observable<number> = this.select((state) => state.upload.progress);

	// UI state
	public readonly showAdvancedFilters$: Observable<boolean> = this.select((state) => state.ui.showAdvancedFilters);
	public readonly collapsedFilters$: Observable<boolean> = this.select((state) => state.ui.collapsedFilters);
	public readonly selectedView$: Observable<'grid' | 'list'> = this.select((state) => state.ui.selectedView);

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

	public get totalCount(): number {
		return this.getValue().totalCount;
	}

	public get filteredCount(): number {
		return this.getValue().filteredCount;
	}

	public get filters(): IPluginFilter {
		return this.getValue().filters;
	}

	public get appliedFilters(): IPluginFilter {
		return this.getValue().appliedFilters;
	}

	public get showAdvancedFilters(): boolean {
		return this.getValue().ui.showAdvancedFilters;
	}

	public get selectedView(): 'grid' | 'list' {
		return this.getValue().ui.selectedView;
	}
}
