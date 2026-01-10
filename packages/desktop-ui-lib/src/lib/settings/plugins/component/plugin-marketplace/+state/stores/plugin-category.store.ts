import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IPluginCategory as IPluginCategoryBase } from '@gauzy/contracts';
import { IPluginCategoryTree } from '../../../../services/plugin-category.service';

/**
 * Extended plugin category interface with full properties
 * Note: slug, color, order, parentId are now in the base interface
 */
export interface IPluginCategory extends IPluginCategoryBase {
	isActive?: boolean;
	metadata?: Record<string, any>;
}

export interface IPluginCategoryFilter {
	parentId?: ID | null;
	isActive?: boolean;
	search?: string;
}

export interface IPluginCategoryState {
	loading: boolean;
	creating: boolean;
	updating: boolean;
	deleting: boolean;
	error: string | null;
	categories: IPluginCategory[];
	categoryTree: IPluginCategoryTree[];
	selectedCategory: IPluginCategory | null;
	selectedCategoryId: ID | null;
	count: number;
	filters: IPluginCategoryFilter;
	expandedCategories: Set<ID>;
	pagination: {
		page: number;
		limit: number;
		total: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
	ui: {
		viewMode: 'flat' | 'tree';
		sortBy: 'name' | 'order' | 'createdAt';
		sortDirection: 'asc' | 'desc';
	};
}

export function createInitialCategoryState(): IPluginCategoryState {
	return {
		loading: false,
		creating: false,
		updating: false,
		deleting: false,
		error: null,
		categories: [],
		categoryTree: [],
		selectedCategory: null,
		selectedCategoryId: null,
		count: 0,
		filters: {},
		expandedCategories: new Set<ID>(),
		pagination: {
			page: 1,
			limit: 20,
			total: 0,
			hasNext: false,
			hasPrevious: false
		},
		ui: {
			viewMode: 'flat',
			sortBy: 'order',
			sortDirection: 'asc'
		}
	};
}

@StoreConfig({ name: '_plugin_categories' })
@Injectable({ providedIn: 'root' })
export class PluginCategoryStore extends Store<IPluginCategoryState> {
	constructor() {
		super(createInitialCategoryState());
	}

	// Loading state
	public setLoading(loading: boolean): void {
		this.update({ loading });
	}

	public setCreating(creating: boolean): void {
		this.update({ creating });
	}

	public setUpdating(updating: boolean): void {
		this.update({ updating });
	}

	public setDeleting(deleting: boolean): void {
		this.update({ deleting });
	}

	// Error state
	public setError<T = string | null>(error: T): void {
		this.update({ error: error as any });
	}

	// Categories
	public setCategories(categories: IPluginCategory[], count?: number): void {
		const total = count !== undefined ? count : categories.length;
		this.update({
			categories,
			count: total,
			pagination: {
				...this.getValue().pagination,
				total,
				hasNext: categories.length >= this.getValue().pagination.limit,
				hasPrevious: this.getValue().pagination.page > 1
			}
		});
	}

	public appendCategories(categories: IPluginCategory[], count?: number): void {
		const state = this.getValue();
		const total = count !== undefined ? count : state.count + categories.length;
		this.update({
			categories: [...state.categories, ...categories],
			count: total,
			pagination: {
				...state.pagination,
				total,
				hasNext: categories.length >= state.pagination.limit,
				hasPrevious: state.pagination.page > 1
			}
		});
	}

	public setCategoryTree(categoryTree: IPluginCategoryTree[]): void {
		this.update({ categoryTree });
	}

	public addCategory(category: IPluginCategory): void {
		this.update((state) => ({
			categories: [...state.categories, category],
			count: state.count + 1
		}));
	}

	public updateCategory(id: ID, updates: Partial<IPluginCategory>): void {
		this.update((state) => ({
			categories: state.categories.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)),
			selectedCategory:
				state.selectedCategory?.id === id ? { ...state.selectedCategory, ...updates } : state.selectedCategory
		}));
	}

	public removeCategory(id: ID): void {
		this.update((state) => ({
			categories: state.categories.filter((cat) => cat.id !== id),
			count: state.count - 1,
			selectedCategory: state.selectedCategory?.id === id ? null : state.selectedCategory,
			selectedCategoryId: state.selectedCategoryId === id ? null : state.selectedCategoryId
		}));
	}

	// Selection
	public selectCategory(category: IPluginCategory | null): void {
		this.update({
			selectedCategory: category,
			selectedCategoryId: category?.id || null
		});
	}

	public selectCategoryById(id: ID): void {
		const category = this.getValue().categories.find((cat) => cat.id === id);
		if (category) {
			this.selectCategory(category);
		}
	}

	public deselectCategory(): void {
		this.update({
			selectedCategory: null,
			selectedCategoryId: null
		});
	}

	// Filters
	public setFilters(filters: IPluginCategoryFilter): void {
		this.update({ filters });
	}

	public clearFilters(): void {
		this.update({ filters: {} });
	}

	// Hierarchy expansion
	public expandCategory(id: ID): void {
		this.update((state) => {
			const expandedCategories = new Set(state.expandedCategories);
			expandedCategories.add(id);
			return { expandedCategories };
		});
	}

	public collapseCategory(id: ID): void {
		this.update((state) => {
			const expandedCategories = new Set(state.expandedCategories);
			expandedCategories.delete(id);
			return { expandedCategories };
		});
	}

	public expandAll(): void {
		this.update((state) => {
			const expandedCategories = new Set(state.categories.map((cat) => cat.id));
			return { expandedCategories };
		});
	}

	public collapseAll(): void {
		this.update({ expandedCategories: new Set<ID>() });
	}

	// UI state
	public setViewMode(viewMode: 'flat' | 'tree'): void {
		this.update((state) => ({
			ui: { ...state.ui, viewMode }
		}));
	}

	public setSortBy(sortBy: 'name' | 'order' | 'createdAt'): void {
		this.update((state) => ({
			ui: { ...state.ui, sortBy }
		}));
	}

	public setSortDirection(sortDirection: 'asc' | 'desc'): void {
		this.update((state) => ({
			ui: { ...state.ui, sortDirection }
		}));
	}

	// Pagination
	public setPage(page: number): void {
		this.update((state) => ({
			pagination: {
				...state.pagination,
				page,
				hasPrevious: page > 1
			}
		}));
	}

	public setLimit(limit: number): void {
		this.update((state) => ({
			pagination: {
				...state.pagination,
				limit
			}
		}));
	}

	public incrementPage(): void {
		this.update((state) => ({
			pagination: {
				...state.pagination,
				page: state.pagination.page + 1,
				hasPrevious: true
			}
		}));
	}

	public resetPagination(): void {
		this.update((state) => ({
			pagination: {
				...state.pagination,
				page: 1,
				total: 0,
				hasNext: false,
				hasPrevious: false
			},
			categories: []
		}));
	}

	// Bulk operations
	public bulkUpdateCategories(updates: Array<{ id: ID; updates: Partial<IPluginCategory> }>): void {
		this.update((state) => {
			const updatesMap = new Map(updates.map((u) => [u.id, u.updates]));
			return {
				categories: state.categories.map((cat) => {
					const categoryUpdates = updatesMap.get(cat.id);
					return categoryUpdates ? { ...cat, ...categoryUpdates } : cat;
				})
			};
		});
	}

	public bulkDeleteCategories(ids: ID[]): void {
		const idsSet = new Set(ids);
		this.update((state) => ({
			categories: state.categories.filter((cat) => !idsSet.has(cat.id)),
			count: state.count - ids.length,
			selectedCategory:
				state.selectedCategory && idsSet.has(state.selectedCategory.id) ? null : state.selectedCategory,
			selectedCategoryId:
				state.selectedCategoryId && idsSet.has(state.selectedCategoryId) ? null : state.selectedCategoryId
		}));
	}

	// Reset
	public reset(): void {
		this.update(createInitialCategoryState());
	}
}
