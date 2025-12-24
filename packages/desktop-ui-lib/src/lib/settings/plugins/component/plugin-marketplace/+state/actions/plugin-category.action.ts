import { ID } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { IPluginCategory } from '../stores/plugin-category.store';

export interface IPluginCategoryCreateInput {
	name: string;
	description?: string;
	slug?: string;
	color?: string;
	icon?: string;
	order?: number;
	parentId?: ID;
	metadata?: Record<string, any>;
}

export interface IPluginCategoryUpdateInput extends Partial<IPluginCategoryCreateInput> {}

export class PluginCategoryActions {
	// Core CRUD actions
	public static loadAll = createAction('[Plugin Category] Load All', <T>(params?: T) => ({ params }));
	public static loadMore = createAction('[Plugin Category] Load More');
	public static loadTree = createAction('[Plugin Category] Load Tree', <T>(params?: T) => ({ params }));
	public static loadOne = createAction('[Plugin Category] Load One', <T>(id: ID, params?: T) => ({ id, params }));
	public static create = createAction('[Plugin Category] Create', (category: IPluginCategoryCreateInput) => ({
		category
	}));
	public static update = createAction('[Plugin Category] Update', (id: ID, category: IPluginCategoryUpdateInput) => ({
		id,
		category
	}));
	public static patch = createAction(
		'[Plugin Category] Patch',
		(id: ID, category: Partial<IPluginCategoryUpdateInput>) => ({
			id,
			category
		})
	);
	public static delete = createAction('[Plugin Category] Delete', (id: ID) => ({ id }));

	// Selection actions
	public static selectCategory = createAction(
		'[Plugin Category] Select Category',
		(category: IPluginCategory | null) => ({
			category
		})
	);
	public static createCategoryInline = createAction('[Plugin Category] Create Category Inline', (name: string) => ({
		name
	}));
	public static selectCategoryById = createAction('[Plugin Category] Select Category By Id', (id: ID) => ({ id }));
	public static deselectCategory = createAction('[Plugin Category] Deselect Category');

	// Filter actions
	public static filterByParent = createAction('[Plugin Category] Filter By Parent', (parentId: ID | null) => ({
		parentId
	}));
	public static filterByActive = createAction('[Plugin Category] Filter By Active', (isActive: boolean) => ({
		isActive
	}));
	public static clearCategoryFilters = createAction('[Plugin Category] Clear Filters');

	// Bulk actions
	public static reorderCategories = createAction(
		'[Plugin Category] Reorder Categories',
		(categories: Array<{ id: ID; order: number }>) => ({
			categories
		})
	);
	public static bulkUpdate = createAction(
		'[Plugin Category] Bulk Update',
		(updates: Array<{ id: ID; updates: IPluginCategoryUpdateInput }>) => ({
			updates
		})
	);
	public static bulkDelete = createAction('[Plugin Category] Bulk Delete', (ids: ID[]) => ({ ids }));

	// Hierarchy actions
	public static moveCategory = createAction(
		'[Plugin Category] Move Category',
		(categoryId: ID, newParentId: ID | null) => ({
			categoryId,
			newParentId
		})
	);
	public static expandCategory = createAction('[Plugin Category] Expand Category', (id: ID) => ({ id }));
	public static collapseCategory = createAction('[Plugin Category] Collapse Category', (id: ID) => ({ id }));
	public static expandAll = createAction('[Plugin Category] Expand All');
	public static collapseAll = createAction('[Plugin Category] Collapse All');

	// Pagination actions
	public static setPage = createAction('[Plugin Category] Set Page', (page: number) => ({ page }));
	public static setLimit = createAction('[Plugin Category] Set Limit', (limit: number) => ({ limit }));
	public static resetPagination = createAction('[Plugin Category] Reset Pagination');

	// State management actions
	public static reset = createAction('[Plugin Category] Reset');
	public static setLoading = createAction('[Plugin Category] Set Loading', (loading: boolean) => ({ loading }));
	public static setError = createAction('[Plugin Category] Set Error', (error: string | null) => ({ error }));

	// Refresh action
	public static refresh = createAction('[Plugin Category] Refresh');
}
