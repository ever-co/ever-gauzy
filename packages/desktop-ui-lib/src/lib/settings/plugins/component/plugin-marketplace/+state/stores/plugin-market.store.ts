import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPlugin, IPluginSubscription, PluginStatus, PluginType } from '@gauzy/contracts';

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
	// Loading states
	loading: boolean;
	updating: Record<string, boolean>; // per plugin ID
	deleting: Record<string, boolean>; // per plugin ID

	// Plugin data
	plugins: IPlugin[];
	plugin: IPlugin | null;
	count: number;
	totalCount: number;
	filteredCount: number;

	// Filtering & search
	filters: IPluginFilter;
	appliedFilters: IPluginFilter;
	searchQuery: string;

	// Tags (marketplace-specific metadata)
	tags: any[];

	// Upload state (per plugin ID for updates)
	upload: Record<
		string,
		{
			uploading: boolean;
			progress: number;
		}
	>;

	// UI state
	ui: {
		showAdvancedFilters: boolean;
		collapsedFilters: boolean;
		selectedView: 'grid' | 'list';
	};

	// Error handling (per plugin ID)
	error: Record<string, string>;
}

export function createInitialMarketplaceState(): IPluginMarketplaceState {
	return {
		loading: false,
		updating: {},
		deleting: {},
		plugins: [],
		plugin: null,
		count: 0,
		totalCount: 0,
		filteredCount: 0,
		filters: {},
		appliedFilters: {},
		searchQuery: '',
		tags: [],
		upload: {},
		ui: {
			showAdvancedFilters: false,
			collapsedFilters: false,
			selectedView: 'grid'
		},
		error: {}
	};
}

@StoreConfig({ name: '_marketplace_plugins' })
@Injectable({ providedIn: 'root' })
export class PluginMarketplaceStore extends Store<IPluginMarketplaceState> {
	constructor() {
		super(createInitialMarketplaceState());
	}

	public setUpload(pluginId: string = 'default', action: { uploading: boolean; progress: number }): void {
		this.update((state) => ({
			...state,
			upload: {
				...state.upload,
				[pluginId]: action
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

	// Loading states
	public setLoading(loading: boolean): void {
		this.update({ loading });
	}

	public setUpdating(pluginId: string, updating: boolean): void {
		this.update((state) => ({
			updating: {
				...state.updating,
				[pluginId]: updating
			}
		}));
	}

	public setDeleting(pluginId: string, deleting: boolean): void {
		this.update((state) => ({
			deleting: {
				...state.deleting,
				[pluginId]: deleting
			}
		}));
	}

	// Error handling
	public setErrorMessage(pluginId: string, error: string | null): void {
		this.update((state) => ({
			error: {
				...state.error,
				[pluginId]: error
			}
		}));
	}

	public clearError(pluginId?: string): void {
		if (pluginId) {
			this.update((state) => {
				const { [pluginId]: removed, ...remaining } = state.error;
				return { error: remaining };
			});
		} else {
			this.update({ error: {} });
		}
	}

	// Plugin management
	public setPlugins(plugins: IPlugin[], count?: number): void {
		this.update({
			plugins,
			count: count ?? plugins.length
		});
	}

	public appendPlugins(plugins: IPlugin[]): void {
		this.update((state) => ({
			plugins: [...state.plugins, ...plugins],
			count: state.count + plugins.length
		}));
	}

	public selectPlugin(plugin: IPlugin | null): void {
		this.update({ plugin });
	}

	public setSubscription(subscription: IPluginSubscription): void {
		this.update((state) => ({
			plugin:
				state.plugin && state.plugin.id === subscription.pluginId
					? { ...state.plugin, subscriptions: [subscription] }
					: state.plugin,
			plugins: state.plugins.map((p) =>
				p.id === subscription.pluginId ? { ...p, subscriptions: [subscription] } : p
			)
		}));
	}

	public updatePlugin(pluginId: string, updates: Partial<IPlugin>): void {
		this.update((state) => ({
			plugins: state.plugins.map((p) => (p.id === pluginId ? { ...p, ...updates } : p)),
			plugin: state.plugin?.id === pluginId ? { ...state.plugin, ...updates } : state.plugin
		}));
	}

	public updatePluginRating(pluginId: string, ratingData: any): void {
		this.update((state) => ({
			plugins: state.plugins.map((plugin) =>
				plugin.id === pluginId ? { ...plugin, rating: ratingData } : plugin
			),
			plugin: state.plugin?.id === pluginId ? { ...state.plugin, rating: ratingData } : state.plugin
		}));
	}

	// Tags management
	public setTags(tags: any[]): void {
		this.update({ tags });
	}

	public addTag(tag: any): void {
		this.update((state) => ({
			tags: [...state.tags, tag]
		}));
	}

	public removeTag(tagId: string): void {
		this.update((state) => ({
			tags: state.tags.filter((t) => t.id !== tagId)
		}));
	}

	// Reset
	public reset(): void {
		this.update({ plugins: [] });
	}
}
