import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, EMPTY, filter, finalize, from, map, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PluginService } from '../../services/plugin.service';
import { PluginActions } from './plugin.action';
import { PluginStore } from './plugin.store';

@Injectable({ providedIn: 'root' })
export class PluginEffects {
	constructor(
		private readonly pluginStore: PluginStore,
		private readonly action$: Actions,
		private readonly pluginElectronService: PluginElectronService,
		private readonly pluginService: PluginService,
		private readonly toastrService: ToastrNotificationService
	) {}

	getAllPlugins$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginActions.getPlugins),
				tap(() => this.pluginStore.setLoading(true)), // Start loading state
				switchMap(() =>
					from(this.pluginElectronService.plugins).pipe(
						map((plugins) => PluginActions.getPluginsSuccess(plugins)),
						finalize(() => this.pluginStore.setLoading(false)), // Always stop loading
						catchError((error) => {
							this.toastrService.error(error); // Handle error properly
							return EMPTY; // Return a fallback observable
						})
					)
				)
			),
		{ dispatch: true }
	);

	getAllPluginsSuccess$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.getPluginsSuccess),
			tap(({ plugins }) => {
				this.pluginStore.update({ plugins });
			}),
			catchError((error) => {
				this.toastrService.error(error);
				return EMPTY;
			})
		)
	);

	getOnePlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginActions.getPlugin),
			tap(() => this.pluginStore.setLoading(true)), // Start loading state
			switchMap(({ name }) =>
				from(this.pluginElectronService.plugin(name)).pipe(
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
				// First check with server-side to validate plugin can be activated
				return this.pluginService.activate(plugin.marketplaceId, plugin.installationId).pipe(
					switchMap(() => {
						// If server validation passes, proceed with local activation
						this.pluginElectronService.activate(plugin);
						return this.pluginElectronService
							.progress((message) => this.toastrService.info(message))
							.pipe(
								tap((res) => this.handleProgress(res)),
								finalize(() => this.pluginStore.update({ activating: false })),
								catchError((error) => {
									this.toastrService.error(error);
									return EMPTY;
								})
							);
					}),
					catchError((error) => {
						this.toastrService.error(
							error?.error?.message || error?.message || 'Failed to activate plugin on server'
						);
						this.pluginStore.update({ activating: false });
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
				// First check with server-side to validate plugin can be deactivated
				return this.pluginService.deactivate(plugin.marketplaceId, plugin.installationId).pipe(
					switchMap(() => {
						// If server validation passes, proceed with local deactivation
						this.pluginElectronService.deactivate(plugin);
						return this.pluginElectronService
							.progress((message) => this.toastrService.info(message))
							.pipe(
								tap((res) => this.handleProgress(res)),
								finalize(() => this.pluginStore.update({ deactivating: false })),
								catchError((error) => {
									this.toastrService.error(error);
									return EMPTY;
								})
							);
					}),
					catchError((error) => {
						this.toastrService.error(
							error?.error?.message || error?.message || 'Failed to deactivate plugin on server'
						);
						this.pluginStore.update({ deactivating: false });
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
			switchMap(() => this.pluginElectronService.plugins),
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
