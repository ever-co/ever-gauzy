import { Injectable } from '@angular/core';
import { IPluginSource } from '@gauzy/contracts';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, filter, finalize, map, mergeMap, switchMap, tap, withLatestFrom } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginElectronService } from '../../../../services/plugin-electron.service';
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
		private readonly pluginElectronService: PluginElectronService,
		private readonly translateService: TranslateService
	) {}

	createMany$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.add),
			tap(() => {
				this.pluginSourceStore.update({ creating: true });
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.ADDING'));
			}),
			switchMap(({ pluginId, versionId, sources }) =>
				this.pluginService.addSources(pluginId, versionId, sources).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.sources)), // Filter out null or undefined responses
					map((res) => res.sources),
					withLatestFrom(this.pluginElectronService.getOS()),
					tap(([created, os]) => {
						this.pluginSourceStore.update((state) => ({
							source: created[0],
							sources: [...created, ...state.sources].sort((a, b) => {
								if (a.operatingSystem === os.platform) return -1;
								if (b.operatingSystem === os.platform) return 1;
								return 0;
							}),
							count: state.count + created.length
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.ADD'));
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setUpload({ uploading: false });
						this.pluginSourceStore.update({ creating: false });
					}), // Always stop loading
					catchError((error) => {
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.ADD')); // Handle error properly
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
					withLatestFrom(this.pluginElectronService.getOS()),
					tap(([{ items, total }, os]) => {
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

							const sortedSources = Array.from(sourceMap.values()).sort((a, b) => {
								if (a.operatingSystem === os.platform) return -1;
								if (b.operatingSystem === os.platform) return 1;
								return 0;
							});

							return {
								sources: sortedSources,
								source: state.source ?? sortedSources[0],
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

	delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.delete),
			tap(() => {
				this.pluginSourceStore.update({ deleting: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.DELETING'));
			}),
			mergeMap(({ pluginId, versionId, sourceId }) =>
				this.pluginService.deleteSource(pluginId, versionId, sourceId).pipe(
					tap(() => {
						const deletedAt = new Date();
						this.pluginSourceStore.update((state) => ({
							source: state.source && { ...state.source, deletedAt },
							sources: [
								...state.sources.map((source) =>
									source.id === sourceId ? { ...source, deletedAt } : source
								)
							]
						}));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.DELETE')
						);
					}),
					finalize(() => this.pluginSourceStore.update({ deleting: false })),
					catchError((error) => {
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.DELETE'));
						return EMPTY;
					})
				)
			)
		)
	);

	restore$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.restore),
			tap(() => {
				this.pluginSourceStore.update({ restoring: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.RESTORING'));
			}),
			mergeMap(({ pluginId, versionId, sourceId }) =>
				this.pluginService.restoreSource(pluginId, versionId, sourceId).pipe(
					tap(() => {
						this.pluginSourceStore.update((state) => ({
							version:
								state.source?.id === sourceId ? { ...state.source, deletedAt: null } : state.source,
							sources: state.sources.map((source) =>
								source.id === sourceId ? { ...source, deletedAt: null } : source
							)
						}));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.RESTORE')
						);
					}),
					catchError((error) => {
						console.error('Restore failed:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.RESTORE'));
						return EMPTY;
					}),
					finalize(() => this.pluginSourceStore.update({ restoring: false }))
				)
			)
		)
	);
}
