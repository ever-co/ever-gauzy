import { Injectable } from '@angular/core';
import { catchError, forkJoin, from, map, of, switchMap, tap } from 'rxjs';
import { PluginElectronService } from './plugin-electron.service';
import { PluginSubscriptionAccessService } from './plugin-subscription-access.service';

/**
 * Service responsible for synchronizing locally-active plugins
 * with backend access control state.
 *
 * On login or app init, this service:
 * 1. Fetches all plugins that are active locally (isActivate === true)
 * 2. Checks backend access for each plugin's marketplaceId
 * 3. Deactivates any plugin where the user no longer has access
 *
 * This closes the gap where an admin denies a user after the plugin
 * was already activated locally.
 */
@Injectable({
	providedIn: 'root'
})
export class PluginAccessSyncService {
	constructor(
		private readonly pluginElectronService: PluginElectronService,
		private readonly accessService: PluginSubscriptionAccessService
	) {}

	/**
	 * Synchronize local plugin activation state with backend access control.
	 * Should be called after authentication is established.
	 * @returns Observable that completes after sync is done
	 */
	public syncActivePlugins() {
		if (!this.pluginElectronService.isDesktop) {
			return of(void 0);
		}

		return from(this.pluginElectronService.getActivePlugins()).pipe(
			switchMap((activePlugins) => {
				if (!activePlugins?.length) {
					return of(void 0);
				}

				// Check access for each active plugin in parallel
				const checks$ = activePlugins
					.filter((plugin) => !!plugin.marketplaceId)
					.map((plugin) =>
						this.accessService.checkAccess(plugin.marketplaceId).pipe(
							map((access) => ({ plugin, hasAccess: access.hasAccess })),
							catchError(() => {
								// If access check fails (network error etc.), keep plugin active
								return of({ plugin, hasAccess: true });
							})
						)
					);

				if (!checks$.length) {
					return of(void 0);
				}

				return forkJoin(checks$).pipe(
					tap((results) => {
						for (const { plugin, hasAccess } of results) {
							if (!hasAccess) {
								console.info(`Access revoked for plugin "${plugin.name}" — deactivating locally`);
								this.pluginElectronService.deactivate(plugin);
								// Also mark as tenant-disabled in local DB to prevent re-activation on restart
								this.pluginElectronService.updateTenantEnabled(plugin.marketplaceId, false);
							}
						}
					}),
					map(() => void 0)
				);
			})
		);
	}
}
