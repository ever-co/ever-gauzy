import { Injectable } from '@angular/core';
import { ID, IPluginSource, IPluginVersion, PluginSourceType } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import {
	EMPTY,
	Observable,
	catchError,
	concatMap,
	exhaustMap,
	finalize,
	from,
	map,
	of,
	switchMap,
	take,
	tap
} from 'rxjs';
import { PluginActions } from '../../../+state/plugin.action';
import { AlertComponent } from '../../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../../services';
import {
	ActivatePluginCommand,
	CompleteInstallationCommand,
	DownloadPluginCommand,
	ServerInstallPluginCommand
} from '../../../../domain/commands';
import { PluginElectronService } from '../../../../services/plugin-electron.service';
import { PluginEnvironmentService } from '../../../../services/plugin-environment.service';
import { PluginService } from '../../../../services/plugin.service';
import { DialogInstallationValidationComponent } from '../../plugin-marketplace-item/dialog-installation-validation/dialog-installation-validation.component';
import { InstallationValidationChainBuilder } from '../../services';
import { PluginInstallationActions } from '../actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginSubscriptionActions } from '../actions/plugin-subscription.action';
import { PluginToggleActions } from '../actions/plugin-toggle.action';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';
import { PluginInstallationStore } from '../stores/plugin-installation.store';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginToggleStore } from '../stores/plugin-toggle.store';

@Injectable({ providedIn: 'root' })
export class PluginInstallationEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginMarketplaceQuery: PluginMarketplaceQuery,
		private readonly pluginInstallationStore: PluginInstallationStore,
		private readonly pluginToggleStore: PluginToggleStore,
		private readonly pluginService: PluginService,
		private readonly pluginElectronService: PluginElectronService,
		private readonly environmentService: PluginEnvironmentService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly downloadCommand: DownloadPluginCommand,
		private readonly serverInstallCommand: ServerInstallPluginCommand,
		private readonly completeInstallCommand: CompleteInstallationCommand,
		private readonly activateCommand: ActivatePluginCommand,
		private readonly dialogService: NbDialogService,
		private readonly installationValidationChainBuilder: InstallationValidationChainBuilder
	) {}

	/**
	 * Handle install requests coming from marketplace actions.
	 * Moves validation and dialog orchestration out of components into effects.
	 *
	 * Flow:
	 * 1. Enable toggle optimistically
	 * 2. Validate installation requirements
	 * 3. Show confirmation dialog if valid
	 * 4. Dispatch appropriate installation action based on source type
	 *
	 * Uses exhaustMap to prevent concurrent installations of the same plugin.
	 */
	installFromMarketplace$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.install),
				// Prevent concurrent installations - exhaust until current completes
				exhaustMap(({ plugin, isUpdate }) => {
					// Optimistically enable toggle after environment passes
					this.pluginToggleStore.setToggle(plugin.id, true);

					return this.installationValidationChainBuilder.canProceedWithInstallation(plugin, isUpdate).pipe(
						// Flatten validation result into dialog flow
						switchMap((canProceed) => {
							// Early exit if validation fails
							if (!canProceed) {
								return of(
									PluginSubscriptionActions.openSubscriptionManagement(plugin),
									PluginToggleActions.toggle({ pluginId: plugin.id, enabled: false })
								);
							}

							// Environment validation at effect level (web/mobile/desktop)
							if (!this.environmentService.canInstallPlugin(plugin)) {
								this.environmentService.notifyEnvironmentMismatch(plugin);
								return of(PluginToggleActions.toggle({ pluginId: plugin.id, enabled: false }));
							}

							// Open confirmation dialog and wait for user decision
							return this.openInstallationDialog(plugin.id).pipe(
								// Map dialog result to installation action or cancellation
								switchMap((dialogResult) => {
									// User cancelled - disable toggle
									if (!dialogResult) {
										return of(PluginToggleActions.toggle({ pluginId: plugin.id, enabled: false }));
									}

									// User confirmed - dispatch source-specific installation
									const action = this.sourceInstallAction(
										plugin.id,
										dialogResult.version,
										dialogResult.source,
										dialogResult.authToken
									);
									return of(action);
								})
							);
						}),
						// Handle validation or dialog errors gracefully
						catchError((error) => {
							console.error('Installation flow error:', error);
							this.toastrService.error(
								this.translateService.instant('PLUGIN.TOASTR.ERROR.INSTALLATION_FLOW_FAILED')
							);
							return of(PluginToggleActions.toggle({ pluginId: plugin.id, enabled: false }));
						})
					);
				})
			),
		{ dispatch: true }
	);

	/**
	 * Opens installation confirmation dialog and returns the result.
	 * Extracted for better testability and separation of concerns.
	 */
	private openInstallationDialog(pluginId: string): Observable<{
		version: IPluginVersion;
		source: IPluginSource;
		authToken?: string;
	} | null> {
		const dialogRef = this.dialogService.open(DialogInstallationValidationComponent, {
			context: { pluginId },
			backdropClass: 'backdrop-blur'
		});

		// Dialog already manages its own lifecycle, but we ensure single emission
		return dialogRef.onClose.pipe(take(1));
	}

	private sourceInstallAction(pluginId: string, version: IPluginVersion, source: IPluginSource, authToken?: string) {
		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				return PluginInstallationActions.install({
					contextType: 'cdn',
					marketplaceId: pluginId,
					versionId: version.id,
					url: source.url
				});

			case PluginSourceType.NPM:
				return PluginInstallationActions.install({
					contextType: 'npm',
					marketplaceId: pluginId,
					versionId: version.id,
					pkg: {
						name: source.name,
						version: version.number
					},
					registry: {
						privateURL: source.registry,
						authToken
					}
				});

			default:
				return PluginToggleActions.toggle({ pluginId, enabled: false });
		}
	}

	installUpdate$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.installUpdate),
				map(({ plugin }) => PluginMarketplaceActions.install(plugin, true))
			),
		{ dispatch: true }
	);

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
					const pluginId = config?.['marketplaceId'];
					if (pluginId) {
						this.pluginInstallationStore.setInstalling(pluginId, true);
						this.pluginInstallationStore.setErrorMessage(pluginId, null);
					}
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
				tap(({ config }) => {
					const pluginId = config?.['marketplaceId'];
					if (pluginId) {
						this.pluginInstallationStore.setDownloading(pluginId, true);
					}
				}),
				switchMap(({ config }) =>
					this.downloadCommand.execute({ config }).pipe(
						tap(({ message }) => {
							this.toastrService.info(
								message || this.translateService.instant('PLUGIN.TOASTR.INFO.DOWNLOAD_COMPLETED')
							);
						}),
						map(({ plugin, message }) => PluginInstallationActions.downloadCompleted(plugin, message)),
						finalize(() => {
							const pluginId = config?.['marketplaceId'];
							if (pluginId) {
								this.pluginInstallationStore.setDownloading(pluginId, false);
							}
						}),
						catchError((error) => {
							const pluginId = config?.['marketplaceId'];
							return of(
								PluginInstallationActions.downloadFailed(error?.message || 'Download failed', pluginId)
							);
						})
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
				tap(({ pluginId }) => this.pluginInstallationStore.setServerInstalling(pluginId, true)),
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
						finalize(() => this.pluginInstallationStore.setServerInstalling(pluginId, false)),
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
				tap(({ marketplaceId }) => this.pluginInstallationStore.setCompletingInstallation(marketplaceId, true)),
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
						finalize(() => {
							this.pluginInstallationStore.setCompletingInstallation(marketplaceId, false);
							this.pluginInstallationStore.setInstalling(marketplaceId, false);
						}),
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
				tap(({ marketplaceId }) => this.pluginInstallationStore.setActivating(marketplaceId, true)),
				switchMap(({ installationId, marketplaceId }) => {
					return this.activateCommand.execute({ marketplaceId, installationId }).pipe(
						tap(({ message }) => {
							this.toastrService.success(
								message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.ACTIVATION_COMPLETED')
							);
						}),
						map(({ plugin, message }) => PluginInstallationActions.activationCompleted(plugin, message)),
						finalize(() => {
							this.pluginInstallationStore.setActivating(marketplaceId, false);
							this.pluginInstallationStore.setInstalling(marketplaceId, false);
						}),
						catchError((error) =>
							of(
								PluginInstallationActions.activationFailed(
									error?.message || 'Activation failed',
									marketplaceId
								)
							)
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
				concatMap(({ plugin: { marketplaceId } }) => {
					this.handleSuccess('Installation done', marketplaceId);
					return [
						PluginToggleActions.toggle({ pluginId: marketplaceId, enabled: true }),
						PluginActions.selectPlugin(null),
						PluginActions.refresh()
					];
				})
			),
		{
			dispatch: true
		}
	);

	/**
	 * Handle download failures
	 */
	handleDownloadFailure$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.downloadFailed),
				concatMap(({ error, pluginId }) => {
					if (pluginId) {
						this.pluginInstallationStore.setInstalling(pluginId, false);
						this.pluginInstallationStore.setDownloading(pluginId, false);
						this.pluginInstallationStore.setErrorMessage(pluginId, error);
					}
					this.toastrService.error(
						error || this.translateService.instant('PLUGIN.TOASTR.ERROR.DOWNLOAD_FAILED')
					);
					return pluginId
						? of(
								PluginToggleActions.toggle({
									pluginId,
									enabled: false
								})
						  )
						: EMPTY;
				})
			),
		{ dispatch: true }
	);

	/**
	 * Handle server installation failures with rollback
	 */
	handleServerInstallationFailure$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.serverInstallationFailed),
				concatMap(({ error, pluginId }) => {
					if (pluginId) {
						this.pluginInstallationStore.setInstalling(pluginId, false);
						this.pluginInstallationStore.setServerInstalling(pluginId, false);
						this.pluginInstallationStore.setErrorMessage(pluginId, error);
						// Trigger rollback - find the downloaded plugin and remove it
						this.revertFailedInstallation(pluginId);
					}
					this.toastrService.error(
						error || this.translateService.instant('PLUGIN.TOASTR.ERROR.SERVER_INSTALLATION_FAILED')
					);

					return pluginId
						? of(
								PluginToggleActions.toggle({
									pluginId,
									enabled: false
								})
						  )
						: EMPTY;
				})
			),
		{ dispatch: true }
	);

	/**
	 * Handle installation completion failures
	 */
	handleInstallationFailure$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.installationFailed),
				concatMap(({ error, pluginId }) => {
					if (pluginId) {
						this.pluginInstallationStore.setInstalling(pluginId, false);
						this.pluginInstallationStore.setCompletingInstallation(pluginId, false);
						this.pluginInstallationStore.setErrorMessage(pluginId, error);
					}
					this.toastrService.error(
						error || this.translateService.instant('PLUGIN.TOASTR.ERROR.INSTALLATION_FAILED')
					);

					return pluginId
						? of(
								PluginToggleActions.toggle({
									pluginId,
									enabled: false
								})
						  )
						: EMPTY;
				})
			),
		{ dispatch: true }
	);

	/**
	 * Handle activation failures
	 */
	handleActivationFailure$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.activationFailed),
				concatMap(({ error, pluginId }) => {
					if (pluginId) {
						this.pluginInstallationStore.setInstalling(pluginId, false);
						this.pluginInstallationStore.setActivating(pluginId, false);
						this.pluginInstallationStore.setErrorMessage(pluginId, error);
					}
					this.toastrService.error(
						error || this.translateService.instant('PLUGIN.TOASTR.ERROR.ACTIVATION_FAILED')
					);

					return pluginId
						? of(
								PluginToggleActions.toggle({
									pluginId,
									enabled: false
								})
						  )
						: EMPTY;
				})
			),
		{ dispatch: true }
	);

	/**
	 * Clear error state
	 */
	clearError$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.clearError),
				concatMap(({ pluginId }) => {
					if (pluginId) {
						this.pluginInstallationStore.setErrorMessage(pluginId, null);
					}
					return of(PluginActions.refresh());
				})
			),
		{ dispatch: true }
	);

	/**
	 * Reset installation state
	 */
	reset$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.reset),
				tap(({ pluginId }) => {
					this.pluginInstallationStore.resetStates(pluginId);
				})
			),
		{ dispatch: false }
	);

	/**
	 * Effect for uninstallation
	 * Single Responsibility: Only handles plugin uninstallation
	 */
	uninstall$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.uninstall),
				// Immediately disable the plugin toggle
				tap(({ pluginId }) => this.pluginToggleStore.setToggle(pluginId, false)),
				// Prevent concurrent uninstall flows
				exhaustMap(({ pluginId, installedId }) =>
					this.confirmUninstall().pipe(
						switchMap((confirmed) => {
							if (!confirmed) {
								return of(
									PluginToggleActions.toggle({
										pluginId,
										enabled: true
									})
								);
							}

							// Begin uninstall
							this.pluginInstallationStore.setUninstalling(pluginId, true);

							return this.handleUninstall({ marketplaceId: pluginId, id: installedId }).pipe(
								switchMap((isUninstalled) =>
									of(
										PluginToggleActions.toggle({
											pluginId,
											enabled: !isUninstalled
										}),
										PluginActions.refresh()
									)
								),
								catchError((error) => {
									this.toastrService.error(
										error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL')
									);
									return of(
										PluginToggleActions.toggle({
											pluginId,
											enabled: true
										})
									);
								}),
								finalize(() => this.pluginInstallationStore.setUninstalling(pluginId, false))
							);
						})
					)
				)
			),
		{ dispatch: true }
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
	private handleSuccess(message?: string, pluginId?: string): void {
		if (message) this.toastrService.success(message);
		if (pluginId) {
			this.pluginInstallationStore.setErrorMessage(pluginId, null);
		}
	}

	/**
	 * Helper: Revert failed installation by uninstalling
	 */
	private async revertFailedInstallation(pluginId: string) {
		try {
			const plugin = await this.pluginElectronService.checkInstallation(pluginId);
			if (plugin) {
				this.pluginElectronService.uninstall({ marketplaceId: pluginId });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.REVERTING_INSTALLATION'));
			}
		} catch (err) {
			// Plugin might not be installed yet, ignore the error
			console.warn('Could not revert installation:', err);
		}
	}

	private confirmUninstall(): Observable<boolean> {
		return this.dialogService
			.open(AlertComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					data: {
						title: 'PLUGIN.DIALOG.UNINSTALL.TITLE',
						message: 'PLUGIN.DIALOG.UNINSTALL.DESCRIPTION',
						confirmText: 'PLUGIN.DIALOG.UNINSTALL.CONFIRM',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(take(1));
	}

	private handleUninstall(input: { marketplaceId: ID; id: ID }) {
		this.pluginElectronService.uninstall(input);

		return this.pluginElectronService
			.progress<void, ID>((msg) => this.toastrService.info(msg))
			.pipe(
				switchMap(({ message, data: installationId }) =>
					installationId
						? this.handleServerUninstall(input.marketplaceId, installationId, message)
						: this.handleLocalUninstall(message)
				)
			);
	}

	private handleLocalUninstall(message?: string): Observable<boolean> {
		this.toastrService.success(message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));
		return of(true);
	}

	private handleServerUninstall(marketplaceId: ID, installationId: ID, message?: string): Observable<boolean> {
		return this.pluginService.uninstall(marketplaceId, installationId, 'User initiated uninstall').pipe(
			tap(() => this.updateMarketplaceAfterUninstall(marketplaceId, message)),
			map(() => true),
			catchError((error) => {
				this.toastrService.error(
					error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL_FAILED')
				);
				return of(false);
			})
		);
	}

	private updateMarketplaceAfterUninstall(marketplaceId: ID, message?: string) {
		const plugins = this.pluginMarketplaceQuery.plugins;
		const idx = plugins.findIndex((p) => p.id === marketplaceId);

		let found = plugins[idx];

		if (!found) {
			this.toastrService.info(
				this.translateService.instant('PLUGIN.TOASTR.WARNING.PLUGIN_NOT_FOUND', {
					id: marketplaceId
				})
			);
			return;
		}

		this.pluginInstallationStore.removePendingInstallation(marketplaceId);

		const updated = { ...found, installed: false };
		const updatedPlugins = idx !== -1 ? [...plugins.slice(0, idx), updated, ...plugins.slice(idx + 1)] : plugins;

		this.pluginMarketplaceStore.update({
			plugins: updatedPlugins,
			plugin: updated
		});

		this.toastrService.success(message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));
	}
}
