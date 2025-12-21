import { Injectable } from '@angular/core';
import { IPluginCategory } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, exhaustMap, filter, finalize, map, switchMap, take, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginCategoryService } from '../../../../services/plugin-category.service';
import { CreateCategoryDialogComponent } from '../../plugin-marketplace-item/create-category-dialog/create-category-dialog.component';
import { PluginCategoryActions } from '../actions/plugin-category.action';
import { PluginCategoryStore } from '../stores/plugin-category.store';

@Injectable({ providedIn: 'root' })
export class PluginCategoryEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginCategoryStore: PluginCategoryStore,
		private readonly pluginCategoryService: PluginCategoryService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	// Load all categories
	loadAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.loadAll),
			tap(() => {
				this.pluginCategoryStore.setLoading(true);
				this.pluginCategoryStore.resetPagination();
			}),
			switchMap(({ params = {} }) => {
				const state = this.pluginCategoryStore.getValue();
				const paginationParams = {
					...(params as object),
					page: state.pagination.page,
					limit: state.pagination.limit
				};

				return this.pluginCategoryService.getAll(paginationParams).pipe(
					tap((response) => {
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : items.length;

						this.pluginCategoryStore.setCategories(items, total);
					}),
					finalize(() => this.pluginCategoryStore.setLoading(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to load categories');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.LOAD') || error.message
						);
						return EMPTY;
					})
				);
			})
		)
	);

	// Load more categories (infinite scroll)
	loadMore$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.loadMore),
			tap(() => this.pluginCategoryStore.setLoading(true)),
			switchMap(() => {
				const state = this.pluginCategoryStore.getValue();

				// Don't load if no more items
				if (!state.pagination.hasNext) {
					this.pluginCategoryStore.setLoading(false);
					return EMPTY;
				}

				// Increment page
				this.pluginCategoryStore.incrementPage();

				const paginationParams = {
					...state.filters,
					page: state.pagination.page,
					limit: state.pagination.limit
				};

				return this.pluginCategoryService.getAll(paginationParams).pipe(
					tap((response) => {
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : state.count + items.length;

						this.pluginCategoryStore.appendCategories(items, total);
					}),
					finalize(() => this.pluginCategoryStore.setLoading(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to load more categories');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.LOAD_MORE') || error.message
						);
						return EMPTY;
					})
				);
			})
		)
	);

	// Load category tree
	loadTree$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.loadTree),
			tap(() => this.pluginCategoryStore.setLoading(true)),
			switchMap(({ params = {} }) =>
				this.pluginCategoryService.getTree(params).pipe(
					tap((tree) => {
						this.pluginCategoryStore.setCategoryTree(tree);
						this.pluginCategoryStore.setViewMode('tree');
					}),
					finalize(() => this.pluginCategoryStore.setLoading(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to load category tree');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.LOAD_TREE') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Load one category
	loadOne$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.loadOne),
			tap(() => this.pluginCategoryStore.setLoading(true)),
			switchMap(({ id, params = {} }) =>
				this.pluginCategoryService.getOne(id, params).pipe(
					tap((category) => {
						this.pluginCategoryStore.selectCategory(category);
					}),
					finalize(() => this.pluginCategoryStore.setLoading(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to load category');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.LOAD_ONE') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Create category
	create$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.create),
			tap(() => {
				this.pluginCategoryStore.setCreating(true);
				this.toastrService.info(
					this.translateService.instant('PLUGIN.CATEGORY.TOASTR.INFO.CREATING') || 'Creating category...'
				);
			}),
			switchMap(({ category }) =>
				this.pluginCategoryService.create(category).pipe(
					tap((newCategory) => {
						this.pluginCategoryStore.addCategory(newCategory);
						this.pluginCategoryStore.selectCategory(newCategory);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.SUCCESS.CREATED') ||
								'Category created successfully'
						);
					}),
					finalize(() => this.pluginCategoryStore.setCreating(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to create category');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.CREATE') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	createInline$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.createCategoryInline),
				tap(() => this.pluginCategoryStore.deselectCategory()),
				exhaustMap(({ name }) =>
					this.dialogService
						.open(CreateCategoryDialogComponent, {
							context: { name }
						})
						.onClose.pipe(
							take(1),
							filter(Boolean),
							map((newCategory: IPluginCategory) => PluginCategoryActions.selectCategory(newCategory))
						)
				)
			),
		{ dispatch: true }
	);

	// Update category
	update$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.update),
			tap(() => {
				this.pluginCategoryStore.setUpdating(true);
				this.toastrService.info(
					this.translateService.instant('PLUGIN.CATEGORY.TOASTR.INFO.UPDATING') || 'Updating category...'
				);
			}),
			switchMap(({ id, category }) =>
				this.pluginCategoryService.update(id, category).pipe(
					tap((updatedCategory) => {
						this.pluginCategoryStore.updateCategory(id, updatedCategory);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.SUCCESS.UPDATED') ||
								'Category updated successfully'
						);
					}),
					finalize(() => this.pluginCategoryStore.setUpdating(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to update category');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.UPDATE') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Patch category
	patch$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.patch),
			tap(() => this.pluginCategoryStore.setUpdating(true)),
			switchMap(({ id, category }) =>
				this.pluginCategoryService.patch(id, category).pipe(
					tap((updatedCategory) => {
						this.pluginCategoryStore.updateCategory(id, updatedCategory);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.SUCCESS.PATCHED') ||
								'Category updated successfully'
						);
					}),
					finalize(() => this.pluginCategoryStore.setUpdating(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to patch category');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.PATCH') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Delete category
	delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.delete),
			tap(() => {
				this.pluginCategoryStore.setDeleting(true);
				this.toastrService.info(
					this.translateService.instant('PLUGIN.CATEGORY.TOASTR.INFO.DELETING') || 'Deleting category...'
				);
			}),
			switchMap(({ id }) =>
				this.pluginCategoryService.delete(id).pipe(
					tap(() => {
						this.pluginCategoryStore.removeCategory(id);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.SUCCESS.DELETED') ||
								'Category deleted successfully'
						);
					}),
					finalize(() => this.pluginCategoryStore.setDeleting(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to delete category');
						this.toastrService.error(
							this.translateService.instant('PLUGIN.CATEGORY.TOASTR.ERROR.DELETE') || error.message
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Select category
	selectCategory$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.selectCategory),
				tap(({ category }) => {
					this.pluginCategoryStore.selectCategory(category);
				})
			),
		{ dispatch: false }
	);

	// Select category by ID
	selectCategoryById$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.selectCategoryById),
				tap(({ id }) => {
					this.pluginCategoryStore.selectCategoryById(id);
				})
			),
		{ dispatch: false }
	);

	// Deselect category
	deselectCategory$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.deselectCategory),
				tap(() => {
					this.pluginCategoryStore.deselectCategory();
				})
			),
		{ dispatch: false }
	);

	// Filter by parent
	filterByParent$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.filterByParent),
				tap(({ parentId }) => {
					this.pluginCategoryStore.setFilters({ parentId });
				})
			),
		{ dispatch: false }
	);

	// Filter by active
	filterByActive$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.filterByActive),
				tap(({ isActive }) => {
					this.pluginCategoryStore.setFilters({ isActive });
				})
			),
		{ dispatch: false }
	);

	// Clear filters
	clearCategoryFilters$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.clearCategoryFilters),
				tap(() => {
					this.pluginCategoryStore.clearFilters();
				})
			),
		{ dispatch: false }
	);

	// Bulk update
	bulkUpdate$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.bulkUpdate),
			tap(() => {
				this.pluginCategoryStore.setUpdating(true);
				this.toastrService.info('Updating categories...');
			}),
			switchMap(({ updates }) =>
				// Process updates sequentially
				Promise.all(updates.map(({ id, updates }) => this.pluginCategoryService.patch(id, updates).toPromise()))
					.then(() => {
						this.pluginCategoryStore.bulkUpdateCategories(updates);
						this.toastrService.success('Categories updated successfully');
					})
					.catch((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to bulk update categories');
						this.toastrService.error(error.message || 'Failed to update categories');
						return EMPTY;
					})
					.finally(() => {
						this.pluginCategoryStore.setUpdating(false);
					})
			)
		)
	);

	// Bulk delete
	bulkDelete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.bulkDelete),
			tap(() => {
				this.pluginCategoryStore.setDeleting(true);
				this.toastrService.info('Deleting categories...');
			}),
			switchMap(({ ids }) =>
				// Process deletions sequentially
				Promise.all(ids.map((id) => this.pluginCategoryService.delete(id).toPromise()))
					.then(() => {
						this.pluginCategoryStore.bulkDeleteCategories(ids);
						this.toastrService.success('Categories deleted successfully');
					})
					.catch((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to bulk delete categories');
						this.toastrService.error(error.message || 'Failed to delete categories');
						return EMPTY;
					})
					.finally(() => {
						this.pluginCategoryStore.setDeleting(false);
					})
			)
		)
	);

	// Move category
	moveCategory$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.moveCategory),
			tap(() => this.pluginCategoryStore.setUpdating(true)),
			switchMap(({ categoryId, newParentId }) =>
				this.pluginCategoryService.patch(categoryId, { parentId: newParentId } as any).pipe(
					tap((updatedCategory) => {
						this.pluginCategoryStore.updateCategory(categoryId, updatedCategory as any);
						this.toastrService.success('Category moved successfully');
					}),
					finalize(() => this.pluginCategoryStore.setUpdating(false)),
					catchError((error) => {
						this.pluginCategoryStore.setError(error.message || 'Failed to move category');
						this.toastrService.error(error.message || 'Failed to move category');
						return EMPTY;
					})
				)
			)
		)
	);

	// Expand/Collapse actions
	expandCategory$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.expandCategory),
				tap(({ id }) => {
					this.pluginCategoryStore.expandCategory(id);
				})
			),
		{ dispatch: false }
	);

	collapseCategory$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.collapseCategory),
				tap(({ id }) => {
					this.pluginCategoryStore.collapseCategory(id);
				})
			),
		{ dispatch: false }
	);

	expandAll$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.expandAll),
				tap(() => {
					this.pluginCategoryStore.expandAll();
				})
			),
		{ dispatch: false }
	);

	collapseAll$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.collapseAll),
				tap(() => {
					this.pluginCategoryStore.collapseAll();
				})
			),
		{ dispatch: false }
	);

	// Reset
	reset$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.reset),
				tap(() => {
					this.pluginCategoryStore.reset();
				})
			),
		{ dispatch: false }
	);

	// Refresh
	refresh$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginCategoryActions.refresh),
			switchMap(() => {
				// Trigger loadAll action
				return [PluginCategoryActions.loadAll({})];
			})
		)
	);

	// Set loading
	setLoading$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.setLoading),
				tap(({ loading }) => {
					this.pluginCategoryStore.setLoading(loading);
				})
			),
		{ dispatch: false }
	);

	// Set error
	setError$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.setError),
				tap(({ error }) => {
					this.pluginCategoryStore.setError(error);
				})
			),
		{ dispatch: false }
	);

	// Pagination effects
	setPage$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.setPage),
				tap(({ page }) => {
					this.pluginCategoryStore.setPage(page);
				})
			),
		{ dispatch: false }
	);

	setLimit$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.setLimit),
				tap(({ limit }) => {
					this.pluginCategoryStore.setLimit(limit);
				})
			),
		{ dispatch: false }
	);

	resetPagination$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginCategoryActions.resetPagination),
				tap(() => {
					this.pluginCategoryStore.resetPagination();
				})
			),
		{ dispatch: false }
	);
}
