/**
 * Plugin Marketplace Effects
 *
 * Handles side effects for plugin marketplace operations including:
 * - Plugin CRUD operations (upload, get, update, delete)
 * - Search and filtering
 * - Tags management
 * - Rating and reviews
 *
 * For other operations, use dedicated effects:
 * @see PluginInstallationEffects for installation operations
 * @see PluginSubscriptionEffects for subscription operations
 * @see PluginSettingsEffects for settings operations
 */
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import {
	EMPTY,
	Observable,
	catchError,
	debounceTime,
	distinctUntilChanged,
	exhaustMap,
	filter,
	finalize,
	map,
	switchMap,
	take,
	tap
} from 'rxjs';
import { AlertComponent } from '../../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginTagsService } from '../../../../services/plugin-tags.service';
import { PluginService } from '../../../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from '../../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginSourceActions } from '../actions/plugin-source.action';
import { PluginVersionActions } from '../actions/plugin-version.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginSourceStore } from '../stores/plugin-source.store';
import { PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginVersionStore: PluginVersionStore,
		private readonly pluginSourceStore: PluginSourceStore,
		private readonly pluginService: PluginService,
		private readonly pluginTagsService: PluginTagsService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly dialogService: NbDialogService
	) {}

	upload$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.upload),
			exhaustMap(() => this.uploadDialog()),
			tap(() => {
				this.pluginMarketplaceStore.setUpload('default', { uploading: true, progress: 0 });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPLOADING'));
			}),
			switchMap((plugin) =>
				this.pluginService.upload(plugin).pipe(
					tap((res) =>
						this.pluginMarketplaceStore.setUpload('default', {
							uploading: true,
							progress: coalesceValue(res?.progress, 0)
						})
					),
					filter((res) => Boolean(res?.plugin)), // Ensure plugin is not null/undefined
					map((res) => res.plugin),
					tap((uploaded) => {
						const currentPlugins = this.pluginMarketplaceStore.getValue().plugins;
						this.pluginMarketplaceStore.setPlugins(
							[uploaded, ...currentPlugins],
							currentPlugins.length + 1
						);
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPLOADED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setUpload('default', { uploading: false, progress: 0 })), // Always stop loading
					catchError((error) => {
						this.toastrService.error(
							error.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UPLOAD')
						);
						return EMPTY; // Ensure the stream continues
					})
				)
			)
		)
	);

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.getAll),
			tap(() => this.pluginMarketplaceStore.setLoading(true)), // Start loading state
			switchMap(({ params = {} }) =>
				this.pluginService.getAll(params).pipe(
					tap((response) => {
						console.log('API Response:', response); // Debug log
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : items.length;
						const skip = params['skip'] || 0;

						if (skip > 1) {
							// Pagination: append plugins
							this.pluginMarketplaceStore.appendPlugins(items);
						} else {
							// First load: replace plugins
							this.pluginMarketplaceStore.setPlugins(items, total);
						}

						this.pluginMarketplaceStore.setTotalCount(total);
						this.pluginMarketplaceStore.setFilteredCount(total);
					}),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						console.error('Plugin fetch error:', error); // Debug log
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	getOne$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.getOne),
				tap(() => this.pluginMarketplaceStore.setLoading(true)), // Start loading state
				switchMap(({ id, params = {} }) =>
					this.pluginService.getOne(id, params).pipe(
						filter(Boolean), // Filter out null or undefined responses
						map((plugin) => {
							this.pluginMarketplaceStore.selectPlugin(plugin);
							return [
								PluginVersionActions.selectVersion(plugin.version),
								PluginSourceActions.selectSource(plugin.source)
							];
						}),
						finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
						catchError((error) => {
							this.toastrService.error(error.message || error); // Handle error properly
							return EMPTY;
						})
					)
				)
			),
		{ dispatch: true }
	);

	update$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.update),
			tap(({ plugin }) => this.selectPluginContext(plugin)),
			exhaustMap(({ plugin }) =>
				this.dialogService
					.open(PluginMarketplaceUploadComponent, {
						backdropClass: 'backdrop-blur',
						context: { plugin }
					})
					.onClose.pipe(
						take(1),
						filter(Boolean),
						tap((updated: IPlugin) => updated)
					)
			),
			tap((plugin) => {
				this.pluginMarketplaceStore.setUpdating(plugin.id, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPDATING'));
			}),
			switchMap((plugin) =>
				this.pluginService.update(plugin.id, plugin).pipe(
					tap((updatedPlugin) => {
						this.pluginMarketplaceStore.updatePlugin(updatedPlugin.id, updatedPlugin);
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPDATED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setUpdating(plugin.id, false)),
					catchError((error) => {
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.delete),
			exhaustMap(({ id }) =>
				this.dialogService
					.open(AlertComponent, {
						context: {
							data: {
								message: 'PLUGIN.DIALOG.DELETE.DESCRIPTION',
								title: 'PLUGIN.DIALOG.DELETE.TITLE',
								confirmText: 'PLUGIN.DIALOG.DELETE.CONFIRM',
								status: 'Danger'
							}
						}
					})
					.onClose.pipe(
						take(1),
						filter((confirm) => confirm === true),
						map(() => id)
					)
			),
			tap((id) => {
				this.pluginMarketplaceStore.setDeleting(id, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.DELETING'));
			}),
			switchMap((id) =>
				this.pluginService.delete(id).pipe(
					tap(() => {
						this.router.navigate(['plugins', 'marketplace']);

						const plugins = this.pluginMarketplaceStore.getValue().plugins;
						const updated = plugins.filter((p) => p.id !== id);

						this.pluginMarketplaceStore.setPlugins(updated, updated.length);
						this.pluginMarketplaceStore.selectPlugin(null);

						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.DELETED'));
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setDeleting(id, false);
					}),
					catchError((error) => {
						this.toastrService.error(error?.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.reset),
			tap(() => this.pluginMarketplaceStore.reset())
		)
	);

	// Filter Effects
	setFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.setFilters),
			tap(({ filters }) => {
				this.pluginMarketplaceStore.setFilters(filters);
			})
		)
	);

	applyFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.applyFilters),
			debounceTime(300),
			tap(() => {
				this.pluginMarketplaceStore.applyFilters();
			})
		)
	);

	clearFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.clearFilters),
			tap(() => {
				this.pluginMarketplaceStore.clearFilters();
			})
		)
	);

	toggleAdvancedFilters$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.toggleAdvancedFilters),
				tap(({ show }) => {
					this.pluginMarketplaceStore.updateUI({ showAdvancedFilters: show });
				})
			),
		{ dispatch: false }
	);

	setViewMode$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.setViewMode),
				tap(({ view }) => {
					this.pluginMarketplaceStore.updateUI({ selectedView: view });
				})
			),
		{ dispatch: false }
	);

	// Search Effects
	search$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.search),
			debounceTime(300),
			distinctUntilChanged((prev, curr) => prev.query === curr.query),
			tap(() => this.pluginMarketplaceStore.setLoading(true)),
			switchMap(({ query }) =>
				this.pluginService.search({ search: query }).pipe(
					tap((response) => {
						console.log('Search API Response:', response); // Debug log
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : items.length;

						this.pluginMarketplaceStore.setPlugins(items, total);
						this.pluginMarketplaceStore.setTotalCount(total);
						this.pluginMarketplaceStore.setFilteredCount(total);
						this.pluginMarketplaceStore.update({ searchQuery: query });
					}),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)),
					catchError((error) => {
						console.error('Search error:', error); // Debug log
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	// Tags Effects
	loadTags$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadTags),
			switchMap(() =>
				this.pluginTagsService.getAllTags().pipe(
					tap(({ items: tags }) => {
						this.pluginMarketplaceStore.setTags(tags);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load tags');
						return EMPTY;
					})
				)
			)
		)
	);

	createTag$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.createTag),
			switchMap(({ tag }) =>
				this.pluginTagsService.createTag(tag).pipe(
					tap((newTag) => {
						this.pluginMarketplaceStore.addTag(newTag);
						this.toastrService.success('Tag created successfully');
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to create tag');
						return EMPTY;
					})
				)
			)
		)
	);

	// Rating Effects
	ratePlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.ratePlugin),
			switchMap(({ pluginId, rating, review }) =>
				this.pluginService.ratePlugin(pluginId, rating, review).pipe(
					tap((ratingData) => {
						this.pluginMarketplaceStore.updatePluginRating(pluginId, ratingData);
						this.toastrService.success('Rating submitted successfully');
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to submit rating');
						return EMPTY;
					})
				)
			)
		)
	);

	setContextPlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(
				PluginMarketplaceActions.install,
				PluginMarketplaceActions.update,
				PluginMarketplaceActions.uninstall
			),
			tap((action) => {
				switch (action.type) {
					case PluginMarketplaceActions.update.type:
					case PluginMarketplaceActions.install.type:
						this.selectPluginContext(action.plugin);
						break;
					case PluginMarketplaceActions.uninstall.type:
						this.selectPluginContext(
							this.pluginMarketplaceStore.getValue().plugins.find((p) => p.id === action.pluginId)!
						);
						break;
				}
			})
		)
	);

	private uploadDialog(): Observable<IPlugin> {
		return this.dialogService
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(take(1), filter(Boolean));
	}

	// Helper method to set plugin context in stores
	private selectPluginContext(plugin: IPlugin): void {
		if (!plugin) return;
		this.pluginMarketplaceStore.selectPlugin(plugin);
		this.pluginVersionStore.setPluginId(plugin.id);
		this.pluginVersionStore.selectVersion(plugin.version);
		this.pluginSourceStore.setPluginVersion(plugin.id, plugin.version.id);
		this.pluginSourceStore.selectSource(plugin.source);
	}
}
