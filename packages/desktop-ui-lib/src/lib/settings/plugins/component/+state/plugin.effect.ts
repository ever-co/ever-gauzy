import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, EMPTY, filter, finalize, from, switchMap, tap } from 'rxjs';
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
			switchMap(() =>
				from(this.pluginService.plugins).pipe(
					tap((plugins) => this.pluginStore.update({ plugins })),
					finalize(() => this.pluginStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	getOnePlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.getPlugin),
			tap(() => this.pluginStore.setLoading(true)), // Start loading state
			switchMap(({ name }) =>
				from(this.pluginService.plugin(name)).pipe(
					filter(Boolean), // Filter out null or undefined responses
					tap((plugin) => this.pluginStore.update({ plugin })),
					finalize(() => this.pluginStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error); // Handle the error
						return EMPTY; // Return a fallback value to keep the stream alive
					})
				)
			)
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

	private handleProgress(arg: { message?: string }): void {
		this.toastrService.success(arg?.message);
		this.action$.dispatch(PluginActions.selectPlugin(null));
		this.action$.dispatch(PluginActions.refresh());
	}
}
