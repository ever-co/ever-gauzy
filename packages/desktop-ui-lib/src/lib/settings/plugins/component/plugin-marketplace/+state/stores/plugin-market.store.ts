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
	// Loading states
	loading: boolean;
	updating: boolean;
	deleting: boolean;

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

	// Upload state
	upload: {
		uploading: boolean;
		progress: number;
	};

	// UI state
	ui: {
		showAdvancedFilters: boolean;
		collapsedFilters: boolean;
		selectedView: 'grid' | 'list';
	};

	// Error handling
	error: string | null;
}

export function createInitialMarketplaceState(): IPluginMarketplaceState {
	return {
		loading: false,
		updating: false,
		deleting: false,
		plugins: [],
		plugin: null,
		count: 0,
		totalCount: 0,
		filteredCount: 0,
		filters: {},
		appliedFilters: {},
		searchQuery: '',
		tags: [],
		upload: {
			uploading: false,
			progress: 0
		},
		ui: {
			showAdvancedFilters: false,
			collapsedFilters: false,
			selectedView: 'grid'
		},
		error: null
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

	// Loading states
	public setLoading(loading: boolean): void {
		this.update({ loading });
	}

	public setUpdating(updating: boolean): void {
		this.update({ updating });
	}

	public setDeleting(deleting: boolean): void {
		this.update({ deleting });
	}

	// Error handling
	public setErrorMessage(error: string | null): void {
		this.update({ error });
	}

	public clearError(): void {
		this.update({ error: null });
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
		this.update(createInitialMarketplaceState());
	}
}
