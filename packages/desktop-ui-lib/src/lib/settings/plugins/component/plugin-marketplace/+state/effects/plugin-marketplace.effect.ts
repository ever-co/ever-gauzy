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

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService,
		private readonly router: Router
	) {}

	upload$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.upload),
			tap(() => {
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info('Uploading...');
			}),
			switchMap(({ plugin }) =>
				this.pluginService.upload(plugin).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.plugin)), // Ensure plugin is not null/undefined
					map((res) => res.plugin),
					tap((uploaded) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [uploaded, ...state.plugins] // Immutable update
						}));
						this.toastrService.success('Upload plugin successfully!');
					}),
					finalize(() => this.pluginMarketplaceStore.setUpload({ uploading: false })), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error || 'Upload failed');
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
				this.toastrService.info('Updating plugin...');
			}),
			switchMap(({ id, plugin }) =>
				this.pluginService.update(id, plugin).pipe(
					tap((plugin) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...new Map([...state.plugins, plugin].map((item) => [item.id, item])).values()],
							plugin: { ...state.plugin, ...plugin }
						}));
						this.toastrService.success('Update plugin successfully!');
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
				this.toastrService.info('Deleting plugin...');
			}),
			switchMap(({ id }) =>
				this.pluginService.delete(id).pipe(
					tap(() => {
						this.router.navigate(['settings', 'marketplace-plugins']);
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...state.plugins.filter((plugin) => plugin.id !== id)],
							plugin: null
						}));
						this.toastrService.success('Delete plugin successfully!');
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
}
