import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, Observable, of } from 'rxjs';
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
	validateInstallation(plugin: IPlugin): Observable<IInstallationPreparationResult> {
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
	 */
	prepareForInstallation(plugin: IPlugin) {
		return this.validateInstallation(plugin).pipe(
			switchMap((result) => {
				if (result.canProceed) {
					// Already has access, no preparation needed
					return EMPTY;
				}

				// No access - show appropriate subscription dialog based on user's subscription status
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.REQUIRED_FOR_INSTALLATION'));

				return of(this.actions.dispatch(PluginSubscriptionActions.openSubscriptionManagement(plugin)));
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
