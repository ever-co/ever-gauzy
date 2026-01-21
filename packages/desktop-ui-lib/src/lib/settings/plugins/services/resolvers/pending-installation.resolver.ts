import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { PendingInstallationService } from '../pending-installation.service';
import { PluginElectronService } from '../plugin-electron.service';
import { UserSubscribedPluginsService } from '../user-subscribed-plugins.service';

/**
 * Resolver that checks if there is a pending plugin installation.
 * If there are pending installations, it shows the pending installation dialog.
 * Otherwise, it does nothing.
 *
 * This resolver should be used on routes where you want to notify the user
 * about pending plugin installations.
 *
 * @example
 * ```typescript
 * // In your routing module
 * {
 *   path: 'plugins',
 *   component: PluginLayoutComponent,
 *   resolve: {
 *     pendingCheck: PendingInstallationResolver
 *   }
 * }
 * ```
 *
 * @returns Observable<boolean> - Always returns true to allow navigation
 */
export const PendingInstallationResolver: ResolveFn<Observable<boolean>> = (): Observable<boolean> => {
	const userSubscribedPluginsService = inject(UserSubscribedPluginsService);
	const pendingInstallationService = inject(PendingInstallationService);
	const pluginElectronService = inject(PluginElectronService);

	// Skip check if not running in desktop environment
	if (!pluginElectronService.isDesktop) {
		return of(true);
	}

	return userSubscribedPluginsService.hasPendingInstallation().pipe(
		tap((hasPending) => {
			if (hasPending) {
				// If there are pending installations, show the dialog
				pendingInstallationService.showDialogIfPending$();
			}
		}),
		// Always allow navigation regardless of pending status
		map(() => true),
		// Handle any errors gracefully and still allow navigation
		catchError((error) => {
			console.error('[PendingInstallationResolver] Error checking pending installations:', error);
			return of(true);
		})
	);
};
