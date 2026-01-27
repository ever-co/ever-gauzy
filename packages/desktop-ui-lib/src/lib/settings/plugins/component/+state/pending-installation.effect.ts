import { Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, filter, forkJoin, from, map, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { UserSubscribedPluginsService } from '../../services/user-subscribed-plugins.service';
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
		private readonly dialog: NbDialogService
	) {}

	/* ---------------------------------------------------------------------
	 * Shared loader (single source of truth)
	 * -------------------------------------------------------------------*/
	private loadPendingPlugins$() {
		return forkJoin({
			subscribed: this.userSubscribedPluginsService.getSubscribedPlugins(),
			installed: from(this.pluginElectronService.plugins)
		}).pipe(
			map(({ subscribed, installed }) => {
				const installedIds = new Set(installed.map((p) => p.marketplaceId).filter(Boolean));

				return subscribed
					.filter((s) => s.plugin && !installedIds.has(s.plugin.id))
					.map(
						(sub): IPendingPluginInstallation => ({
							plugin: sub.plugin,
							subscriptionId: sub.subscriptionId,
							isInstalling: false,
							error: null,
							canAutoInstall: sub.canAutoInstall,
							isMandatory: sub.isMandatory
						})
					);
			})
		);
	}

	/* ---------------------------------------------------------------------
	 * Check pending plugins (data only)
	 * -------------------------------------------------------------------*/
	checkPendingInstallations$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.checkPendingInstallations),
				tap(() => this.store.update({ loading: true, error: null })),
				switchMap(() =>
					this.loadPendingPlugins$().pipe(
						map((plugins) => PendingInstallationActions.setPendingPlugins(plugins)),
						catchError((err) =>
							of(
								PendingInstallationActions.installationFailed(
									'__check__',
									err?.message ?? 'Check failed'
								)
							)
						),
						tap(() => this.store.update({ loading: false, checked: true }))
					)
				)
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Check + decide what to do next
	 * -------------------------------------------------------------------*/
	checkAndShowDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.checkAndShowDialog),
				withLatestFrom(this.query.checked$, this.query.hasPendingPlugins$, this.query.forceInstallEnabled$),
				filter(([_, __, hasPending]) => hasPending),
				map(([_, checked, __, force]) => {
					if (!checked) {
						return PendingInstallationActions.checkPendingInstallations();
					}
					return force
						? PendingInstallationActions.installAutoInstallablePlugins()
						: PendingInstallationActions.openDialog();
				})
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Dialog UI
	 * -------------------------------------------------------------------*/
	openDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.openDialog),
				filter(() => !this.query.dialogOpen),
				tap(() => {
					this.store.openDialog();
					this.dialog
						.open(PendingInstallationDialogComponent, {
							closeOnBackdropClick: false,
							closeOnEsc: true,
							hasBackdrop: true
						})
						.onClose.pipe(map(() => PendingInstallationActions.closeDialog()));
				})
			),
		{ dispatch: true }
	);

	closeDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.closeDialog),
				tap(() => this.store.closeDialog())
			),
		{ dispatch: false }
	);

	/* ---------------------------------------------------------------------
	 * Install single plugin (delegates to marketplace)
	 * -------------------------------------------------------------------*/
	installPlugin$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installPlugin),
				withLatestFrom(this.query.pendingPlugins$),
				map(([{ pluginId }, plugins]) => {
					const pending = plugins.find((p) => p.plugin.id === pluginId);
					if (!pending) {
						return PluginInstallationActions.installationFailed('Plugin not found', pluginId);
					}
					this.store.setPluginInstalling(pluginId, true);
					return PluginMarketplaceActions.install(pending.plugin);
				})
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Marketplace bridge
	 * -------------------------------------------------------------------*/
	marketplaceCompleted$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginInstallationActions.installationCompleted),
				withLatestFrom(this.query.pendingPlugins$),
				filter(([{ marketplaceId }, plugins]) => plugins.some((p) => p.plugin.id === marketplaceId)),
				map(([{ marketplaceId }]) => PendingInstallationActions.installationCompleted(marketplaceId))
			),
		{ dispatch: true }
	);

	marketplaceFailed$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginInstallationActions.installationFailed),
				withLatestFrom(this.query.pendingPlugins$),
				filter(([{ pluginId }, plugins]) => plugins.some((p) => p.plugin.id === pluginId)),
				map(([{ pluginId, error }]) => PendingInstallationActions.installationFailed(pluginId, error))
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Completion handling
	 * -------------------------------------------------------------------*/
	installationCompleted$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installationCompleted),
				tap(({ pluginId }) => this.store.removePlugin(pluginId)),
				withLatestFrom(this.query.pendingCount$),
				tap(([_, count]) => {
					if (count === 0) {
						this.store.closeDialog();
					}
				})
			),
		{ dispatch: false }
	);

	installationFailed$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installationFailed),
				tap(({ pluginId, error }) => this.store.setPluginError(pluginId, error))
			),
		{ dispatch: false }
	);

	/* ---------------------------------------------------------------------
	 * Install all
	 * -------------------------------------------------------------------*/
	installAllPlugins$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installAllPlugins),
				withLatestFrom(this.query.pendingPlugins$),
				switchMap(([_, plugins]) =>
					from(plugins).pipe(
						filter((p) => !p.isInstalling && !!p.plugin.version?.id),
						map((p) => PendingInstallationActions.installPlugin(p.plugin.id, p.plugin.version!.id))
					)
				)
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Auto-install only
	 * -------------------------------------------------------------------*/
	installAutoInstallable$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installAutoInstallablePlugins),
				withLatestFrom(this.query.pendingPlugins$),
				switchMap(([_, plugins]) =>
					from(plugins).pipe(
						filter((p) => p.canAutoInstall),
						map((p) => PendingInstallationActions.installPlugin(p.plugin.id, p.plugin.version!.id))
					)
				)
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Skip / reset
	 * -------------------------------------------------------------------*/
	skipPlugin$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.skipPlugin),
				tap(({ pluginId }) => this.store.removePlugin(pluginId))
			),
		{ dispatch: false }
	);

	skipAll$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.skipAll),
				tap(() => this.store.closeDialog())
			),
		{ dispatch: false }
	);

	reset$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.reset),
				tap(() => this.store.resetState())
			),
		{ dispatch: false }
	);

	setForceInstall$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.setForceInstall),
				tap(({ enabled }) => this.store.setForceInstallEnabled(enabled))
			),
		{ dispatch: false }
	);
}
