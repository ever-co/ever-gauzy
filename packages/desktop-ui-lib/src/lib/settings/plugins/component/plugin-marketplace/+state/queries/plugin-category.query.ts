import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { ID } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IPluginCategoryTree } from '../../../../services/plugin-category.service';
import {
	IPluginCategory,
	IPluginCategoryFilter,
	IPluginCategoryState,
	PluginCategoryStore
} from '../stores/plugin-category.store';

@Injectable({ providedIn: 'root' })
export class PluginCategoryQuery extends Query<IPluginCategoryState> {
	// Core selectors
	public readonly categories$: Observable<IPluginCategory[]> = this.select((state) => state.categories);
	public readonly categoryTree$: Observable<IPluginCategoryTree[]> = this.select((state) => state.categoryTree);
	public readonly selectedCategory$: Observable<IPluginCategory | null> = this.select(
		(state) => state.selectedCategory
	);
	public readonly selectedCategoryId$: Observable<ID | null> = this.select((state) => state.selectedCategoryId);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly filters$: Observable<IPluginCategoryFilter> = this.select((state) => state.filters);

	// Loading states
	public readonly isLoading$: Observable<boolean> = this.select((state) => state.loading);
	public readonly isCreating$: Observable<boolean> = this.select((state) => state.creating);
	public readonly isUpdating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly isDeleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly error$: Observable<string | null> = this.select((state) => state.error);

	// Pagination selectors
	public readonly pagination$ = this.select((state) => state.pagination);
	public readonly hasNext$: Observable<boolean> = this.select((state) => state.pagination.hasNext);
	public readonly hasPrevious$: Observable<boolean> = this.select((state) => state.pagination.hasPrevious);
	public readonly currentPage$: Observable<number> = this.select((state) => state.pagination.page);
	public readonly pageLimit$: Observable<number> = this.select((state) => state.pagination.limit);
	public readonly totalCategories$: Observable<number> = this.select((state) => state.pagination.total);

	// UI selectors
	public readonly viewMode$: Observable<'flat' | 'tree'> = this.select((state) => state.ui.viewMode);
	public readonly sortBy$: Observable<'name' | 'order' | 'createdAt'> = this.select((state) => state.ui.sortBy);
	public readonly sortDirection$: Observable<'asc' | 'desc'> = this.select((state) => state.ui.sortDirection);
	public readonly expandedCategories$: Observable<Set<ID>> = this.select((state) => state.expandedCategories);

	// Computed selectors
	public readonly hasCategories$: Observable<boolean> = this.categories$.pipe(
		map((categories) => categories.length > 0)
	);

	public readonly rootCategories$: Observable<IPluginCategory[]> = this.categories$.pipe(
		map((categories) => categories.filter((cat) => !cat.parentId))
	);

	public readonly activeCategories$: Observable<IPluginCategory[]> = this.categories$.pipe(
		map((categories) => categories.filter((cat) => cat.isActive))
	);

	public readonly hasSelection$: Observable<boolean> = this.selectedCategory$.pipe(map((cat) => cat !== null));

	public readonly isProcessing$: Observable<boolean> = this.select(
		(state) => state.loading || state.creating || state.updating || state.deleting
	);

	constructor(readonly pluginCategoryStore: PluginCategoryStore) {
		super(pluginCategoryStore);
	}

	// Getter methods for synchronous access
	public get categories(): IPluginCategory[] {
		return this.getValue().categories || [];
	}

	public get categoryTree(): IPluginCategoryTree[] {
		return this.getValue().categoryTree || [];
	}

	public get selectedCategory(): IPluginCategory | null {
		return this.getValue().selectedCategory;
	}

	public get selectedCategoryId(): ID | null {
		return this.getValue().selectedCategoryId;
	}

	public get count(): number {
		return this.getValue().count;
	}

	public get filters(): IPluginCategoryFilter {
		return this.getValue().filters;
	}

	public get isLoading(): boolean {
		return this.getValue().loading;
	}

	public get error(): string | null {
		return this.getValue().error;
	}

	public get viewMode(): 'flat' | 'tree' {
		return this.getValue().ui.viewMode;
	}

	public get expandedCategories(): Set<ID> {
		return this.getValue().expandedCategories;
	}

	public get pagination() {
		return this.getValue().pagination;
	}

	public get hasNext(): boolean {
		return this.getValue().pagination.hasNext;
	}

	public get hasPrevious(): boolean {
		return this.getValue().pagination.hasPrevious;
	}

	// Utility methods
	public getCategoryById(id: ID): IPluginCategory | undefined {
		return this.categories.find((cat) => cat.id === id);
	}

	public getCategoryBySlug(slug: string): IPluginCategory | undefined {
		return this.categories.find((cat) => cat.slug === slug);
	}

	public getChildCategories(parentId: ID): IPluginCategory[] {
		return this.categories.filter((cat) => cat.parentId === parentId);
	}

	public getRootCategories(): IPluginCategory[] {
		return this.categories.filter((cat) => !cat.parentId);
	}

	public getActiveCategories(): IPluginCategory[] {
		return this.categories.filter((cat) => cat.isActive);
	}

	public isCategoryExpanded(id: ID): boolean {
		return this.expandedCategories.has(id);
	}

	public hasChildren(categoryId: ID): boolean {
		return this.categories.some((cat) => cat.parentId === categoryId);
	}
}
