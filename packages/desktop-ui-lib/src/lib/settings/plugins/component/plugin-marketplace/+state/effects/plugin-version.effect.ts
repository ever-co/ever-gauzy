import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, filter, finalize, map, mergeMap, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { PluginVersionActions } from '../actions/plugin-version.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginVersionStore } from '../stores/plugin-version.store';
import { coalesceValue } from '../../../../../../utils';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class PluginVersionEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginVersionStore: PluginVersionStore,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly translateService: TranslateService
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
					tap(({ items, total }) => {
						// Merge with existing versions
						const currentVersions = this.pluginVersionStore.getValue().versions || [];
						const versionMap = new Map([...currentVersions, ...items].map((item) => [item.id, item]));
						const mergedVersions = Array.from(versionMap.values());

						this.pluginVersionStore.setVersions(mergedVersions, total);
					}),
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
			tap(() => {
				this.pluginVersionStore.setCreating(true);
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.ADDING'));
			}),
			switchMap(({ pluginId, version }) =>
				this.pluginService.addVersion(pluginId, version).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
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
						this.pluginMarketplaceStore.setUpload({ uploading: false });
						this.pluginVersionStore.setCreating(false);
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
			tap(() => {
				this.pluginVersionStore.setUpdating(true);
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
					finalize(() => this.pluginVersionStore.setUpdating(false)),
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
			tap(() => {
				this.pluginVersionStore.setDeleting(true);
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
					finalize(() => this.pluginVersionStore.setDeleting(false)),
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
			tap(() => {
				this.pluginVersionStore.setRestoring(true);
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
					finalize(() => this.pluginVersionStore.setRestoring(false))
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
}
