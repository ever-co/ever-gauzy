import { Injectable } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, concatMap, finalize, of, switchMap, tap } from 'rxjs';
import { PluginActions } from '../../../+state/plugin.action';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginElectronService } from '../../../../services/plugin-electron.service';
import { IPlugin } from '../../../../services/plugin-loader.service';
import { PluginService } from '../../../../services/plugin.service';
import { PluginInstallationActions } from '../actions/plugin-installation.action';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';
import { PluginInstallationStore } from '../stores/plugin-installation.store';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginInstallationQuery } from '../queries/plugin-installation.query';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class PluginInstallationEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginMarketplaceQuery: PluginMarketplaceQuery,
		private readonly pluginInstallationStore: PluginInstallationStore,
		private readonly pluginInstallationQuery: PluginInstallationQuery,
		private readonly pluginService: PluginService,
		private readonly pluginElectronService: PluginElectronService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {}

	uninstall$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.uninstall),
			tap(() => this.pluginInstallationStore.update({ uninstalling: true })),
			concatMap(({ plugin }) => {
				this.pluginElectronService.uninstall(plugin);
				return this.pluginElectronService
					.progress((message) => this.toastrService.info(message))
					.pipe(
						switchMap(({ message }) => {
							const { marketplaceId: pluginId } = plugin || {};

							return pluginId ? this.handleUninstallation(pluginId) : of(this.handleProgress(message));
						}),
						finalize(() => this.pluginInstallationStore.update({ uninstalling: false })),
						catchError((error) => this.handleError(error))
					);
			})
		)
	);

	install$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.install),
			tap(() => this.pluginInstallationStore.update({ installing: true })),
			concatMap(({ config }) => {
				this.pluginElectronService.downloadAndInstall(config);

				return this.pluginElectronService
					.progress<void, IPlugin>((message) => this.toastrService.info(message))
					.pipe(
						switchMap(({ message, data }) => {
							const { marketplaceId: pluginId, versionId } = data || {};

							return pluginId && versionId
								? this.handlePluginInstallation(pluginId, versionId)
								: of(this.handleProgress(message));
						}),
						finalize(() => this.pluginInstallationStore.update({ installing: false })),
						catchError((error) => this.handleError(error))
					);
			})
		)
	);

	toggle$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.toggle),
			tap(({ isChecked, plugin }) => {
				this.pluginInstallationStore.setToggle({ isChecked, plugin });
			})
		)
	);

	private handlePluginInstallation(pluginId: string, versionId: string) {
		return this.pluginService.install({ pluginId, versionId }).pipe(
			tap(() => {
				this.pluginMarketplaceStore.update((state) => {
					const existingPluginIndex = state.plugins.findIndex((p) => p.id === pluginId);
					let updatedPlugins = [...state.plugins];

					let plugin = state.plugins[existingPluginIndex] || this.pluginInstallationQuery.plugin;

					if (!plugin) {
						throw new Error(
							this.translateService.instant('PLUGIN.TOASTR.ERROR.NOT_FOUND', { id: pluginId })
						);
					}

					// Ensure the plugin is marked as installed
					plugin = { ...plugin, installed: true };

					// Update the plugins list if the plugin was already in state
					if (existingPluginIndex !== -1) {
						updatedPlugins[existingPluginIndex] = plugin;
					} else {
						updatedPlugins.push(plugin);
					}

					return {
						...state,
						plugins: updatedPlugins,
						plugin
					};
				});

				this.pluginInstallationStore.setToggle({ isChecked: true });

				this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.INSTALLED'));
			}),
			catchError(async (error) => {
				this.pluginInstallationStore.setToggle({ isChecked: false });
				await this.revertFailedInstallation(pluginId);
				throw error;
			})
		);
	}

	private async revertFailedInstallation(pluginId: string) {
		try {
			const plugin = await this.pluginElectronService.checkInstallation(pluginId);
			this.pluginElectronService.uninstall(plugin);
		} catch (err) {
			this.toastrService.error(
				err?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.REVERT_INSTALLATION')
			);
		}
	}

	private handleProgress(message?: string): void {
		if (message) this.toastrService.success(message);
		this.action$.dispatch(PluginActions.selectPlugin(null));
		this.action$.dispatch(PluginActions.refresh());
	}

	private handleError(error: any) {
		const isChecked = !this.pluginInstallationQuery.checked;
		this.pluginInstallationStore.setToggle({ isChecked });
		this.toastrService.error(error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.INSTALL'));
		return EMPTY; // Ensure the stream does not break
	}

	private handleUninstallation(pluginId: ID) {
		return this.pluginService.uninstall(pluginId).pipe(
			tap(() => {
				const plugins = this.pluginMarketplaceQuery.plugins;
				const existingPluginIndex = plugins.findIndex((p) => p.id === pluginId);

				let plugin = plugins[existingPluginIndex] || this.pluginInstallationQuery.plugin;

				if (!plugin) {
					throw new Error(this.translateService.instant('PLUGIN.TOASTR.ERROR.NOT_FOUND', { id: pluginId }));
				}

				// Ensure plugin is marked as uninstalled
				const updatedPlugin = { ...plugin, installed: false };

				// Create a new plugins array with the updated plugin
				const updatedPlugins = [...plugins];
				if (existingPluginIndex !== -1) {
					updatedPlugins[existingPluginIndex] = updatedPlugin;
				}

				this.pluginMarketplaceStore.update({
					plugins: updatedPlugins,
					plugin: updatedPlugin
				});
				this.pluginInstallationStore.setToggle({ isChecked: false });
				this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));
			}),
			catchError((error) => {
				this.pluginInstallationStore.setToggle({ isChecked: true });
				throw error;
			})
		);
	}
}
