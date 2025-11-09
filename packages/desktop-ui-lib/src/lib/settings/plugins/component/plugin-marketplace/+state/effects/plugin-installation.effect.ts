import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, concatMap, finalize, from, map, of, switchMap, tap } from 'rxjs';
import { PluginActions } from '../../../+state/plugin.action';
import { ToastrNotificationService } from '../../../../../../services';
import {
	ActivatePluginCommand,
	CompleteInstallationCommand,
	DownloadPluginCommand,
	ServerInstallPluginCommand
} from '../../../../domain/commands';
import { PluginElectronService } from '../../../../services/plugin-electron.service';
import { PluginService } from '../../../../services/plugin.service';
import { PluginInstallationActions } from '../actions/plugin-installation.action';
import { PluginInstallationQuery } from '../queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';
import { PluginInstallationStore } from '../stores/plugin-installation.store';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';

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
		private readonly translateService: TranslateService,
		private readonly downloadCommand: DownloadPluginCommand,
		private readonly serverInstallCommand: ServerInstallPluginCommand,
		private readonly completeInstallCommand: CompleteInstallationCommand,
		private readonly activateCommand: ActivatePluginCommand
	) {}

	/**
	 * Main installation orchestrator
	 * Dispatches granular actions to trigger step-by-step effects
	 * Following Single Responsibility: Only coordinates action dispatching
	 */
	install$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.install),
				map(({ config }) => {
					this.pluginInstallationStore.update({ installing: true, error: null });
					// Dispatch download start action to trigger download effect
					return PluginInstallationActions.startDownload(config);
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Step 1: Download Effect
	 * Single Responsibility: Only handles plugin download
	 */
	downloadPlugin$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.startDownload),
				tap(() => this.pluginInstallationStore.update({ downloading: true })),
				switchMap(({ config }) =>
					this.downloadCommand.execute({ config }).pipe(
						tap(({ message }) => {
							this.toastrService.info(
								message || this.translateService.instant('PLUGIN.TOASTR.INFO.DOWNLOAD_COMPLETED')
							);
						}),
						map(({ plugin, message }) => PluginInstallationActions.downloadCompleted(plugin, message)),
						finalize(() => this.pluginInstallationStore.update({ downloading: false })),
						catchError((error) =>
							of(PluginInstallationActions.downloadFailed(error?.message || 'Download failed'))
						)
					)
				)
			),
		{
			dispatch: true
		}
	);

	/**
	 * Step 2: Server Installation Effect
	 * Single Responsibility: Only handles server-side installation
	 */
	serverInstallPlugin$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.downloadCompleted),
				map(({ plugin }) => {
					const { marketplaceId: pluginId, versionId } = plugin || {};
					if (pluginId && versionId) {
						return PluginInstallationActions.startServerInstallation(pluginId, versionId);
					} else {
						return PluginInstallationActions.downloadFailed(
							this.translateService.instant('PLUGIN.TOASTR.ERROR.INVALID_PLUGIN_DATA')
						);
					}
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Execute server installation
	 */
	executeServerInstallation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.startServerInstallation),
				tap(() => this.pluginInstallationStore.update({ serverInstalling: true })),
				switchMap(({ pluginId, versionId }) =>
					this.serverInstallCommand.execute({ pluginId, versionId }).pipe(
						tap(({ installationId }) => {
							this.pluginInstallationStore.addPendingInstallation(pluginId, installationId, versionId);
							this.toastrService.info(
								this.translateService.instant('PLUGIN.TOASTR.INFO.SERVER_INSTALLATION_COMPLETED')
							);
						}),
						map(({ installationId }) =>
							PluginInstallationActions.serverInstallationCompleted(installationId, pluginId)
						),
						finalize(() => this.pluginInstallationStore.update({ serverInstalling: false })),
						catchError((error) =>
							of(
								PluginInstallationActions.serverInstallationFailed(
									error?.message || 'Server installation failed'
								)
							)
						)
					)
				)
			),
		{
			dispatch: true
		}
	);

	/**
	 * Step 3: Complete Installation Effect
	 * Single Responsibility: Only handles installation completion
	 */
	startCompleteInstallation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.serverInstallationCompleted),
				map(({ installationId, pluginId }) =>
					PluginInstallationActions.startCompleteInstallation(pluginId, installationId)
				)
			),
		{
			dispatch: true
		}
	);

	/**
	 * Execute installation completion
	 */
	executeCompleteInstallation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.startCompleteInstallation),
				tap(() => this.pluginInstallationStore.update({ completingInstallation: true })),
				switchMap(({ marketplaceId, installationId }) =>
					this.completeInstallCommand.execute({ marketplaceId, installationId }).pipe(
						tap(() => {
							this.pluginInstallationStore.removePendingInstallation(marketplaceId);
							this.updatePluginAsInstalled(marketplaceId);
							this.toastrService.success(
								this.translateService.instant('PLUGIN.TOASTR.SUCCESS.INSTALLATION_COMPLETED')
							);
						}),
						map(() => {
							return PluginInstallationActions.installationCompleted(marketplaceId);
						}),
						finalize(() =>
							this.pluginInstallationStore.update({ completingInstallation: false, installing: false })
						),
						catchError((error) =>
							of(
								PluginInstallationActions.installationFailed(
									error?.message ||
										this.translateService.instant('PLUGIN.TOASTR.ERROR.COMPLETE_INSTALLATION')
								)
							)
						)
					)
				)
			),
		{
			dispatch: true
		}
	);

	/**
	 * Step 4: Activation Effect
	 * Single Responsibility: Only handles plugin activation
	 */
	startActivation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.installationCompleted),
				switchMap(({ marketplaceId }) =>
					from(this.pluginElectronService.checkInstallation(marketplaceId)).pipe(
						tap(() => {
							this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.ACTIVATING'));
						}),
						map((installedPlugin) =>
							PluginInstallationActions.startActivation(
								installedPlugin.installationId,
								installedPlugin.marketplaceId
							)
						),
						catchError((error) =>
							of(
								PluginInstallationActions.activationFailed(
									error?.message || 'Failed to find installed plugin'
								)
							)
						)
					)
				)
			),
		{
			dispatch: true
		}
	);

	/**
	 * Execute plugin activation
	 */
	executeActivation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.startActivation),
				tap(() => this.pluginInstallationStore.update({ activating: true })),
				switchMap(({ installationId, marketplaceId }) => {
					return this.activateCommand.execute({ marketplaceId, installationId }).pipe(
						tap(({ message }) => {
							this.toastrService.success(
								message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.ACTIVATION_COMPLETED')
							);
						}),
						map(({ plugin, message }) => PluginInstallationActions.activationCompleted(plugin, message)),
						finalize(() => this.pluginInstallationStore.update({ activating: false, installing: false })),
						catchError((error) =>
							of(PluginInstallationActions.activationFailed(error?.message || 'Activation failed'))
						)
					);
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Finalize installation after successful activation
	 */
	finalizeInstallation$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.activationCompleted),
				concatMap(() => {
					this.handleSuccess();
					return [PluginActions.selectPlugin(null), PluginActions.refresh()];
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Handle download failures
	 */
	handleDownloadFailure$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.downloadFailed),
			tap(({ error }) => {
				this.pluginInstallationStore.update({
					installing: false,
					downloading: false,
					error
				});
				this.pluginInstallationStore.setToggle({ isChecked: false });
				this.toastrService.error(error || this.translateService.instant('PLUGIN.TOASTR.ERROR.DOWNLOAD_FAILED'));
			})
		)
	);

	/**
	 * Handle server installation failures with rollback
	 */
	handleServerInstallationFailure$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.serverInstallationFailed),
			tap(({ error }) => {
				this.pluginInstallationStore.update({
					installing: false,
					serverInstalling: false,
					error
				});
				this.pluginInstallationStore.setToggle({ isChecked: false });
				this.toastrService.error(
					error || this.translateService.instant('PLUGIN.TOASTR.ERROR.SERVER_INSTALLATION_FAILED')
				);

				// Trigger rollback - find the downloaded plugin and remove it
				const currentPluginId = this.pluginInstallationStore.getValue().currentPluginId;
				if (currentPluginId) {
					this.revertFailedInstallation(currentPluginId);
				}
			})
		)
	);

	/**
	 * Handle installation completion failures
	 */
	handleInstallationFailure$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.installationFailed),
			tap(({ error }) => {
				this.pluginInstallationStore.update({
					installing: false,
					completingInstallation: false,
					error
				});
				this.pluginInstallationStore.setToggle({ isChecked: false });
				this.toastrService.error(
					error || this.translateService.instant('PLUGIN.TOASTR.ERROR.INSTALLATION_FAILED')
				);
			})
		)
	);

	/**
	 * Handle activation failures
	 */
	handleActivationFailure$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.activationFailed),
			tap(({ error }) => {
				this.pluginInstallationStore.update({
					installing: false,
					activating: false,
					error
				});
				this.toastrService.error(
					error || this.translateService.instant('PLUGIN.TOASTR.ERROR.ACTIVATION_FAILED')
				);
			})
		)
	);

	/**
	 * Clear error state
	 */
	clearError$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.clearError),
			tap(() => {
				this.pluginInstallationStore.update({ error: null });
			})
		)
	);

	/**
	 * Reset installation state
	 */
	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.reset),
			tap(() => {
				this.pluginInstallationStore.update({
					downloading: false,
					installing: false,
					serverInstalling: false,
					completingInstallation: false,
					activating: false,
					uninstalling: false,
					deactivating: false,
					currentPluginId: null,
					currentInstallationId: null,
					error: null
				});
			})
		)
	);

	/**
	 * Effect for uninstallation
	 * Single Responsibility: Only handles plugin uninstallation
	 */
	uninstall$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.uninstall),
				tap(() => this.pluginInstallationStore.update({ uninstalling: true })),
				concatMap(({ plugin }) => {
					this.pluginElectronService.uninstall(plugin);
					return this.pluginElectronService
						.progress((message) => this.toastrService.info(message))
						.pipe(
							switchMap(({ message }) => {
								const { marketplaceId: pluginId, installationId } = plugin || {};

								if (!pluginId) {
									this.toastrService.success(
										message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED')
									);
									return of(PluginActions.refresh());
								}

								// Handle server-side uninstallation
								return this.pluginService
									.uninstall(pluginId, installationId, 'User initiated uninstall')
									.pipe(
										tap(() => {
											const plugins = this.pluginMarketplaceQuery.plugins;
											const existingPluginIndex = plugins.findIndex((p) => p.id === pluginId);

											let foundPlugin =
												plugins[existingPluginIndex] || this.pluginInstallationQuery.plugin;

											if (!foundPlugin) {
												this.toastrService.info(
													this.translateService.instant(
														'PLUGIN.TOASTR.WARNING.PLUGIN_NOT_FOUND',
														{
															id: pluginId
														}
													)
												);
												return;
											}

											// Clean up any pending installation
											this.pluginInstallationStore.removePendingInstallation(pluginId);

											// Update plugin state
											const updatedPlugin = { ...foundPlugin, installed: false };
											const updatedPlugins = [...plugins];
											if (existingPluginIndex !== -1) {
												updatedPlugins[existingPluginIndex] = updatedPlugin;
											}

											this.pluginMarketplaceStore.update({
												plugins: updatedPlugins,
												plugin: updatedPlugin
											});
											this.pluginInstallationStore.setToggle({ isChecked: false });
											this.toastrService.success(
												message ||
													this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED')
											);
										}),
										map(() => PluginActions.refresh()),
										catchError((error) => {
											this.pluginInstallationStore.setToggle({ isChecked: true });
											this.toastrService.error(
												error?.message ||
													this.translateService.instant(
														'PLUGIN.TOASTR.ERROR.UNINSTALL_FAILED'
													)
											);
											return EMPTY;
										})
									);
							}),
							finalize(() => this.pluginInstallationStore.update({ uninstalling: false })),
							catchError((error) => {
								this.toastrService.error(
									error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL')
								);
								return EMPTY;
							})
						);
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Effect for toggling plugin state in UI
	 */
	toggle$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.toggle),
			tap(({ isChecked, plugin }) => {
				this.pluginInstallationStore.setToggle({ isChecked, plugin });
			})
		)
	);

	/**
	 * Helper: Update plugin state as installed
	 */
	private updatePluginAsInstalled(pluginId: string): void {
		this.pluginMarketplaceStore.update((state) => {
			const existingPluginIndex = state.plugins.findIndex((p) => p.id === pluginId);
			if (existingPluginIndex === -1) return state;

			const updatedPlugins = [...state.plugins];
			updatedPlugins[existingPluginIndex] = {
				...updatedPlugins[existingPluginIndex],
				installed: true
			};

			return {
				...state,
				plugins: updatedPlugins,
				plugin: updatedPlugins[existingPluginIndex]
			};
		});
	}

	/**
	 * Helper: Handle successful operation
	 */
	private handleSuccess(message?: string): void {
		if (message) this.toastrService.success(message);
		this.pluginInstallationStore.update({ error: null });
	}

	/**
	 * Helper: Revert failed installation by uninstalling
	 */
	private async revertFailedInstallation(pluginId: string) {
		try {
			const plugin = await this.pluginElectronService.checkInstallation(pluginId);
			if (plugin) {
				this.pluginElectronService.uninstall(plugin);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.REVERTING_INSTALLATION'));
			}
		} catch (err) {
			// Plugin might not be installed yet, ignore the error
			console.warn('Could not revert installation:', err);
		}
	}
}
