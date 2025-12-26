import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';

/**
 * Access verification result
 */
export interface IPluginAccessResult {
	hasAccess: boolean;
	reason: string;
	canAssign?: boolean;
	accessLevel?: string;
}

/**
 * Guard service for plugin access verification
 * Follows Single Responsibility Principle - only handles access checking
 * Follows Interface Segregation Principle - focused interface
 *
 * This guard:
 * 1. Checks if user has access to a plugin
 * 2. Provides detailed access information
 * 3. Can be used before any plugin operation (install, update, configure)
 */
@Injectable({
	providedIn: 'root'
})
export class PluginAccessGuard {
	constructor(
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly translateService: TranslateService
	) {}

	/**
	 * Checks if current user has access to the plugin
	 * @param pluginId Plugin ID to check
	 * @returns Observable with access result
	 */
	checkAccess(pluginId: string): Observable<IPluginAccessResult> {
		// Trigger access check
		this.accessFacade.checkAccess(pluginId);

		return this.accessFacade.hasAccess$(pluginId).pipe(
			take(1),
			map((hasAccess) => ({
				hasAccess,
				reason: hasAccess
					? this.translateService.instant('PLUGIN.ACCESS.HAS_ACCESS')
					: this.translateService.instant('PLUGIN.ACCESS.NO_ACCESS')
			})),
			tap((result) => {
				console.log(`[PluginAccessGuard] Access check for plugin ${pluginId}:`, result);
			})
		);
	}

	/**
	 * Checks if user can assign others to use the plugin
	 * @param pluginId Plugin ID to check
	 * @returns Observable<boolean>
	 */
	canAssignAccess(pluginId: string): Observable<boolean> {
		return this.accessFacade.canAssign$(pluginId).pipe(take(1));
	}

	/**
	 * Gets the access level for the plugin
	 * @param pluginId Plugin ID to check
	 * @returns Observable with access level
	 */
	getAccessLevel(pluginId: string): Observable<string | undefined> {
		return this.accessFacade.getAccessLevel$(pluginId).pipe(take(1));
	}

	/**
	 * Verifies access before performing an operation
	 * Throws error if access is denied
	 * @param pluginId Plugin ID to verify
	 * @param operation Operation name for error message
	 * @returns Observable that completes if access is granted
	 */
	verifyAccessForOperation(pluginId: string, operation: string): Observable<void> {
		return this.checkAccess(pluginId).pipe(
			map((result) => {
				if (!result.hasAccess) {
					throw new Error(this.translateService.instant('PLUGIN.ACCESS.OPERATION_DENIED', { operation }));
				}
			})
		);
	}

	/**
	 * Checks access for a plugin object
	 * Convenience method that extracts ID from plugin
	 * @param plugin Plugin to check
	 * @returns Observable with access result
	 */
	checkPluginAccess(plugin: IPlugin): Observable<IPluginAccessResult> {
		if (!plugin || !plugin.id) {
			return of({
				hasAccess: false,
				reason: this.translateService.instant('PLUGIN.ACCESS.INVALID_PLUGIN')
			});
		}

		return this.checkAccess(plugin.id);
	}
}
