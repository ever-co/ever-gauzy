import { Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import {
	catchError,
	concat,
	concatMap,
	EMPTY,
	exhaustMap,
	filter,
	finalize,
	from,
	ignoreElements,
	map,
	of,
	switchMap,
	take,
	tap,
	withLatestFrom
} from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import {
	ISubscribedPluginsQueryParams,
	UserSubscribedPluginsService
} from '../../services/user-subscribed-plugins.service';
import { PendingInstallationDialogComponent } from '../pending-installation-dialog/pending-installation-dialog.component';
import { PluginInstallationActions } from '../plugin-marketplace/+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../plugin-marketplace/+state/actions/plugin-marketplace.action';
import { PendingInstallationActions } from './pending-installation.action';
import { PendingInstallationQuery } from './pending-installation.query';
import { IPendingPluginInstallation, PendingInstallationStore } from './pending-installation.store';
import { PluginActions } from './plugin.action';
import { PluginQuery } from './plugin.query';

@Injectable({ providedIn: 'root' })
export class PendingInstallationEffects {
	constructor(
		private readonly store: PendingInstallationStore,
		private readonly query: PendingInstallationQuery,
		private readonly actions$: Actions,
		private readonly userSubscribedPluginsService: UserSubscribedPluginsService,
		private readonly installedPluginQuery: PluginQuery,
		private readonly pluginElectronService: PluginElectronService,
		private readonly dialog: NbDialogService
	) {}

	/* ---------------------------------------------------------------------
	 * Shared loader (single source of truth)
	 * -------------------------------------------------------------------*/
	private loadPendingPlugins(installed: IPlugin[], params?: ISubscribedPluginsQueryParams) {
		return this.userSubscribedPluginsService.getSubscribedPlugins(params).pipe(
			map(({ items, total }) => {
				const installedIds = new Set(installed.map((p) => p.marketplaceId).filter(Boolean));

				return {
					plugins: items
						.filter((s) => s.plugin && !installedIds.has(s.plugin.id))
						.map(
							(sub): IPendingPluginInstallation => ({
								plugin: sub.plugin,
								subscriptionId: sub.subscriptionId,
								isInstalling: false,
								isInstalled: false,
								error: null,
								canAutoInstall: sub.canAutoInstall,
								isMandatory: sub.isMandatory
							})
						),
					total
				};
			})
		);
	}

	private uniqueByPluginId(plugins: IPendingPluginInstallation[]): IPendingPluginInstallation[] {
		const seen = new Set<string>();
		return plugins.filter((p) => {
			if (seen.has(p.plugin.id)) {
				return false;
			}
			seen.add(p.plugin.id);
			return true;
		});
	}

	/**
	 * Wait for a specific plugin installation to complete or fail
	 */
	private waitForPluginEnd(pluginId: string) {
		return this.actions$.pipe(
			ofType(PendingInstallationActions.installationCompleted, PendingInstallationActions.installationFailed),
			filter((a) => a.pluginId === pluginId),
			take(1)
		);
	}

	/**
	 * Improved installation queue with better error handling and progress tracking
	 * Uses concatMap to ensure sequential installation
	 */
	private runInstallQueue(plugins: IPendingPluginInstallation[]) {
		// Filter valid plugins and remove duplicates
		const validPlugins = this.uniqueByPluginId(plugins).filter(
			(p) => !p.isInstalling && !p.isInstalled && !!p.plugin.version?.id
		);

		if (validPlugins.length === 0) {
			return EMPTY;
		}

		return from(validPlugins).pipe(
			// Sequential processing - wait for each to complete before starting next
			concatMap((pending) =>
				concat(
					// Start installation
					of(PendingInstallationActions.installPlugin(pending.plugin.id, pending.plugin.version.id)),
					// Wait for completion or failure
					this.waitForPluginEnd(pending.plugin.id).pipe(
						// Convert completion event to empty to continue queue
						ignoreElements(),
						// Ensure we continue even if this plugin fails
						catchError(() => EMPTY)
					)
				)
			)
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
				switchMap(({ plugins }) =>
					this.loadPendingPlugins(plugins, { skip: 1, take: 10 }).pipe(
						map(({ plugins, total }) => PendingInstallationActions.setPendingPlugins(plugins, total)),
						finalize(() => this.store.setLoading(false)),
						catchError((err) => {
							console.error('Failed to check pending installations:', err);
							return of(
								PendingInstallationActions.installationFailed(
									'__check__',
									err?.message ?? 'Failed to check pending installations'
								)
							);
						})
					)
				)
			),
		{ dispatch: true }
	);

	setPendingPlugins$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.setPendingPlugins),
				map(({ pendings, total }) => {
					this.store.setPendingPlugins(pendings, total);
					return PendingInstallationActions.checkAndShowDialog();
				})
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
				filter(() => this.pluginElectronService.isDesktop),
				withLatestFrom(this.query.checked$, this.query.hasPendingPlugins$, this.query.forceInstallEnabled$),
				switchMap(([_, checked, hasPending, force]) => {
					// If we haven't checked yet, trigger plugin fetch
					if (!checked) {
						return of(PluginActions.getPlugins());
					}

					// If there are pending plugins, show dialog
					if (hasPending) {
						return of(PendingInstallationActions.openDialog());
					}

					// If force-install is enabled, start installing auto-installable plugins
					if (force) {
						return of(PendingInstallationActions.installAutoInstallablePlugins());
					}

					// Nothing to do
					return EMPTY;
				})
			),
		{ dispatch: true }
	);

	checkPluginSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginActions.getPluginsSuccess),
				map(({ plugins }) => PendingInstallationActions.checkPendingInstallations(plugins))
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
				exhaustMap(() =>
					this.dialog
						.open(PendingInstallationDialogComponent, {
							closeOnBackdropClick: false,
							closeOnEsc: true,
							hasBackdrop: true
						})
						.onClose.pipe(take(1))
				)
			),
		{ dispatch: false }
	);

	closeDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.closeDialog),
				withLatestFrom(this.query.hasPendingPlugins$),
				tap(([_, hasPending]) => {
					this.store.update({ checked: hasPending });
				})
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
						console.error(`Plugin ${pluginId} not found in pending list`);
						return PluginInstallationActions.installationFailed(
							'Plugin not found in pending list',
							pluginId
						);
					}

					if (!pending.plugin.version?.id) {
						console.error(`Plugin ${pluginId} has no version ID`);
						return PluginInstallationActions.installationFailed('Plugin version not available', pluginId);
					}

					// Mark as installing
					this.store.setPluginInstalling(pluginId, true);

					return PluginMarketplaceActions.install(pending.plugin);
				})
			),
		{ dispatch: true }
	);

	/* ---------------------------------------------------------------------
	 * Marketplace bridge - listen to marketplace installation events
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
				filter(([{ pluginId }, plugins]) => !!pluginId && plugins.some((p) => p.plugin.id === pluginId)),
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
				tap(({ pluginId }) => {
					// Mark as installed instead of removing immediately
					this.store.setPluginInstalled(pluginId, true);
					// Remove after a delay to show success state
					setTimeout(() => this.store.removePlugin(pluginId), 2000);
				})
			),
		{ dispatch: false }
	);

	installationFailed$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installationFailed),
				tap(({ pluginId, error }) => {
					if (pluginId && pluginId !== '__check__') {
						this.store.setPluginError(pluginId, error);
					}
				})
			),
		{ dispatch: false }
	);

	/* ---------------------------------------------------------------------
	 * Install all - improved with progress tracking
	 * -------------------------------------------------------------------*/
	installAllPlugins$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.installAllPlugins),
				exhaustMap(() =>
					this.query.pendingPlugins$.pipe(
						take(1),
						switchMap((plugins) => this.runInstallQueue(plugins))
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
				exhaustMap(() =>
					this.query.pendingPlugins$.pipe(
						take(1),
						map((plugins) => plugins.filter((p) => p.canAutoInstall)),
						switchMap((plugins) => this.runInstallQueue(plugins))
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

	skipAllPlugin$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.skipAll),
				map(() => PendingInstallationActions.reset())
			),
		{ dispatch: true }
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

	$loadMorePlugins = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PendingInstallationActions.loadMore),
				filter(() => this.query.hasNext),
				exhaustMap(() =>
					this.query.pagination$.pipe(
						take(1),
						withLatestFrom(this.installedPluginQuery.plugins$),
						tap(() => this.store.update({ loading: true })),
						switchMap(([pagination, installed]) =>
							this.loadPendingPlugins(installed, {
								skip: pagination.skip,
								take: pagination.take
							}).pipe(
								tap(({ plugins, total }) => this.store.appendPendingPlugins(plugins, total)),
								finalize(() => this.store.update({ loading: false })),
								catchError((error) => {
									console.error('Failed to load more plugins:', error);
									this.store.update({
										error: error.message || 'Failed to load more plugins'
									});
									return EMPTY;
								})
							)
						)
					)
				)
			),
		{ dispatch: false }
	);
}
