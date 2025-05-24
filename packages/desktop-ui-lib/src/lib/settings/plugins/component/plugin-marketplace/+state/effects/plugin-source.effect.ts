import { Injectable } from '@angular/core';
import { IPluginSource } from '@gauzy/contracts';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, filter, finalize, map, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginService } from '../../../../services/plugin.service';
import { PluginSourceActions } from '../actions/plugin-source.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginSourceStore } from '../stores/plugin-source.store';

@Injectable({ providedIn: 'root' })
export class PluginSourceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginService: PluginService,
		private readonly pluginSourceStore: PluginSourceStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly translateService: TranslateService
	) {}

	createMany$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.add),
			tap(() => {
				this.pluginSourceStore.update({ creating: true });
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.ADDING'));
			}),
			switchMap(({ pluginId, versionId, sources }) =>
				this.pluginService.addSources(pluginId, versionId, sources).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.sources)), // Filter out null or undefined responses
					map((res) => res.sources),
					tap((created) => {
						this.pluginSourceStore.update((state) => ({
							source: created[0],
							sources: [...created, ...state.sources],
							count: state.count + created.length
						}));
						this.toastrService.success(this.translateService.instant('Source added successfully'));
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setUpload({ uploading: false });
						this.pluginSourceStore.update({ creating: false });
					}), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback value to keep the stream alive
					})
				)
			)
		)
	);

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.getAll),
			tap(() => this.pluginSourceStore.setLoading(true)), // Start loading state
			switchMap(({ pluginId, versionId, params = {} }) =>
				this.pluginService.getSources(pluginId, versionId, params).pipe(
					tap(({ items, total }) => {
						this.pluginSourceStore.update((state) => {
							if (!items?.length) {
								return {
									sources: state.sources || [],
									source: state.source,
									count: total
								};
							}

							const sourceMap = new Map<string, IPluginSource>(
								(state.sources || []).map((item) => [item.id, item])
							);

							items.forEach((item) => sourceMap.set(item.id, item));

							return {
								sources: Array.from(sourceMap.values()),
								source: state.source ?? items[0],
								count: total
							};
						});
					}),
					finalize(() => this.pluginSourceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	select$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.selectSource),
			tap(({ source }) => this.pluginSourceStore.update((state) => ({ ...state, source })))
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.reset),
			tap(() =>
				this.pluginSourceStore.update({
					sources: []
				})
			)
		)
	);
}
