import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin, PluginStatus, PluginType } from '@gauzy/contracts';

// Filter interfaces
export interface IPluginFilter {
	search?: string;
	categories?: string[];
	status?: PluginStatus[];
	types?: PluginType[];
	tags?: string[];
	priceRange?: { min: number; max: number };
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
	author?: string;
	license?: string[];
	minDownloads?: number;
	dateRange?: { from?: Date; to?: Date };
	featured?: boolean;
	verified?: boolean;
}

export interface IPluginMarketplaceState {
	updating: boolean;
	deleting: boolean;
	loading: boolean;
	plugins: IPlugin[];
	plugin: IPlugin;
	count: number;
	totalCount: number;
	filteredCount: number;
	filters: IPluginFilter;
	appliedFilters: IPluginFilter;
	searchQuery: string;
	installingPlugins: { [pluginId: string]: boolean };
	subscriptionPlans: { [pluginId: string]: any[] };
	subscriptions: { [pluginId: string]: any };
	tags: any[];
	pluginSettings: { [pluginId: string]: any };
	pluginAnalytics: { [pluginId: string]: any };
	pluginSecurity: { [pluginId: string]: any };
	upload: {
		uploading: boolean;
		progress: number;
	};
	ui: {
		showAdvancedFilters: boolean;
		collapsedFilters: boolean;
		selectedView: 'grid' | 'list';
	};
}

export function createInitialMarketplaceState(): IPluginMarketplaceState {
	return {
		updating: false,
		deleting: false,
		loading: false,
		plugins: [],
		plugin: null,
		count: 0,
		totalCount: 0,
		filteredCount: 0,
		filters: {},
		appliedFilters: {},
		searchQuery: '',
		installingPlugins: {},
		subscriptionPlans: {},
		subscriptions: {},
		tags: [],
		pluginSettings: {},
		pluginAnalytics: {},
		pluginSecurity: {},
		upload: {
			uploading: false,
			progress: 0
		},
		ui: {
			showAdvancedFilters: false,
			collapsedFilters: false,
			selectedView: 'grid'
		}
	};
}

@StoreConfig({ name: '_marketplace_plugins' })
@Injectable({ providedIn: 'root' })
export class PluginMarketplaceStore extends Store<IPluginMarketplaceState> {
	constructor() {
		super(createInitialMarketplaceState());
	}

	public setUpload(action: Partial<IPluginMarketplaceState['upload']>): void {
		this.update((state) => ({
			...state,
			upload: {
				...state.upload,
				...action
			}
		}));
	}

	public setFilters(filters: IPluginFilter): void {
		this.update((state) => ({
			...state,
			filters: { ...filters }
		}));
	}

	public applyFilters(): void {
		this.update((state) => ({
			...state,
			appliedFilters: { ...state.filters }
		}));
	}

	public setFilteredCount(count: number): void {
		this.update((state) => ({
			...state,
			filteredCount: count
		}));
	}

	public setTotalCount(count: number): void {
		this.update((state) => ({
			...state,
			totalCount: count
		}));
	}

	public updateUI(ui: Partial<IPluginMarketplaceState['ui']>): void {
		this.update((state) => ({
			...state,
			ui: {
				...state.ui,
				...ui
			}
		}));
	}

	public clearFilters(): void {
		this.update((state) => ({
			...state,
			filters: {},
			appliedFilters: {}
		}));
	}

	public setLoading(loading: boolean): void {
		this.update({ loading });
	}

	public setInstalling(pluginId: string, installing: boolean): void {
		this.update((state) => ({
			...state,
			installingPlugins: {
				...state.installingPlugins,
				[pluginId]: installing
			}
		}));
	}

	public setSubscriptionPlans(pluginId: string, plans: any[]): void {
		this.update((state) => ({
			...state,
			subscriptionPlans: {
				...state.subscriptionPlans,
				[pluginId]: plans
			}
		}));
	}

	public setSubscription(pluginId: string, subscription: any): void {
		this.update((state) => ({
			...state,
			subscriptions: {
				...state.subscriptions,
				[pluginId]: subscription
			}
		}));
	}

	public setTags(tags: any[]): void {
		this.update({ tags });
	}

	public addTag(tag: any): void {
		this.update((state) => ({
			...state,
			tags: [...state.tags, tag]
		}));
	}

	public setPluginSettings(pluginId: string, settings: any): void {
		this.update((state) => ({
			...state,
			pluginSettings: {
				...state.pluginSettings,
				[pluginId]: settings
			}
		}));
	}

	public updatePluginSetting(pluginId: string, setting: any): void {
		this.update((state) => ({
			...state,
			pluginSettings: {
				...state.pluginSettings,
				[pluginId]: {
					...state.pluginSettings[pluginId],
					...setting
				}
			}
		}));
	}

	public setPluginAnalytics(pluginId: string, analytics: any): void {
		this.update((state) => ({
			...state,
			pluginAnalytics: {
				...state.pluginAnalytics,
				[pluginId]: analytics
			}
		}));
	}

	public setPluginSecurity(pluginId: string, security: any): void {
		this.update((state) => ({
			...state,
			pluginSecurity: {
				...state.pluginSecurity,
				[pluginId]: security
			}
		}));
	}

	public updatePluginRating(pluginId: string, ratingData: any): void {
		this.update((state) => ({
			...state,
			plugins: state.plugins.map((plugin) =>
				plugin.id === pluginId ? { ...plugin, rating: ratingData } : plugin
			),
			plugin: state.plugin?.id === pluginId ? { ...state.plugin, rating: ratingData } : state.plugin
		}));
	}
}
