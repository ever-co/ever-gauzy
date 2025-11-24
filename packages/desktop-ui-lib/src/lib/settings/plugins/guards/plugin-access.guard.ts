import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { ToastrNotificationService } from '../../../services';
import { PluginSubscriptionAccessFacade } from '../component/plugin-marketplace/+state/plugin-subscription-access.facade';
import { PluginMarketplaceQuery } from '../component/plugin-marketplace/+state/queries/plugin-marketplace.query';
import { SubscriptionDialogRouterService } from '../component/plugin-marketplace/services/subscription-dialog-router.service';

/**
 * Plugin Access Guard
 *
 * Protects routes that require plugin access
 * Checks if the current user has access to the plugin
 * If not, redirects to marketplace or shows subscription dialog
 *
 * Usage in routing:
 * ```typescript
 * {
 *   path: 'plugin/:pluginId',
 *   component: PluginComponent,
 *   canActivate: [PluginAccessGuard]
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginAccessGuard implements CanActivate {
	constructor(
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		private readonly marketplaceQuery: PluginMarketplaceQuery,
		private readonly subscriptionDialogRouter: SubscriptionDialogRouterService
	) {}

	canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
		const pluginId = route.paramMap.get('pluginId') || route.paramMap.get('id');

		if (!pluginId) {
			console.error('PluginAccessGuard: No plugin ID found in route params');
			this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.NO_PLUGIN_ID'));
			return this.router.createUrlTree(['/settings/marketplace-plugins']);
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
					// Show subscription dialog
					return this.showSubscriptionDialog(pluginId, state.url);
				}

				// Plugin doesn't require subscription but user doesn't have access
				// This might be a free plugin or configuration issue
				this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.NO_ACCESS'));
				return of(this.router.createUrlTree(['/settings/marketplace-plugins']));
			}),
			catchError((error) => {
				console.error('PluginAccessGuard: Error checking access', error);
				this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.CHECK_FAILED'));
				return of(this.router.createUrlTree(['/settings/marketplace-plugins']));
			})
		);
	}

	/**
	 * Show appropriate subscription dialog based on user's current subscription status.
	 * Users with active subscriptions are routed to PluginSubscriptionManager.
	 * Users without active subscriptions are routed to PluginSubscriptionPlanSelection.
	 */
	private showSubscriptionDialog(pluginId: string, returnUrl: string): Observable<boolean | UrlTree> {
		return new Observable((observer) => {
			// Get plugin data first
			this.marketplaceQuery.plugin$
				.pipe(
					take(1),
					switchMap((plugin) => {
						if (!plugin) {
							// Plugin not found, redirect to marketplace
							this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.PLUGIN_NOT_FOUND'));
							observer.next(this.router.createUrlTree(['/settings/marketplace-plugins']));
							observer.complete();
							return of(null);
						}

						// Open appropriate dialog based on subscription status
						return this.subscriptionDialogRouter.openSubscriptionDialog(plugin);
					})
				)
				.subscribe({
					next: (result) => {
						if (!result) {
							// Dialog was closed or plugin not found
							this.toastrService.info(
								this.translateService.instant('PLUGIN.ACCESS.SUBSCRIPTION_CANCELLED')
							);
							observer.next(this.router.createUrlTree(['/settings/marketplace-plugins']));
							observer.complete();
							return;
						}

						if (result?.proceedWithInstallation) {
							// User successfully subscribed, allow navigation
							this.toastrService.success(
								this.translateService.instant('PLUGIN.ACCESS.SUBSCRIPTION_SUCCESS')
							);

							// Refresh access check
							this.accessFacade.refreshPluginAccess(pluginId);

							observer.next(true);
							observer.complete();
						} else {
							// User cancelled subscription, redirect to marketplace
							this.toastrService.info(
								this.translateService.instant('PLUGIN.ACCESS.SUBSCRIPTION_CANCELLED')
							);
							observer.next(this.router.createUrlTree(['/settings/marketplace-plugins']));
							observer.complete();
						}
					},
					error: (error) => {
						console.error('PluginAccessGuard: Error in subscription dialog', error);
						this.toastrService.error(this.translateService.instant('PLUGIN.ACCESS.SUBSCRIPTION_FAILED'));
						observer.next(this.router.createUrlTree(['/settings/marketplace-plugins']));
						observer.complete();
					}
				});
		});
	}
}
