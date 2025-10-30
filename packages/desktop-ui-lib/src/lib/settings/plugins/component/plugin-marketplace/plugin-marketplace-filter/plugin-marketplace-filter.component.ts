import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IPlugin, ITag, PluginStatus, PluginType } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, debounceTime, distinctUntilChanged, map, startWith } from 'rxjs';
import { PluginCategoryActions, PluginCategoryQuery } from '../+state';
import { IPluginFilter } from '../+state/stores/plugin-market.store';

interface IPriceRange {
	min: number;
	max: number;
}

interface IDateRange {
	from?: Date;
	to?: Date;
}

interface ICategoryOption {
	value: string;
	label: string;
	icon: string;
	count?: number;
}

interface IFilterSection {
	id: string;
	label: string;
	icon: string;
	expanded: boolean;
	visible: boolean;
}

enum PluginSortOption {
	NAME = 'name',
	DOWNLOADS = 'downloadCount',
	UPLOAD_DATE = 'uploadedAt',
	LAST_UPDATED = 'updatedAt',
	RATING = 'rating',
	AUTHOR = 'author',
	STATUS = 'status'
}

enum PluginPriceCategory {
	FREE = 'free',
	FREEMIUM = 'freemium',
	PAID = 'paid',
	ENTERPRISE = 'enterprise'
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-marketplace-filter',
	templateUrl: './plugin-marketplace-filter.component.html',
	styleUrls: ['./plugin-marketplace-filter.component.scss'],
	standalone: false
})
export class PluginMarketplaceFilterComponent implements OnInit, OnChanges, OnDestroy {
	@Input() plugins: IPlugin[] = [];
	@Input() availableTags: ITag[] = [];
	@Input() isLoading: boolean = false;
	@Input() totalCount: number = 0;
	@Input() showAdvanced: boolean = false;
	@Input() isMobile: boolean = false;

	@Output() filterChange = new EventEmitter<IPluginFilter>();
	@Output() clearFilters = new EventEmitter<void>();
	@Output() toggleAdvanced = new EventEmitter<boolean>();

	// Form and state
	public filterForm: FormGroup;
	public isCollapsed$ = new BehaviorSubject<boolean>(false);
	public activeFiltersCount$ = new BehaviorSubject<number>(0);
	public filterSections: IFilterSection[] = [];

	// Filter options
	public categoryOptions: ICategoryOption[] = [];
	public hasCategoriesLoaded: boolean = false;
	public isCategoriesLoading: boolean = false;
	public statusOptions = Object.values(PluginStatus);
	public typeOptions = Object.values(PluginType);
	public sortOptions = Object.values(PluginSortOption);
	public priceCategories = Object.values(PluginPriceCategory);
	public licenseOptions: string[] = [];
	public authorOptions: string[] = [];

	// Computed observables
	public filteredPluginsCount$: Observable<number>;
	public hasActiveFilters$: Observable<boolean>;
	public searchSuggestions$: Observable<string[]>;

	// Enums for template access
	public PluginSortOption = PluginSortOption;
	public PluginStatus = PluginStatus;
	public PluginType = PluginType;
	public PluginPriceCategory = PluginPriceCategory;

	constructor(private readonly formBuilder: FormBuilder, private readonly pluginCategoryQuery: PluginCategoryQuery) {
		this.initializeForm();
		this.setupFilterSections();
		this.setupComputedObservables();
	}

	ngOnInit(): void {
		this.setupFormSubscriptions();
		this.loadFilterOptions();
		this.loadCategoriesFromBackend();

		// Collapse filters by default on mobile for better initial fit
		if (this.isMobile) {
			this.isCollapsed$.next(true);
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['isMobile'] && !changes['isMobile'].firstChange) {
			const mobile = changes['isMobile'].currentValue as boolean;
			// Auto-collapse when switching to mobile; keep current state when going back to desktop
			if (mobile) {
				this.isCollapsed$.next(true);
			}
		}

		// Update advanced section visibility when showAdvanced input changes
		if (changes['showAdvanced']) {
			this.updateFilterSectionVisibility();
		}

		// Update filter options when plugins change
		if (changes['plugins'] && !changes['plugins'].firstChange) {
			this.loadFilterOptions();
			// Update category counts with new plugin data
			if (this.categoryOptions.length > 0) {
				this.updateCategoryCounts();
			}
		}
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy decorator
	}

	private initializeForm(): void {
		this.filterForm = this.formBuilder.group({
			search: [''],
			categories: [[]],
			status: [[]],
			types: [[]],
			tags: [[]],
			priceRange: this.formBuilder.group({
				min: [0],
				max: [1000]
			}),
			sortBy: [PluginSortOption.DOWNLOADS],
			sortDirection: ['desc'],
			author: [''],
			license: [[]],
			minDownloads: [0],
			dateRange: this.formBuilder.group({
				from: [null],
				to: [null]
			}),
			featured: [false],
			verified: [false]
		});
	}

	private setupFilterSections(): void {
		this.filterSections = [
			{
				id: 'search',
				label: 'Search & Sort',
				icon: 'search-outline',
				expanded: true,
				visible: true
			},
			{
				id: 'categories',
				label: 'Categories',
				icon: 'grid-outline',
				expanded: true,
				visible: false // Initially hidden until categories are loaded
			},
			{
				id: 'properties',
				label: 'Properties',
				icon: 'options-outline',
				expanded: false,
				visible: true
			},
			{
				id: 'pricing',
				label: 'Pricing',
				icon: 'pricetags-outline',
				expanded: false,
				visible: true
			},
			{
				id: 'advanced',
				label: 'Advanced',
				icon: 'settings-outline',
				expanded: false,
				visible: this.showAdvanced
			}
		];
	}

	private setupComputedObservables(): void {
		this.filteredPluginsCount$ = this.filterForm.valueChanges.pipe(
			startWith(this.filterForm.value),
			map(() => this.getFilteredPluginsCount()),
			distinctUntilChanged()
		);

		this.hasActiveFilters$ = this.filterForm.valueChanges.pipe(
			startWith(this.filterForm.value),
			map(() => this.hasAnyActiveFilters()),
			distinctUntilChanged()
		);

		this.searchSuggestions$ = this.filterForm.get('search')!.valueChanges.pipe(
			startWith(''),
			debounceTime(200),
			map((searchTerm) => this.generateSearchSuggestions(searchTerm || '')),
			distinctUntilChanged()
		);
	}

	private setupFormSubscriptions(): void {
		// Main filter changes
		this.filterForm.valueChanges
			.pipe(
				debounceTime(300),
				distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
				untilDestroyed(this)
			)
			.subscribe((formValue) => {
				const filters = this.mapFormValueToFilter(formValue);
				this.updateActiveFiltersCount(filters);
				this.filterChange.emit(filters);
			});
	}

	private mapFormValueToFilter(formValue: any): IPluginFilter {
		return {
			search: formValue.search?.trim() || undefined,
			categories: formValue.categories?.length ? formValue.categories : undefined,
			status: formValue.status?.length ? formValue.status : undefined,
			types: formValue.types?.length ? formValue.types : undefined,
			tags: formValue.tags?.length ? formValue.tags : undefined,
			priceRange: this.isValidPriceRange(formValue.priceRange) ? formValue.priceRange : undefined,
			sortBy: formValue.sortBy || PluginSortOption.DOWNLOADS,
			sortDirection: formValue.sortDirection || 'desc',
			author: formValue.author?.trim() || undefined,
			license: formValue.license?.length ? formValue.license : undefined,
			minDownloads: formValue.minDownloads > 0 ? formValue.minDownloads : undefined,
			dateRange: this.isValidDateRange(formValue.dateRange) ? formValue.dateRange : undefined,
			featured: formValue.featured || undefined,
			verified: formValue.verified || undefined
		};
	}

	private loadFilterOptions(): void {
		// Extract unique licenses
		this.licenseOptions = [...new Set(this.plugins.map((p) => p.license).filter(Boolean))].sort();

		// Extract unique authors
		this.authorOptions = [...new Set(this.plugins.map((p) => p.author).filter(Boolean))].sort();
	}

	/**
	 * Load plugin categories from the backend using state management
	 */
	private loadCategoriesFromBackend(): void {
		// Set loading state
		this.isCategoriesLoading = true;

		// Dispatch action to load categories on first launch
		PluginCategoryActions.loadAll({ isActive: true });

		// Subscribe to loading state
		this.pluginCategoryQuery.isLoading$.pipe(untilDestroyed(this)).subscribe({
			next: (isLoading) => {
				this.isCategoriesLoading = isLoading;
			}
		});

		// Subscribe to categories from store
		this.pluginCategoryQuery.activeCategories$.pipe(untilDestroyed(this)).subscribe({
			next: (categories) => {
				this.hasCategoriesLoaded = true;
				this.isCategoriesLoading = false;
				this.categoryOptions = categories.map((category) => ({
					value: category.id,
					label: category.name,
					icon: category.icon || 'cube-outline',
					count: 0 // Will be updated by updateCategoryCounts
				}));
				this.updateCategoryCounts();

				// Update category section visibility based on whether categories exist
				this.updateCategorySectionVisibility();
			},
			error: (error) => {
				console.error('Failed to load plugin categories:', error);
				this.hasCategoriesLoaded = true;
				this.isCategoriesLoading = false;
				// Fallback to empty array if backend fails
				this.categoryOptions = [];
				// Hide category section if loading failed
				this.updateCategorySectionVisibility();
			}
		});
	}

	/**
	 * @deprecated Removed - Categories are now loaded from backend via loadCategoriesFromBackend()
	 * This method was used to infer categories from plugin names and descriptions.
	 * Categories are now managed in the database and fetched via the PluginCategoryService.
	 */

	private updateCategoryCounts(): void {
		this.categoryOptions.forEach((category) => {
			category.count = this.plugins.filter((plugin) => plugin.category?.id === category.value).length;
		});
	}

	private getFilteredPluginsCount(): number {
		const filters = this.mapFormValueToFilter(this.filterForm.value);
		return this.applyFiltersToPlugins(this.plugins, filters).length;
	}

	private applyFiltersToPlugins(plugins: IPlugin[], filters: IPluginFilter): IPlugin[] {
		return plugins.filter((plugin) => {
			// Search filter
			if (filters.search) {
				const searchLower = filters.search.toLowerCase();
				const matchesSearch =
					plugin.name?.toLowerCase().includes(searchLower) ||
					plugin.description?.toLowerCase().includes(searchLower) ||
					plugin.author?.toLowerCase().includes(searchLower);

				if (!matchesSearch) return false;
			}

			// Category filter
			if (filters.categories?.length) {
				if (!plugin.category?.id || !filters.categories.includes(plugin.category.id)) {
					return false;
				}
			}

			// Status filter
			if (filters.status?.length && !filters.status.includes(plugin.status)) {
				return false;
			}

			// Type filter
			if (filters.types?.length && !filters.types.includes(plugin.type)) {
				return false;
			}

			// Author filter
			if (filters.author && plugin.author?.toLowerCase() !== filters.author.toLowerCase()) {
				return false;
			}

			// License filter
			if (filters.license?.length && plugin.license && !filters.license.includes(plugin.license)) {
				return false;
			}

			// Download count filter
			if (filters.minDownloads && (plugin.downloadCount || 0) < filters.minDownloads) {
				return false;
			}

			return true;
		});
	}

	private updateActiveFiltersCount(filters: IPluginFilter): void {
		let count = 0;

		if (filters.search) count++;
		if (filters.categories?.length) count++;
		if (filters.status?.length) count++;
		if (filters.types?.length) count++;
		if (filters.tags?.length) count++;
		if (filters.priceRange) count++;
		if (filters.author) count++;
		if (filters.license?.length) count++;
		if (filters.minDownloads) count++;
		if (filters.dateRange) count++;
		if (filters.featured) count++;
		if (filters.verified) count++;

		this.activeFiltersCount$.next(count);
	}

	private hasAnyActiveFilters(): boolean {
		const filters = this.mapFormValueToFilter(this.filterForm.value);
		return Object.entries(filters).some(([key, value]) => {
			if (key === 'sortBy' || key === 'sortDirection') return false;
			return (
				value !== undefined &&
				value !== null &&
				value !== '' &&
				(Array.isArray(value) ? value.length > 0 : true)
			);
		});
	}

	private isValidPriceRange(priceRange: any): boolean {
		return (
			priceRange &&
			typeof priceRange.min === 'number' &&
			typeof priceRange.max === 'number' &&
			priceRange.min >= 0 &&
			priceRange.max > priceRange.min
		);
	}

	private isValidDateRange(dateRange: any): boolean {
		return dateRange && (dateRange.from || dateRange.to);
	}

	private generateSearchSuggestions(searchTerm: string): string[] {
		if (!searchTerm || searchTerm.length < 2) return [];

		const suggestions = new Set<string>();
		const term = searchTerm.toLowerCase();

		// Plugin names
		this.plugins.forEach((plugin) => {
			if (plugin.name?.toLowerCase().includes(term)) {
				suggestions.add(plugin.name);
			}
			if (plugin.author?.toLowerCase().includes(term)) {
				suggestions.add(plugin.author);
			}
		});

		// Category suggestions
		this.categoryOptions.forEach((category) => {
			if (category.label.toLowerCase().includes(term)) {
				suggestions.add(category.label);
			}
		});

		return Array.from(suggestions).slice(0, 5);
	}

	private updateFilterSectionVisibility(): void {
		this.filterSections.forEach((section) => {
			if (section.id === 'advanced') {
				section.visible = this.showAdvanced;
			}
		});
	}

	/**
	 * Update category section visibility based on whether categories are available
	 */
	private updateCategorySectionVisibility(): void {
		this.filterSections.forEach((section) => {
			if (section.id === 'categories') {
				section.visible = this.hasCategoriesLoaded && this.categoryOptions.length > 0;
			}
		});
	}

	// Public methods for template
	public toggleSection(sectionId: string): void {
		const section = this.filterSections.find((s) => s.id === sectionId);
		if (section) {
			section.expanded = !section.expanded;
		}
	}

	public toggleCollapse(): void {
		this.isCollapsed$.next(!this.isCollapsed$.value);
	}

	public clearAllFilters(): void {
		this.filterForm.reset({
			search: '',
			categories: [],
			status: [],
			types: [],
			tags: [],
			priceRange: { min: 0, max: 1000 },
			sortBy: PluginSortOption.DOWNLOADS,
			sortDirection: 'desc',
			author: '',
			license: [],
			minDownloads: 0,
			dateRange: { from: null, to: null },
			featured: false,
			verified: false
		});
		this.clearFilters.emit();
	}

	public selectCategory(category: string): void {
		const categories = this.filterForm.get('categories')?.value || [];
		const index = categories.indexOf(category);

		if (index > -1) {
			categories.splice(index, 1);
		} else {
			categories.push(category);
		}

		this.filterForm.patchValue({ categories });
	}

	public isCategorySelected(category: string): boolean {
		const categories = this.filterForm.get('categories')?.value || [];
		return categories.includes(category);
	}

	public selectStatus(status: PluginStatus): void {
		const statuses = this.filterForm.get('status')?.value || [];
		const index = statuses.indexOf(status);

		if (index > -1) {
			statuses.splice(index, 1);
		} else {
			statuses.push(status);
		}

		this.filterForm.patchValue({ status: statuses });
	}

	public isStatusSelected(status: PluginStatus): boolean {
		const statuses = this.filterForm.get('status')?.value || [];
		return statuses.includes(status);
	}

	public selectType(type: PluginType): void {
		const types = this.filterForm.get('types')?.value || [];
		const index = types.indexOf(type);

		if (index > -1) {
			types.splice(index, 1);
		} else {
			types.push(type);
		}

		this.filterForm.patchValue({ types });
	}

	public isTypeSelected(type: PluginType): boolean {
		const types = this.filterForm.get('types')?.value || [];
		return types.includes(type);
	}

	public getStatusBadgeStatus(status: PluginStatus): string {
		switch (status) {
			case PluginStatus.ACTIVE:
				return 'success';
			case PluginStatus.INACTIVE:
				return 'warning';
			case PluginStatus.DEPRECATED:
				return 'info';
			case PluginStatus.ARCHIVED:
				return 'danger';
			default:
				return 'basic';
		}
	}

	public getTypeBadgeStatus(type: PluginType): string {
		switch (type) {
			case PluginType.DESKTOP:
				return 'primary';
			case PluginType.WEB:
				return 'info';
			case PluginType.MOBILE:
				return 'warning';
			default:
				return 'basic';
		}
	}

	public getCategoryIcon(category: string): string {
		const option = this.categoryOptions.find((c) => c.value === category);
		return option?.icon || 'cube-outline';
	}

	public formatSortOption(option: PluginSortOption): string {
		switch (option) {
			case PluginSortOption.NAME:
				return 'Name';
			case PluginSortOption.DOWNLOADS:
				return 'Downloads';
			case PluginSortOption.UPLOAD_DATE:
				return 'Upload Date';
			case PluginSortOption.LAST_UPDATED:
				return 'Last Updated';
			case PluginSortOption.RATING:
				return 'Rating';
			case PluginSortOption.AUTHOR:
				return 'Author';
			case PluginSortOption.STATUS:
				return 'Status';
			default:
				return option;
		}
	}

	public exportFilters(): IPluginFilter {
		return this.mapFormValueToFilter(this.filterForm.value);
	}

	public importFilters(filters: IPluginFilter): void {
		this.filterForm.patchValue({
			search: filters.search || '',
			categories: filters.categories || [],
			status: filters.status || [],
			types: filters.types || [],
			tags: filters.tags || [],
			priceRange: filters.priceRange || { min: 0, max: 1000 },
			sortBy: filters.sortBy || PluginSortOption.DOWNLOADS,
			sortDirection: filters.sortDirection || 'desc',
			author: filters.author || '',
			license: filters.license || [],
			minDownloads: filters.minDownloads || 0,
			dateRange: filters.dateRange || { from: null, to: null },
			featured: filters.featured || false,
			verified: filters.verified || false
		});
	}

	public selectPriceCategory(category: PluginPriceCategory): void {
		// Update price range based on selected category
		let priceRange = { min: 0, max: 1000 };

		switch (category) {
			case PluginPriceCategory.FREE:
				priceRange = { min: 0, max: 0 };
				break;
			case PluginPriceCategory.FREEMIUM:
				priceRange = { min: 0, max: 50 };
				break;
			case PluginPriceCategory.PAID:
				priceRange = { min: 1, max: 500 };
				break;
			case PluginPriceCategory.ENTERPRISE:
				priceRange = { min: 100, max: 1000 };
				break;
		}

		this.filterForm.patchValue({ priceRange });
	}

	public trackByCount(index: number, count: number): number {
		return count;
	}
}
