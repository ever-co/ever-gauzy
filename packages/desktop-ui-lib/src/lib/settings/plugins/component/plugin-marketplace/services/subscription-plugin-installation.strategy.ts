import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { PluginSubscriptionActions } from '../+state';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';
import { ToastrNotificationService } from '../../../../../services';
import { IInstallationPreparationResult, IPluginInstallationStrategy } from './plugin-installation-strategy.interface';

/**
 * Strategy for installing plugins that require subscriptions
 * Follows Single Responsibility Principle - handles only subscription-based plugin logic
 * Follows Dependency Inversion Principle - depends on abstractions (facades, services)
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionPluginInstallationStrategy implements IPluginInstallationStrategy {
	constructor(
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly actions: Actions,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService
	) {}

	/**
	 * Validates if user has active subscription for the plugin
	 */
	validate(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		return this.accessFacade.hasAccess$(plugin.id).pipe(
			take(1),
			map((hasAccess) => ({
				canProceed: hasAccess,
				requiresSubscription: true,
				hasActiveSubscription: hasAccess,
				reason: hasAccess ? 'Active subscription found' : 'No active subscription - user must subscribe first'
			}))
		);
	}

	/**
	 * Prepares plugin for installation by ensuring subscription exists
	 * Shows subscription dialog if needed
	 * Note: This opens the subscription dialog but doesn't wait for subscription creation.
	 * User must complete subscription and retry installation.
	 */
	prepare(plugin: IPlugin): Observable<void> {
		return this.validate(plugin).pipe(
			switchMap((result) => {
				if (result.canProceed) {
					// Already has access, no preparation needed
					return EMPTY;
				}

				// No access - show subscription dialog
				// User must complete subscription flow and retry installation
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.REQUIRED_FOR_INSTALLATION'));
				this.actions.dispatch(PluginSubscriptionActions.openSubscriptionManagement(plugin));

				// Return EMPTY to complete the stream - installation will be blocked
				// User needs to retry after subscribing
				return EMPTY;
			})
		);
	}

	/**
	 * Checks if this strategy handles the plugin
	 * Handles plugins with subscription plans
	 */
	canHandle(plugin: IPlugin): boolean {
		return plugin.hasPlan;
	}
}
