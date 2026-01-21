import { Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, filter, finalize, forkJoin, from, map, switchMap, take, tap, withLatestFrom } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { ISubscribedPlugin, UserSubscribedPluginsService } from '../../services/user-subscribed-plugins.service';
import { PendingInstallationDialogComponent } from '../pending-installation-dialog/pending-installation-dialog.component';
import { PluginInstallationActions } from '../plugin-marketplace/+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../plugin-marketplace/+state/actions/plugin-marketplace.action';
import { PendingInstallationActions } from './pending-installation.action';
import { PendingInstallationQuery } from './pending-installation.query';
import { IPendingPluginInstallation, PendingInstallationStore } from './pending-installation.store';

@Injectable({ providedIn: 'root' })
export class PendingInstallationEffects {
	constructor(
		private readonly store: PendingInstallationStore,
		private readonly query: PendingInstallationQuery,
		private readonly actions$: Actions,
		private readonly userSubscribedPluginsService: UserSubscribedPluginsService,
		private readonly pluginElectronService: PluginElectronService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	/**
	 * Effect to check for pending (non-installed) subscribed plugins
	 */
	checkPendingInstallations$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.checkPendingInstallations),
			// Skip if already checked (guard may have already done this)
			filter(() => !this.query.checked),
			tap(() => this.store.update({ loading: true, error: null })),
			switchMap(() =>
				forkJoin({
					subscribedPlugins: this.userSubscribedPluginsService.getSubscribedPlugins(),
					installedPlugins: from(this.pluginElectronService.plugins)
				}).pipe(
					map(({ subscribedPlugins, installedPlugins }) => {
						// Get IDs of locally installed plugins
						const installedPluginIds = new Set(
							installedPlugins.map((p) => p.marketplaceId).filter(Boolean)
						);

						// Filter to find subscribed plugins that are NOT installed locally
						const pendingPlugins: IPendingPluginInstallation[] = subscribedPlugins
							.filter((sub: ISubscribedPlugin) => sub.plugin && !installedPluginIds.has(sub.plugin.id))
							.map((sub: ISubscribedPlugin) => ({
								plugin: sub.plugin,
								subscriptionId: sub.subscriptionId,
								isInstalling: false,
								error: null,
								canAutoInstall: sub.canAutoInstall,
								isMandatory: sub.isMandatory
							}));

						return pendingPlugins;
					}),
					tap((pendingPlugins) => {
						this.store.setPendingPlugins(pendingPlugins);
					}),
					finalize(() => this.store.update({ loading: false })),
					catchError((error) => {
						const errorMessage =
							error?.error?.message || error?.message || 'Failed to check pending installations';
						this.store.update({ error: errorMessage, loading: false, checked: true });
						console.error('PendingInstallationEffects: Error checking pending installations', error);
						return EMPTY;
					})
				)
			)
		)
	);

	/**
	 * Effect to check and show dialog if there are pending plugins.
	 * This is useful when the PluginsModule is loaded and we want to show the dialog.
	 * If the check has not been performed yet (e.g., guard not used), it will perform the check first.
	 *
	 * If force install mode is enabled, auto-installable plugins will be installed automatically.
	 */
	checkAndShowDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.checkAndShowDialog),
			withLatestFrom(this.query.checked$, this.query.dialogOpen$, this.query.forceInstallEnabled$),
			switchMap(([_, checked, dialogOpen, forceInstallEnabled]) => {
				// If dialog is already open, do nothing
				if (dialogOpen) {
					return EMPTY;
				}

				// If not checked yet, perform the check first
				if (!checked) {
					this.store.update({ loading: true, error: null });

					return forkJoin({
						subscribedPlugins: this.userSubscribedPluginsService.getSubscribedPlugins(),
						installedPlugins: from(this.pluginElectronService.plugins)
					}).pipe(
						map(({ subscribedPlugins, installedPlugins }) => {
							// Get IDs of locally installed plugins
							const installedPluginIds = new Set(
								installedPlugins.map((p) => p.marketplaceId).filter(Boolean)
							);

							// Filter to find subscribed plugins that are NOT installed locally
							return subscribedPlugins
								.filter(
									(sub: ISubscribedPlugin) => sub.plugin && !installedPluginIds.has(sub.plugin.id)
								)
								.map((sub: ISubscribedPlugin) => ({
									plugin: sub.plugin,
									subscriptionId: sub.subscriptionId,
									isInstalling: false,
									error: null,
									canAutoInstall: sub.canAutoInstall,
									isMandatory: sub.isMandatory
								}));
						}),
						tap((pendingPlugins: IPendingPluginInstallation[]) => {
							this.store.setPendingPlugins(pendingPlugins);
							this.store.update({ loading: false });

							// Show dialog if there are pending plugins
							if (pendingPlugins.length > 0) {
								const autoInstallCount = pendingPlugins.filter((p) => p.canAutoInstall).length;
								const mandatoryCount = pendingPlugins.filter((p) => p.isMandatory).length;
								console.log(
									`[PendingInstallationEffects] Found ${pendingPlugins.length} pending plugin(s) to install ` +
										`(${autoInstallCount} auto-installable, ${mandatoryCount} mandatory)`
								);

								// If force install is enabled, auto-install eligible plugins
								if (forceInstallEnabled && autoInstallCount > 0) {
									this.handleForceInstall(pendingPlugins);
								} else {
									this.store.openDialog();
									this.dialogService.open(PendingInstallationDialogComponent, {
										closeOnBackdropClick: false,
										closeOnEsc: true,
										hasBackdrop: true,
										context: {}
									});
								}
							}
						}),
						catchError((error) => {
							const errorMessage =
								error?.error?.message || error?.message || 'Failed to check pending installations';
							this.store.update({ error: errorMessage, loading: false, checked: true });
							console.error('[PendingInstallationEffects] Error checking pending installations:', error);
							return EMPTY;
						})
					);
				}

				// Already checked - show dialog if there are pending plugins
				return this.query.hasPendingPlugins$.pipe(
					take(1),
					tap((hasPending) => {
						if (hasPending) {
							this.store.openDialog();
							this.dialogService.open(PendingInstallationDialogComponent, {
								closeOnBackdropClick: false,
								closeOnEsc: true,
								hasBackdrop: true,
								context: {}
							});
						}
					})
				);
			})
		)
	);

	/**
	 * Effect to open the dialog
	 */
	openDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.openDialog),
			// Don't open if already open
			filter(() => !this.query.dialogOpen),
			tap(() => {
				this.store.openDialog();
				this.dialogService.open(PendingInstallationDialogComponent, {
					closeOnBackdropClick: false,
					closeOnEsc: true,
					hasBackdrop: true,
					context: {}
				});
			})
		)
	);

	/**
	 * Effect to close the dialog
	 */
	closeDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.closeDialog),
			tap(() => this.store.closeDialog())
		)
	);

	/**
	 * Effect to install a single plugin.
	 * Delegates to the existing marketplace installation flow to avoid duplication.
	 */
	installPlugin$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installPlugin),
				withLatestFrom(this.query.pendingPlugins$),
				map(([{ pluginId }, pendingPlugins]) => {
					// Find the pending plugin to get the full IPlugin object
					const pending = pendingPlugins.find((p) => p.plugin.id === pluginId);
					if (!pending) {
						this.toastrService.error(this.translateService.instant('PLUGIN.TOASTR.ERROR.PLUGIN_NOT_FOUND'));
						return null;
					}

					// Mark as installing in the pending store
					this.store.setPluginInstalling(pluginId, true);

					// Delegate to the existing marketplace installation action
					// This will trigger the full installation flow: validation -> dialog -> download -> install -> activate
					return PluginMarketplaceActions.install(pending.plugin);
				}),
				filter((action) => action !== null)
			),
		{ dispatch: true }
	);

	/**
	 * Effect to listen to marketplace installation completion and update pending state.
	 * Reuses the existing PluginInstallationActions.installationCompleted action.
	 */
	marketplaceInstallationCompleted$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginInstallationActions.installationCompleted),
			withLatestFrom(this.query.pendingPlugins$),
			tap(([{ marketplaceId }, pendingPlugins]) => {
				// Check if this completed installation is one of our pending plugins
				const isPending = pendingPlugins.some((p) => p.plugin.id === marketplaceId);
				if (isPending) {
					this.actions$.dispatch(PendingInstallationActions.installationCompleted(marketplaceId));
				}
			})
		)
	);

	/**
	 * Effect to listen to marketplace installation failures and update pending state.
	 * Reuses the existing PluginInstallationActions.installationFailed action.
	 */
	marketplaceInstallationFailed$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginInstallationActions.installationFailed),
			withLatestFrom(this.query.pendingPlugins$),
			tap(([{ error, pluginId }, pendingPlugins]) => {
				// Check if this failed installation is one of our pending plugins
				if (pluginId) {
					const isPending = pendingPlugins.some((p) => p.plugin.id === pluginId);
					if (isPending) {
						this.actions$.dispatch(PendingInstallationActions.installationFailed(pluginId, error));
					}
				}
			})
		)
	);

	/**
	 * Effect to handle installation completed
	 */
	installationCompleted$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.installationCompleted),
			tap(({ pluginId }) => {
				this.store.removePlugin(pluginId);
			}),
			withLatestFrom(this.query.pendingCount$),
			tap(([_, count]) => {
				if (count === 0) {
					this.store.closeDialog();
				}
			})
		)
	);

	/**
	 * Effect to handle installation failed
	 */
	installationFailed$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.installationFailed),
			tap(({ pluginId, error }) => {
				this.store.setPluginError(pluginId, error);
			})
		)
	);

	/**
	 * Effect to install all pending plugins
	 */
	installAllPlugins$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.installAllPlugins),
			withLatestFrom(this.query.pendingPlugins$),
			tap(([_, plugins]) => {
				// Dispatch install action for each plugin
				plugins.forEach((p) => {
					if (!p.isInstalling && p.plugin.version?.id) {
						this.actions$.dispatch(
							PendingInstallationActions.installPlugin(p.plugin.id, p.plugin.version.id)
						);
					}
				});
			})
		)
	);

	/**
	 * Effect to skip a plugin
	 */
	skipPlugin$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.skipPlugin),
			tap(({ pluginId }) => {
				this.store.removePlugin(pluginId);
			}),
			withLatestFrom(this.query.pendingCount$),
			tap(([_, count]) => {
				if (count === 0) {
					this.store.closeDialog();
				}
			})
		)
	);

	/**
	 * Effect to skip all and close dialog
	 */
	skipAll$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.skipAll),
			tap(() => {
				this.store.closeDialog();
			})
		)
	);

	/**
	 * Effect to reset state
	 */
	reset$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.reset),
			tap(() => {
				this.store.resetState();
			})
		)
	);

	/**
	 * Effect to set force install mode.
	 * When enabled, auto-installable plugins will be installed automatically
	 * without user interaction.
	 */
	setForceInstall$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.setForceInstall),
			tap(({ enabled }) => {
				this.store.setForceInstallEnabled(enabled);
				console.log(`[PendingInstallationEffects] Force install mode ${enabled ? 'enabled' : 'disabled'}`);
			})
		)
	);

	/**
	 * Effect to install only auto-installable plugins.
	 * Filters plugins by canAutoInstall flag and dispatches install actions.
	 * For mandatory plugins that cannot be auto-installed, shows the dialog.
	 */
	installAutoInstallablePlugins$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PendingInstallationActions.installAutoInstallablePlugins),
			withLatestFrom(this.query.pendingPlugins$),
			tap(([_, plugins]) => {
				const autoInstallable = plugins.filter((p) => p.canAutoInstall === true);
				const mandatory = plugins.filter((p) => p.isMandatory === true && p.canAutoInstall !== true);

				console.log(
					`[PendingInstallationEffects] Installing ${autoInstallable.length} auto-installable plugin(s), ` +
						`${mandatory.length} mandatory plugin(s) require manual action`
				);

				// Auto-install eligible plugins
				autoInstallable.forEach((p) => {
					if (!p.isInstalling && p.plugin.version?.id) {
						this.actions$.dispatch(
							PendingInstallationActions.installPlugin(p.plugin.id, p.plugin.version.id)
						);
					}
				});

				// If there are mandatory plugins that cannot be auto-installed, show dialog
				if (mandatory.length > 0) {
					this.store.openDialog();
					this.dialogService.open(PendingInstallationDialogComponent, {
						closeOnBackdropClick: false,
						closeOnEsc: true,
						hasBackdrop: true,
						context: {}
					});
				}
			})
		)
	);

	/**
	 * Handle force install of auto-installable plugins.
	 * Installs plugins that have canAutoInstall flag set.
	 * For remaining plugins, shows the dialog.
	 *
	 * @param pendingPlugins List of pending plugins
	 */
	private handleForceInstall(pendingPlugins: IPendingPluginInstallation[]): void {
		const autoInstallable = pendingPlugins.filter((p) => p.canAutoInstall === true);
		const remaining = pendingPlugins.filter((p) => p.canAutoInstall !== true);

		console.log(
			`[PendingInstallationEffects] Force installing ${autoInstallable.length} plugin(s), ` +
				`${remaining.length} require manual action`
		);

		// Auto-install eligible plugins
		autoInstallable.forEach((p) => {
			if (p.plugin.version?.id) {
				this.actions$.dispatch(PendingInstallationActions.installPlugin(p.plugin.id, p.plugin.version.id));
			}
		});

		// If there are remaining plugins that cannot be auto-installed, show dialog
		if (remaining.length > 0) {
			this.store.openDialog();
			this.dialogService.open(PendingInstallationDialogComponent, {
				closeOnBackdropClick: false,
				closeOnEsc: true,
				hasBackdrop: true,
				context: {}
			});
		}
	}
}
