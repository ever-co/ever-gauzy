import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, filter, finalize, map, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { Router } from '@angular/router';
import { coalesceValue } from '../../../../../../utils';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly router: Router
	) {}

	upload$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.upload),
			tap(() => {
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPLOADING'));
			}),
			switchMap(({ plugin }) =>
				this.pluginService.upload(plugin).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.plugin)), // Ensure plugin is not null/undefined
					map((res) => res.plugin),
					tap((uploaded) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [uploaded, ...state.plugins], // Immutable update
							count: state.count + 1
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPLOADED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setUpload({ uploading: false })), // Always stop loading
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
					tap(({ items, total }) =>
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...new Map([...state.plugins, ...items].map((item) => [item.id, item])).values()],
							count: total
						}))
					),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	getOne$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.getOne),
			tap(() => this.pluginMarketplaceStore.setLoading(true)), // Start loading state
			switchMap(({ id, params = {} }) =>
				this.pluginService.getOne(id, params).pipe(
					filter(Boolean), // Filter out null or undefined responses
					tap((plugin) =>
						this.pluginMarketplaceStore.update({
							plugin
						})
					),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback value to keep the stream alive
					})
				)
			)
		)
	);

	update$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.update),
			tap(() => {
				this.pluginMarketplaceStore.update({ updating: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPDATING'));
			}),
			switchMap(({ id, plugin }) =>
				this.pluginService.update(id, plugin).pipe(
					tap((plugin) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...new Map([...state.plugins, plugin].map((item) => [item.id, item])).values()],
							plugin: { ...state.plugin, ...plugin }
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPDATED'));
					}),
					finalize(() => this.pluginMarketplaceStore.update({ updating: false })),
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
			tap(() => {
				this.pluginMarketplaceStore.update({ deleting: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.DELETING'));
			}),
			switchMap(({ id }) =>
				this.pluginService.delete(id).pipe(
					tap(() => {
						this.router.navigate(['settings', 'marketplace-plugins']);
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...state.plugins.filter((plugin) => plugin.id !== id)],
							plugin: null
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.DELETED'));
					}),
					finalize(() => this.pluginMarketplaceStore.update({ deleting: false })),
					catchError((error) => {
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.reset),
			tap(() => this.pluginMarketplaceStore.update({ plugins: [] }))
		)
	);
}
