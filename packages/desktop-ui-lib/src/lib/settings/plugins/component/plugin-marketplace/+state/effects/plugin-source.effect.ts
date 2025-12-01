import { Injectable } from '@angular/core';
import { ID, IPlugin, IPluginSource, IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import {
	EMPTY,
	Observable,
	catchError,
	exhaustMap,
	filter,
	finalize,
	map,
	mergeMap,
	switchMap,
	tap,
	withLatestFrom
} from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginElectronService } from '../../../../services/plugin-electron.service';
import { PluginService } from '../../../../services/plugin.service';
import { DialogCreateSourceComponent } from '../../plugin-marketplace-item/dialog-create-source/dialog-create-source.component';
import { PluginSourceActions } from '../actions/plugin-source.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginSourceStore } from '../stores/plugin-source.store';
import { PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginSourceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginService: PluginService,
		private readonly pluginSourceStore: PluginSourceStore,
		private readonly pluginVersionStore: PluginVersionStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginElectronService: PluginElectronService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	createMany$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.add),
			tap(({ plugin }) => this.selectSourceContext(plugin)),
			exhaustMap(({ plugin }) => this.createSourceDialog(plugin, plugin.versions[0])),
			tap(({ pluginId }) => {
				this.pluginSourceStore.setCreating(pluginId, true);
				this.pluginMarketplaceStore.setUpload(pluginId, { uploading: true, progress: 0 });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.ADDING'));
			}),
			switchMap(({ pluginId, versionId, sources }) =>
				this.pluginService.addSources(pluginId, versionId, sources).pipe(
					tap((res) =>
						this.pluginMarketplaceStore.setUpload(pluginId, {
							uploading: true,
							progress: coalesceValue(res?.progress, 0)
						})
					),
					filter((res) => Boolean(res?.sources)),
					map((res) => res.sources),
					withLatestFrom(this.pluginElectronService.getOS()),
					tap(([created, os]) => {
						this.pluginSourceStore.setSources(created, created.length, os);
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.ADD'));
					}),
					catchError((error) => {
						console.error('Failed to add plugin sources:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.ADD'));
						return EMPTY;
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setUpload(pluginId, { uploading: false, progress: 0 });
						this.pluginSourceStore.setCreating(pluginId, false);
					})
				)
			)
		)
	);

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.getAll),
			filter(({ pluginId, versionId }) => Boolean(pluginId && versionId)),
			tap(({ pluginId, versionId }) => {
				this.pluginSourceStore.setLoading(true);
				this.pluginSourceStore.setPluginVersion(pluginId, versionId);
			}),
			switchMap(({ pluginId, versionId, params = {} }) =>
				this.pluginService.getSources(pluginId, versionId, params).pipe(
					withLatestFrom(this.pluginElectronService.getOS()),
					tap(([{ items, total }, os]) => this.pluginSourceStore.setSources(items, total, os)),
					catchError((error) => {
						console.error('Failed to get plugin sources:', error);
						this.toastrService.error(
							error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.GET')
						);
						return EMPTY;
					}),
					finalize(() => this.pluginSourceStore.setLoading(false))
				)
			)
		)
	);

	select$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.selectSource),
			tap(({ source }) => this.pluginSourceStore.selectSource(source))
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.reset),
			tap(() => this.pluginSourceStore.reset())
		)
	);

	delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.delete),
			tap(({ pluginId }) => {
				this.pluginSourceStore.setDeleting(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.DELETING'));
			}),
			mergeMap(({ pluginId, versionId, sourceId }) =>
				this.pluginService.deleteSource(pluginId, versionId, sourceId).pipe(
					tap(() => {
						const deletedAt = new Date();
						this.pluginSourceStore.updateSource(sourceId, { deletedAt });

						// Update selected source if it was deleted
						const currentSource = this.pluginSourceStore.getValue().source;
						if (currentSource?.id === sourceId) {
							this.pluginSourceStore.selectSource({ ...currentSource, deletedAt });
						}

						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.DELETE')
						);
					}),
					catchError((error) => {
						console.error('Failed to delete plugin source:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.DELETE'));
						return EMPTY;
					}),
					finalize(() => this.pluginSourceStore.setDeleting(pluginId, false))
				)
			)
		)
	);

	restore$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginSourceActions.restore),
			tap(({ pluginId }) => {
				this.pluginSourceStore.setRestoring(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SOURCE.RESTORING'));
			}),
			mergeMap(({ pluginId, versionId, sourceId }) =>
				this.pluginService.restoreSource(pluginId, versionId, sourceId).pipe(
					tap(() => {
						this.pluginSourceStore.updateSource(sourceId, { deletedAt: null });

						// Update selected source if it was restored
						const currentSource = this.pluginSourceStore.getValue().source;
						if (currentSource?.id === sourceId) {
							this.pluginSourceStore.selectSource({ ...currentSource, deletedAt: null });
						}

						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SOURCE.RESTORE')
						);
					}),
					catchError((error) => {
						console.error('Restore failed:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.SOURCE.RESTORE'));
						return EMPTY;
					}),
					finalize(() => this.pluginSourceStore.setRestoring(pluginId, false))
				)
			)
		)
	);

	private createSourceDialog(
		plugin: IPlugin,
		version: IPluginVersion
	): Observable<{ sources: IPluginSource[]; pluginId: ID; versionId: ID }> {
		return this.dialogService
			.open(DialogCreateSourceComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin, version }
			})
			.onClose.pipe(filter(Boolean));
	}

	// Helper method to set plugin context in stores
	private selectSourceContext(plugin: IPlugin): void {
		this.pluginVersionStore.setPluginId(plugin.id);
		this.pluginMarketplaceStore.selectPlugin(plugin);
		this.pluginVersionStore.selectVersion(plugin.versions[0]);
		this.pluginSourceStore.setPluginVersion(plugin.id, plugin.versions[0].id);
	}
}
