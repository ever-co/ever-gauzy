import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, concatMap, EMPTY, filter, finalize, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PluginActions } from './plugin.action';
import { PluginStore } from './plugin.store';

@Injectable({ providedIn: 'root' })
export class PluginEffects {
	constructor(
		private readonly pluginStore: PluginStore,
		private readonly action$: Actions,
		private readonly pluginService: PluginElectronService,
		private readonly toastrService: ToastrNotificationService
	) {}

	getAllPlugins$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.getPlugins),
			tap(() => this.pluginStore.setLoading(true)), // Start loading state
			switchMap(() => this.pluginService.plugins),
			tap((plugins) => this.pluginStore.update({ plugins })),
			finalize(() => this.pluginStore.setLoading(false)), // Always stop loading
			catchError((error) => {
				this.toastrService.error(error); // Handle error properly
				return EMPTY; // Return a fallback observable
			})
		)
	);

	getOnePlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.getPlugin),
			tap(() => this.pluginStore.setLoading(true)), // Start loading state
			switchMap(({ name }) => this.pluginService.plugin(name)),
			filter(Boolean), // Filter out null or undefined responses
			tap((plugin) => this.pluginStore.update({ plugin })),
			finalize(() => this.pluginStore.setLoading(false)), // Always stop loading
			catchError((error) => {
				this.toastrService.error(error); // Handle the error
				return EMPTY; // Return a fallback value to keep the stream alive
			})
		)
	);

	uninstall$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.uninstall),
			tap(() => this.pluginStore.update({ uninstalling: true })),
			concatMap(({ plugin }) => {
				this.pluginService.uninstall(plugin);
				return this.pluginService
					.progress((message) => this.toastrService.info(message))
					.pipe(
						tap((res) => this.handleProgress(res)),
						finalize(() => this.pluginStore.update({ uninstalling: false })),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					);
			})
		)
	);

	install$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.install),
			tap(() => this.pluginStore.update({ installing: true })),
			concatMap(({ config }) => {
				this.pluginService.downloadAndInstall(config);
				return this.pluginService
					.progress((message) => this.toastrService.info(message))
					.pipe(
						tap((res) => this.handleProgress(res)),
						finalize(() => this.pluginStore.update({ installing: false })),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					);
			})
		)
	);

	activate$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.activate),
			tap(() => this.pluginStore.update({ activating: true })),
			switchMap(({ plugin }) => {
				this.pluginService.activate(plugin);
				return this.pluginService
					.progress((message) => this.toastrService.info(message))
					.pipe(
						tap((res) => this.handleProgress(res)),
						finalize(() => this.pluginStore.update({ activating: false })),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					);
			})
		)
	);

	deactivate$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.deactivate),
			tap(() => this.pluginStore.update({ deactivating: true })),
			switchMap(({ plugin }) => {
				this.pluginService.deactivate(plugin);
				return this.pluginService
					.progress((message) => this.toastrService.info(message))
					.pipe(
						tap((res) => this.handleProgress(res)),
						finalize(() => this.pluginStore.update({ deactivating: false })),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					);
			})
		)
	);

	selectPlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.selectPlugin),
			tap(({ plugin }) => {
				this.pluginStore.update({ plugin });
			}),
			catchError((error) => {
				this.toastrService.error(error);
				return EMPTY;
			})
		)
	);

	refresh$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.refresh),
			switchMap(() => this.pluginService.plugins),
			tap((plugins) => this.pluginStore.update({ plugins })),
			catchError((error) => {
				this.toastrService.error(error);
				return EMPTY;
			})
		)
	);

	private handleProgress(message?: string): void {
		this.toastrService.success(message);
		this.action$.dispatch(PluginActions.selectPlugin(null));
		this.action$.dispatch(PluginActions.refresh());
	}
}
