import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime, distinctUntilChanged, map, tap } from 'rxjs';
import { Store } from '../../../../services';
import { PluginMarketplaceActions } from './+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from './+state/queries/plugin-marketplace.query';
import { IPluginFilter, PluginMarketplaceStore } from './+state/stores/plugin-market.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrls: ['./plugin-marketplace.component.scss'],
	standalone: false
})
export class PluginMarketplaceComponent implements OnInit, OnDestroy {
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;
	public isMobile = false;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly action: Actions,
		private readonly marketplaceStore: PluginMarketplaceStore,
		public readonly query: PluginMarketplaceQuery,
		public readonly store: Store
	) {
		this.checkIsMobile();
	}

	@HostListener('window:resize', ['$event'])
	onResize(event: any): void {
		this.checkIsMobile();
	}

	ngOnInit(): void {
		// Subscribe to plugin count changes
		this.query
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();

		// Subscribe to filter changes and apply them
		combineLatest([this.query.filters$, this.query.appliedFilters$])
			.pipe(
				debounceTime(300),
				distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
				tap(([filters, appliedFilters]) => {
					// Only reload if filters have actually changed from applied filters
					if (JSON.stringify(filters) !== JSON.stringify(appliedFilters)) {
						this.applyFiltersAndReload();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.load();
	}

	private checkIsMobile(): void {
		this.isMobile = window.innerWidth <= 768;
		this.marketplaceStore.updateUI({ collapsedFilters: this.isMobile });
	}

	public load(): void {
		const filters = this.query.appliedFilters;
		const params = this.buildQueryParams(filters);
		this.action.dispatch(
			PluginMarketplaceActions.getAll({
				...params,
				skip: this.skip,
				take: this.take,
				relations: ['versions', 'versions.sources', 'uploadedBy', 'subscriptions', 'subscriptions.plan'],
				order: this.buildOrderParams(filters)
			})
		);
	}

	public loadMore(): void {
		if (this.hasNext) {
			this.skip++;
			this.load();
		}
	}

	private buildQueryParams(filters: IPluginFilter): any {
		const params: any = {};

		// Search filter
		if (filters.search) {
			params.search = filters.search;
		}

		// Status filter
		if (filters.status?.length) {
			params.status = filters.status;
		}

		// Type filter
		if (filters.types?.length) {
			params.type = filters.types;
		}

		// Author filter
		if (filters.author) {
			params.author = filters.author;
		}

		// License filter
		if (filters.license?.length) {
			params.license = filters.license;
		}

		// Minimum downloads filter
		if (filters.minDownloads) {
			params.minDownloads = filters.minDownloads;
		}

		// Date range filter
		if (filters.dateRange?.from || filters.dateRange?.to) {
			params.dateRange = filters.dateRange;
		}

		// Featured filter
		if (filters.featured) {
			params.featured = true;
		}

		// Verified filter
		if (filters.verified) {
			params.verified = true;
		}

		return params;
	}

	private buildOrderParams(filters: IPluginFilter): any {
		const sortBy = filters.sortBy || 'createdAt';
		const sortDirection = filters.sortDirection || 'desc';

		return {
			[sortBy]: sortDirection.toUpperCase()
		};
	}

	private applyFiltersAndReload(): void {
		// Apply current filters
		this.action.dispatch(PluginMarketplaceActions.applyFilters());

		// Reset pagination and reload
		this.skip = 1;
		this.hasNext = false;

		// Clear current plugins and reload with new filters
		this.marketplaceStore.update((state) => ({
			...state,
			plugins: [],
			count: 0
		}));

		this.load();
	}

	// Filter event handlers
	public onFilterChange(filters: IPluginFilter): void {
		this.action.dispatch(PluginMarketplaceActions.setFilters(filters));
	}

	public onClearFilters(): void {
		this.action.dispatch(PluginMarketplaceActions.clearFilters());
	}

	public onToggleAdvancedFilters(show: boolean): void {
		this.action.dispatch(PluginMarketplaceActions.toggleAdvancedFilters(show));
	}

	// View mode handlers
	public setViewMode(view: 'grid' | 'list'): void {
		this.action.dispatch(PluginMarketplaceActions.setViewMode(view));
	}

	public toggleAdvancedFilters(): void {
		const current = this.query.showAdvancedFilters;
		this.action.dispatch(PluginMarketplaceActions.toggleAdvancedFilters(!current));
	}

	public get isUploadAvailable(): boolean {
		return !!this.route.snapshot.data['isUploadAvailable'];
	}

	public upload(): void {
		this.action.dispatch(PluginMarketplaceActions.upload());
	}

	ngOnDestroy(): void {
		this.skip = 1;
		this.hasNext = false;
		this.action.dispatch(PluginMarketplaceActions.reset());
	}
}
