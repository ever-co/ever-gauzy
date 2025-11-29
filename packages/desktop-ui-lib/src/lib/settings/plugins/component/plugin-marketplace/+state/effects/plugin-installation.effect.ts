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
	filter,
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
import { PluginService } from '../../../../services/plugin.service';
import { DialogInstallationValidationComponent } from '../../plugin-marketplace-item/dialog-installation-validation/dialog-installation-validation.component';
import { InstallationValidationChainBuilder } from '../../services';
import { PluginInstallationActions } from '../actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
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
		private readonly pluginService: PluginService,
		private readonly pluginElectronService: PluginElectronService,
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
	 */
	installFromMarketplace$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.install),
				tap(({ plugin }) => this.pluginInstallationStore.setToggle({ pluginId: plugin.id, isChecked: true })),
				exhaustMap(({ plugin, isUpdate }) =>
					this.installationValidationChainBuilder.validate(plugin, isUpdate).pipe(
						take(1),
						switchMap((context) => {
							if (context.errors.length > 0) {
								context.errors.forEach((err) =>
									this.toastrService.error(this.translateService.instant(err))
								);

								return of(
									PluginInstallationActions.toggle({
										isChecked: false,
										pluginId: context.plugin.id
									})
								);
							}

							const dialogRef = this.dialogService.open(DialogInstallationValidationComponent, {
								context: { pluginId: context.plugin.id },
								backdropClass: 'backdrop-blur'
							});

							return dialogRef.onClose.pipe(
								take(1),
								tap((data) => {
									if (!data) {
										this.pluginInstallationStore.setToggle({
											pluginId: context.plugin.id,
											isChecked: false
										});
									}
								}),
								filter(Boolean),
								map(({ version, source, authToken }) =>
									this.sourceInstallAction(context.plugin.id, version, source, authToken)
								)
							);
						})
					)
				)
			),
		{ dispatch: true }
	);

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
				return PluginInstallationActions.toggle({
					isChecked: false,
					pluginId
				});
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
				concatMap(({ plugin }) => {
					this.handleSuccess();
					return [
						PluginInstallationActions.check(plugin.id),
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
	handleDownloadFailure$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginInstallationActions.downloadFailed),
			tap(({ error }) => {
				this.pluginInstallationStore.update({
					installing: false,
					downloading: false,
					error
				});
				this.pluginInstallationStore.setToggle({
					isChecked: false,
					pluginId: this.pluginInstallationStore.getValue().currentPluginId
				});
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
				this.pluginInstallationStore.setToggle({
					isChecked: false,
					pluginId: this.pluginInstallationStore.getValue().currentPluginId
				});
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
				this.pluginInstallationStore.setToggle({
					isChecked: false,
					pluginId: this.pluginInstallationStore.getValue().currentPluginId
				});
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

				// Step 1 — Ask for confirmation
				exhaustMap(({ pluginId, installedId }) =>
					this.confirmUninstall().pipe(
						tap((confirmed) => this.pluginInstallationStore.setToggle({ isChecked: !confirmed, pluginId })),
						filter(Boolean),
						map(() => ({ marketplaceId: pluginId, id: installedId }))
					)
				),

				// Step 2 — Start uninstall
				tap(() => this.pluginInstallationStore.update({ uninstalling: true })),
				concatMap((input) =>
					this.handleUninstall(input).pipe(
						finalize(() => this.pluginInstallationStore.update({ uninstalling: false })),
						catchError((error) => {
							this.toastrService.error(
								error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL')
							);
							return EMPTY;
						})
					)
				)
			),
		{ dispatch: true }
	);

	checkSuccess$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.checkSuccess),
				concatMap(({ plugin: { marketplaceId, installed } }) => {
					this.pluginMarketplaceStore.updatePlugin(marketplaceId, { installed });
					return of(
						PluginInstallationActions.toggle({
							isChecked: installed,
							pluginId: marketplaceId
						})
					);
				})
			),
		{
			dispatch: true
		}
	);

	checkFailure$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginInstallationActions.checkFailure),
				concatMap(({ error, marketplaceId }) => {
					if (error) {
						this.toastrService.error(
							error || this.translateService.instant('PLUGIN.TOASTR.ERROR.CHECK_INSTALLATION_FAILED')
						);
					}
					this.pluginMarketplaceStore.updatePlugin(marketplaceId, { installed: false });
					return of(
						PluginInstallationActions.toggle({
							pluginId: marketplaceId,
							isChecked: false
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
			tap(({ isChecked, pluginId }) => {
				this.pluginInstallationStore.setToggle({
					pluginId,
					isChecked
				});
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

	private handleLocalUninstall(message?: string) {
		this.toastrService.success(message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));

		return of(PluginActions.refresh());
	}

	private handleServerUninstall(marketplaceId: ID, installationId: ID, message?: string) {
		return this.pluginService.uninstall(marketplaceId, installationId, 'User initiated uninstall').pipe(
			tap(() => this.updateMarketplaceAfterUninstall(marketplaceId, message)),
			map(() => PluginActions.refresh()),
			catchError((error) => {
				this.pluginInstallationStore.setToggle({ isChecked: true, pluginId: marketplaceId });
				this.toastrService.error(
					error?.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL_FAILED')
				);
				return EMPTY;
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

		this.pluginInstallationStore.setToggle({ isChecked: false, pluginId: marketplaceId });

		this.toastrService.success(message || this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));
	}
}
