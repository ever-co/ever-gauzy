import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { catchError, finalize, forkJoin, from, map, Observable, of, tap } from 'rxjs';
import { PendingInstallationQuery } from '../component/+state/pending-installation.query';
import { IPendingPluginInstallation, PendingInstallationStore } from '../component/+state/pending-installation.store';
import { PluginElectronService } from '../services/plugin-electron.service';
import { ISubscribedPlugin, UserSubscribedPluginsService } from '../services/user-subscribed-plugins.service';

/**
 * Guard that checks for non-installed subscribed plugins.
 * This guard performs the check and updates the store state.
 * Navigation is always allowed.
 *
 * Note: This guard does NOT open a dialog because the dialog component
 * is part of the lazy-loaded PluginsModule. The dialog should be
 * opened by a component or service that's loaded after the PluginsModule.
 *
 * To show the pending installation dialog, use the PendingInstallationService
 * or dispatch PendingInstallationActions.openDialog() after the PluginsModule is loaded.
 *
 * For startup checks, use PluginStartupCheckService which handles authentication
 * events and shows the dialog at the appropriate time.
 */
@Injectable({ providedIn: 'root' })
export class PendingInstallationGuard implements CanActivate {
	private readonly store = inject(PendingInstallationStore);
	private readonly query = inject(PendingInstallationQuery);
	private readonly userSubscribedPluginsService = inject(UserSubscribedPluginsService);
	private readonly pluginElectronService = inject(PluginElectronService);

	/** Flag to prevent concurrent checks */
	private isChecking = false;

	canActivate(
		_route: ActivatedRouteSnapshot,
		_state: RouterStateSnapshot
	): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
		// Skip check if not running in desktop environment
		if (!this.pluginElectronService.isDesktop) {
			return true;
		}

		// If we've already checked, allow navigation
		if (this.query.checked) {
			return true;
		}

		// If a check is already in progress, allow navigation (avoid duplicate calls)
		if (this.isChecking) {
			return true;
		}

		// Perform the check
		return this.checkPendingInstallations();
	}

	/**
	 * Checks for pending (non-installed) subscribed plugins.
	 * Updates the store with the results.
	 * Always returns true to allow navigation.
	 */
	private checkPendingInstallations(): Observable<boolean> {
		this.isChecking = true;

		// Set loading state
		this.store.update({ loading: true, error: null });

		return forkJoin({
			subscribedPlugins: this.userSubscribedPluginsService.getSubscribedPlugins(),
			installedPlugins: from(this.pluginElectronService.plugins)
		}).pipe(
			map(({ subscribedPlugins, installedPlugins }) => {
				// Get IDs of locally installed plugins
				const installedPluginIds = new Set(installedPlugins.map((p) => p.marketplaceId).filter(Boolean));

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
				// Update store with pending plugins
				this.store.setPendingPlugins(pendingPlugins);

				if (pendingPlugins.length > 0) {
					const autoInstallCount = pendingPlugins.filter((p) => p.canAutoInstall).length;
					const mandatoryCount = pendingPlugins.filter((p) => p.isMandatory).length;
					console.log(
						`[PendingInstallationGuard] Found ${pendingPlugins.length} pending plugin(s) to install ` +
							`(${autoInstallCount} auto-installable, ${mandatoryCount} mandatory)`
					);
				}
			}),
			finalize(() => {
				this.store.update({ loading: false });
				this.isChecking = false;
			}),
			// Always allow navigation
			map(() => true),
			catchError((error) => {
				const errorMessage = error?.error?.message || error?.message || 'Failed to check pending installations';
				this.store.update({ error: errorMessage, loading: false, checked: true });
				this.isChecking = false;
				console.error('[PendingInstallationGuard] Error checking pending installations:', error);
				// Allow navigation even on error
				return of(true);
			})
		);
	}
}
