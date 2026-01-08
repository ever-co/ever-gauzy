import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { ToastrNotificationService } from '../../../services';
import { PluginPlanActions } from '../component/plugin-marketplace/+state/actions/plugin-plan.action';
import { PluginSubscriptionAccessFacade } from '../component/plugin-marketplace/+state/plugin-subscription-access.facade';

/**
 * Plugin Access Guard
 *
 * Protects routes that require plugin access
 * Checks if the current user has access to the plugin
 * If not, redirects to marketplace or shows subscription dialog
 */
@Injectable({ providedIn: 'root' })
export class PluginAccessGuard implements CanActivate {
	constructor(
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly router: Router,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		private readonly actions: Actions
	) {}

	canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
		const pluginId = route.paramMap.get('pluginId') || route.paramMap.get('id');

		if (!pluginId) {
			console.error('PluginAccessGuard: No plugin ID found in route params');
			this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.NO_PLUGIN_ID'));
			return this.router.createUrlTree(['/plugins/marketplace']);
		}

		// Check access for the plugin
		this.accessFacade.checkAccess(pluginId);

		return this.accessFacade.hasAccess$(pluginId).pipe(
			take(1),
			switchMap((hasAccess) => {
				if (hasAccess) {
					// User has access, allow navigation
					return of({ allowed: true } as const);
				}

				// User doesn't have access, check if plugin requires subscription
				return this.accessFacade.requiresSubscription$(pluginId).pipe(
					take(1),
					map(
						(requiresSubscription) =>
							({
								allowed: false,
								hasAccess,
								requiresSubscription
							} as const)
					)
				);
			}),
			switchMap((result) => {
				if (result.allowed) {
					return of(true);
				}

				// At this point we know it's the non-allowed type
				if ('requiresSubscription' in result && result.requiresSubscription) {
					this.actions.dispatch(PluginPlanActions.openPlanSubscriptions(pluginId));
					return EMPTY;
				}

				// Plugin doesn't require subscription but user doesn't have access
				// This might be a free plugin or configuration issue
				this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.NO_ACCESS'));
				return of(this.router.createUrlTree(['/plugins/marketplace']));
			}),
			catchError((error) => {
				console.error('PluginAccessGuard: Error checking access', error);
				this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.CHECK_FAILED'));
				return of(this.router.createUrlTree(['/plugins/marketplace']));
			})
		);
	}
}
