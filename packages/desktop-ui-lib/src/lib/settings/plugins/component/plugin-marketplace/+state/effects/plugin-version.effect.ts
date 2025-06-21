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
			tap(() => this.pluginVersionStore.setLoading(true)), // Start loading state
			switchMap(({ pluginId, params = {} }) =>
				this.pluginService.getVersions(pluginId, params).pipe(
					tap(({ items, total }) => {
						this.pluginVersionStore.update((state) => ({
							versions: [
								...new Map([...state.versions, ...items].map((item) => [item.id, item])).values()
							],
							count: total
						}));
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
				this.pluginVersionStore.update({ creating: true });
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.ADDING'));
			}),
			switchMap(({ pluginId, version }) =>
				this.pluginService.addVersion(pluginId, version).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.version)), // Filter out null or undefined responses
					map((res) => res.version),
					tap((created) => {
						this.pluginVersionStore.update((state) => ({
							version: created,
							versions: [created, ...state.versions],
							count: state.count + 1
						}));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.CREATED', {
								number: created.number
							})
						);
					}),
					finalize(() => {
						this.pluginMarketplaceStore.setUpload({ uploading: false });
						this.pluginVersionStore.update({ creating: false });
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
				this.pluginVersionStore.update({ updating: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.UPDATING'));
			}),
			switchMap(({ pluginId, versionId, version }) =>
				this.pluginService.updateVersion(pluginId, versionId, version).pipe(
					tap((version) => {
						this.pluginVersionStore.update((state) => {
							const index = state.versions.findIndex((v) => v.id === version.id);
							const versions = [...state.versions]; // Shallow copy

							if (index >= 0) {
								versions[index] = version; // In-place update
							} else {
								versions.unshift(version); // Append if new
							}

							return { versions, version };
						});
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.UPDATED', {
								number: version.number
							})
						);
					}),
					finalize(() => this.pluginVersionStore.update({ updating: false })),
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
				this.pluginVersionStore.update({ deleting: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.DELETING'));
			}),
			mergeMap(({ pluginId, versionId }) =>
				this.pluginService.deleteVersion(pluginId, versionId).pipe(
					tap(() => {
						const deletedAt = new Date();
						this.pluginVersionStore.update((state) => ({
							version: state.version && { ...state.version, deletedAt },
							versions: [
								...state.versions.map((version) =>
									version.id === versionId ? { ...version, deletedAt } : version
								)
							],
							count: state.count - 1
						}));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.DELETED')
						);
					}),
					finalize(() => this.pluginVersionStore.update({ deleting: false })),
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
				this.pluginVersionStore.update({ restoring: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.VERSION.RESTORING'));
			}),
			mergeMap(({ pluginId, versionId }) =>
				this.pluginService.restoreVersion(pluginId, versionId).pipe(
					tap(() => {
						this.pluginVersionStore.update((state) => ({
							version:
								state.version?.id === versionId ? { ...state.version, deletedAt: null } : state.version,
							versions: state.versions.map((version) =>
								version.id === versionId ? { ...version, deletedAt: null } : version
							)
						}));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.TOASTR.SUCCESS.VERSION.RESTORED')
						);
					}),
					catchError((error) => {
						console.error('Restore failed:', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.VERSION.RESTORE'));
						return EMPTY;
					}),
					finalize(() => this.pluginVersionStore.update({ restoring: false }))
				)
			)
		)
	);

	setCurrentPluginId$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.setCurrentPluginId),
			tap(({ pluginId }) => {
				this.pluginVersionStore.update({ pluginId });
			})
		)
	);

	selectVersion$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.selectVersion),
			tap(({ version }) => {
				this.pluginVersionStore.update({ version, pluginId: version.pluginId });
			})
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginVersionActions.reset),
			tap(() =>
				this.pluginVersionStore.update({
					versions: []
				})
			)
		)
	);
}
