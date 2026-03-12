import { Injectable } from '@angular/core';
import { catchError, forkJoin, from, map, mergeMap, Observable, of, switchMap, timeout } from 'rxjs';
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
	public syncActivePlugins(): Observable<void> {
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
							timeout(5000),
							map((access) => ({ plugin, hasAccess: access.hasAccess })),
							catchError((error) => {
								// If access check times out, treat as revoked; other errors keep plugin active
								const hasAccess = error?.name !== 'TimeoutError';
								return of({ plugin, hasAccess });
							})
						)
					);

				if (!checks$.length) {
					return of(void 0);
				}

				return forkJoin(checks$).pipe(
					mergeMap((results) => {
						const revoked = results.filter(({ hasAccess }) => !hasAccess);
						if (revoked.length === 0) {
							return of(void 0);
						}

						const deactivations$ = revoked.map(({ plugin }) => {
							console.info(`Access revoked for plugin "${plugin.name}" — deactivating locally`);
							this.pluginElectronService.deactivate(plugin);
							return from(this.pluginElectronService.updateTenantEnabled(plugin.marketplaceId, false)).pipe(
								catchError(() => of(void 0))
							);
						});

						return forkJoin(deactivations$).pipe(map(() => void 0));
					})
				);
			})
		);
	}
}
