import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { IPluginFilter } from '../+state/stores/plugin-market.store';

/**
 * Strategy Pattern: Define a family of filter algorithms
 * Each strategy encapsulates a specific filtering logic
 */
export interface IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[];
}

/**
 * Search Filter Strategy
 */
export class SearchFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.search) return plugins;

		const searchLower = filter.search.toLowerCase();
		return plugins.filter(
			(plugin) =>
				plugin.name?.toLowerCase().includes(searchLower) ||
				plugin.description?.toLowerCase().includes(searchLower) ||
				plugin.author?.toLowerCase().includes(searchLower)
		);
	}
}

/**
 * Category Filter Strategy
 */
export class CategoryFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.categories?.length) return plugins;

		return plugins.filter((plugin) => plugin.category?.id && filter.categories!.includes(plugin.category.id));
	}
}

/**
 * Status Filter Strategy
 */
export class StatusFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.status?.length) return plugins;

		return plugins.filter((plugin) => filter.status!.includes(plugin.status));
	}
}

/**
 * Type Filter Strategy
 */
export class TypeFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.types?.length) return plugins;

		return plugins.filter((plugin) => filter.types!.includes(plugin.type));
	}
}

/**
 * Author Filter Strategy
 */
export class AuthorFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.author) return plugins;

		return plugins.filter((plugin) => plugin.author?.toLowerCase() === filter.author!.toLowerCase());
	}
}

/**
 * License Filter Strategy
 */
export class LicenseFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.license?.length) return plugins;

		return plugins.filter((plugin) => plugin.license && filter.license!.includes(plugin.license));
	}
}

/**
 * Downloads Filter Strategy
 */
export class DownloadsFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.minDownloads) return plugins;

		return plugins.filter((plugin) => (plugin.downloadCount || 0) >= filter.minDownloads!);
	}
}

/**
 * Featured Filter Strategy
 */
export class FeaturedFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.featured) return plugins;

		return plugins.filter((plugin) => (plugin as any).isFeatured === true || (plugin as any).featured === true);
	}
}

/**
 * Verified Filter Strategy
 */
export class VerifiedFilterStrategy implements IFilterStrategy {
	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		if (!filter.verified) return plugins;

		return plugins.filter((plugin) => (plugin as any).isVerified === true || (plugin as any).verified === true);
	}
}

/**
 * Composite Filter Strategy
 * Combines multiple filter strategies
 */
export class CompositeFilterStrategy implements IFilterStrategy {
	constructor(private strategies: IFilterStrategy[]) {}

	apply(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		return this.strategies.reduce((filtered, strategy) => strategy.apply(filtered, filter), plugins);
	}
}

/**
 * Filter Strategy Service
 * Manages and applies filter strategies using the Strategy Pattern
 */
@Injectable({
	providedIn: 'root'
})
export class FilterStrategyService {
	private readonly strategies: IFilterStrategy[] = [
		new SearchFilterStrategy(),
		new CategoryFilterStrategy(),
		new StatusFilterStrategy(),
		new TypeFilterStrategy(),
		new AuthorFilterStrategy(),
		new LicenseFilterStrategy(),
		new DownloadsFilterStrategy(),
		new FeaturedFilterStrategy(),
		new VerifiedFilterStrategy()
	];

	private readonly compositeStrategy = new CompositeFilterStrategy(this.strategies);

	/**
	 * Apply all filter strategies to plugins
	 */
	public applyFilters(plugins: IPlugin[], filter: IPluginFilter): IPlugin[] {
		return this.compositeStrategy.apply(plugins, filter);
	}

	/**
	 * Apply a specific filter strategy
	 */
	public applyStrategy(plugins: IPlugin[], filter: IPluginFilter, strategy: IFilterStrategy): IPlugin[] {
		return strategy.apply(plugins, filter);
	}

	/**
	 * Count filtered results
	 */
	public countFiltered(plugins: IPlugin[], filter: IPluginFilter): number {
		return this.applyFilters(plugins, filter).length;
	}

	/**
	 * Check if filters are active (excluding sort options)
	 */
	public hasActiveFilters(filter: IPluginFilter): boolean {
		return Object.entries(filter).some(([key, value]) => {
			if (key === 'sortBy' || key === 'sortDirection') return false;
			return (
				value !== undefined &&
				value !== null &&
				value !== '' &&
				(Array.isArray(value) ? value.length > 0 : true)
			);
		});
	}

	/**
	 * Count active filters
	 */
	public countActiveFilters(filter: IPluginFilter): number {
		let count = 0;

		if (filter.search) count++;
		if (filter.categories?.length) count++;
		if (filter.status?.length) count++;
		if (filter.types?.length) count++;
		if (filter.tags?.length) count++;
		if (filter.priceRange) count++;
		if (filter.author) count++;
		if (filter.license?.length) count++;
		if (filter.minDownloads) count++;
		if (filter.dateRange) count++;
		if (filter.featured) count++;
		if (filter.verified) count++;

		return count;
	}
}
