import { Injectable } from '@angular/core';
import { IPlugin, IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, catchError, exhaustMap, filter, finalize, map, mergeMap, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginService } from '../../../../services/plugin.service';
import { DialogCreateVersionComponent } from '../../plugin-marketplace-item/dialog-create-version/dialog-create-version.component';
import { PluginVersionActions } from '../actions/plugin-version.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginVersionEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginVersionStore: PluginVersionStore,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.getAll),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setLoading(true);
				this.pluginVersionStore.setPluginId(pluginId);
			}),
			switchMap(({ pluginId, params = {} }) =>
				this.pluginService.getVersions(pluginId, params).pipe(
					tap(({ items, total }) => this.pluginVersionStore.setVersions(items, total)),
					finalize(() => this.pluginVersionStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	createOne$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.add),
			tap(({ plugin }) => this.pluginVersionStore.setPluginId(plugin.id)),
			exhaustMap(({ plugin }) =>
				this.createVersionDialog(plugin).pipe(map((version) => ({ pluginId: plugin.id, version })))
			),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setCreating(pluginId, true);
				this.pluginMarketplaceStore.setUpload(pluginId, { uploading: true, progress: 0 });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.ADDING'));
			}),
			switchMap(({ pluginId, version }) =>
				this.pluginService.addVersion(pluginId, version).pipe(
					tap((res) =>
						this.pluginMarketplaceStore.setUpload(pluginId, {
							uploading: true,
							progress: coalesceValue(res?.progress, 0)
						})
					),
					filter((res) => Boolean(res?.version)), // Filter out null or undefined responses
					map((res) => res.version),
					tap((created) => {
						this.pluginVersionStore.addVersion(created);
						this.pluginVersionStore.selectVersion(created);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.CREATED', {
								number: created.number
							})
						);
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setUpload(pluginId, { uploading: false, progress: 0 });
						this.pluginVersionStore.setCreating(pluginId, false);
					}), // Always stop loading
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
			ofType(PluginVersionActions.update),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setUpdating(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.UPDATING'));
			}),
			switchMap(({ pluginId, versionId, version }) =>
				this.pluginService.updateVersion(pluginId, versionId, version).pipe(
					tap((updatedVersion) => {
						this.pluginVersionStore.updateVersion(versionId, updatedVersion);
						this.pluginVersionStore.selectVersion(updatedVersion);
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.UPDATED', {
								number: updatedVersion.number
							})
						);
					}),
					finalize(() => this.pluginVersionStore.setUpdating(pluginId, false)),
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
			ofType(PluginVersionActions.delete),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setDeleting(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.DELETING'));
			}),
			mergeMap(({ pluginId, versionId }) =>
				this.pluginService.deleteVersion(pluginId, versionId).pipe(
					tap(() => {
						const deletedAt = new Date();
						this.pluginVersionStore.updateVersion(versionId, { deletedAt });

						// Update selected version if it was deleted
						const currentVersion = this.pluginVersionStore.getValue().version;
						if (currentVersion?.id === versionId) {
							this.pluginVersionStore.selectVersion({ ...currentVersion, deletedAt });
						}

						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.DELETED')
						);
					}),
					finalize(() => this.pluginVersionStore.setDeleting(pluginId, false)),
					catchError((error) => {
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	restore$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.restore),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setRestoring(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.RESTORING'));
			}),
			mergeMap(({ pluginId, versionId }) =>
				this.pluginService.restoreVersion(pluginId, versionId).pipe(
					tap(() => {
						this.pluginVersionStore.updateVersion(versionId, { deletedAt: null });

						// Update selected version if it was restored
						const currentVersion = this.pluginVersionStore.getValue().version;
						if (currentVersion?.id === versionId) {
							this.pluginVersionStore.selectVersion({ ...currentVersion, deletedAt: null });
						}

						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.RESTORED')
						);
					}),
					catchError((error) => {
						console.error('Restore failed:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.VERSION.RESTORE'));
						return EMPTY;
					}),
					finalize(() => this.pluginVersionStore.setRestoring(pluginId, false))
				)
			)
		)
	);

	setCurrentPluginId$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.setCurrentPluginId),
			tap(({ pluginId }) => {
				this.pluginVersionStore.setPluginId(pluginId);
			})
		)
	);

	selectVersion$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.selectVersion),
			tap(({ version }) => {
				this.pluginVersionStore.selectVersion(version);
				if (version?.pluginId) {
					this.pluginVersionStore.setPluginId(version.pluginId);
				}
			})
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.reset),
			tap(() => this.pluginVersionStore.reset())
		)
	);

	private createVersionDialog(plugin: IPlugin): Observable<IPluginVersion> {
		return this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin }
			})
			.onClose.pipe(filter(Boolean));
	}
}
