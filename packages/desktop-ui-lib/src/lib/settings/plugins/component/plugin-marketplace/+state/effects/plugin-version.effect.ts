import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, filter, finalize, mergeMap, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { PluginVersionActions } from '../actions/plugin-version.action';
import { PluginVersionStore } from '../stores/plugin-version.store';

@Injectable({ providedIn: 'root' })
export class PluginVersionEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginVersionStore: PluginVersionStore,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService
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
				this.toastrService.info('Adding new plugin version...');
			}),
			switchMap(({ pluginId, version }) =>
				this.pluginService.addVersion(pluginId, version).pipe(
					filter(Boolean), // Filter out null or undefined responses
					tap((version) => {
						this.pluginVersionStore.update({
							version
						});
						this.toastrService.success(`Create plugin version v${version.number} successfully!`);
					}),
					finalize(() => this.pluginVersionStore.update({ creating: false })), // Always stop loading
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
				this.toastrService.info('Updating plugin version...');
			}),
			switchMap(({ pluginId, versionId, version }) =>
				this.pluginService.updateVersion(pluginId, versionId, version).pipe(
					tap((version) => {
						this.pluginVersionStore.update((state) => ({
							versions: [
								...new Map([...state.versions, version].map((item) => [item.id, item])).values()
							],
							version
						}));
						this.toastrService.success('Update plugin version successfully!');
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
				this.toastrService.info('Deleting plugin version...');
			}),
			mergeMap(({ pluginId, versionId }) =>
				this.pluginService.deleteVersion(pluginId, versionId).pipe(
					tap(() => {
						this.pluginVersionStore.update((state) => ({
							version: state.version && { ...state.version, deletedAt: new Date() },
							versions: [
								...state.versions.map((version) =>
									version.id === versionId ? { ...version, deletedAt: new Date() } : version
								)
							]
						}));
						this.toastrService.success('Delete plugin version successfully!');
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
				this.toastrService.info('Restoring plugin version...');
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
						this.toastrService.success('Plugin version restored successfully!');
					}),
					catchError((error) => {
						console.error('Restore failed:', error);
						this.toastrService.error('Failed to restore plugin version. Please try again.');
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
				this.pluginVersionStore.update({ version });
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
