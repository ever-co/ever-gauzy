import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { ToastrNotificationService } from '../../../../../services';
import { PluginSubscriptionAccessService } from '../../../services/plugin-subscription-access.service';
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
		private readonly accessService: PluginSubscriptionAccessService,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService
	) {}

	/**
	 * Validates if user has active subscription for the plugin
	 */
	validate(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		return this.accessService.checkAccess(plugin.id).pipe(
			take(1),
			map(({ hasAccess }) => ({
				canProceed: hasAccess,
				requiresSubscription: true,
				hasActiveSubscription: hasAccess,
				reason: hasAccess ? 'Active subscription found' : 'No active subscription - user must subscribe first'
			})),
			catchError((error) => {
				console.error('[SubscriptionPluginInstallationStrategy] Error checking subscription:', error);
				return of({
					canProceed: false,
					requiresSubscription: true,
					hasActiveSubscription: false,
					reason: `PLUGIN.VALIDATION.SUBSCRIPTION_CHECK_ERROR: ${error?.message || 'Unknown error'}`
				});
			})
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
			switchMap(({ canProceed }) => {
				if (!canProceed)
					this.toastrService.info(
						this.translateService.instant('PLUGIN.SUBSCRIPTION.REQUIRED_FOR_INSTALLATION')
					);
				// Emit a value so upstream validators continue and emit their result
				return of(void 0);
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
