import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { map, Observable, of, switchMap, take } from 'rxjs';
import { PluginSubscriptionFacade } from '../+state';
import { IPluginSubscription } from '../../../services/plugin-subscription.service';
import { PluginSubscriptionManagerComponent } from '../plugin-subscription-manager/plugin-subscription-manager.component';
import {
	IPluginSubscriptionPlanSelectionResult,
	PluginSubscriptionPlanSelectionComponent
} from '../plugin-subscription-plan-selection/plugin-subscription-plan-selection.component';

/**
 * Service responsible for routing users to the appropriate subscription dialog
 * based on their current subscription status.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles only subscription dialog routing logic
 * - Open/Closed: Extensible for new subscription dialog types
 * - Liskov Substitution: Uses interfaces and abstractions
 * - Interface Segregation: Focused public API
 * - Dependency Inversion: Depends on abstractions (facade, dialog service)
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionDialogRouterService {
	constructor(
		private readonly dialogService: NbDialogService,
		private readonly subscriptionFacade: PluginSubscriptionFacade
	) {}

	/**
	 * Opens the appropriate subscription dialog based on user's subscription status
	 *
	 * @param plugin The plugin for which to open the subscription dialog
	 * @returns Observable that emits the dialog result
	 */
	public openSubscriptionDialog(plugin: IPlugin): Observable<IPluginSubscriptionPlanSelectionResult | null> {
		if (!plugin?.id) {
			console.error('[SubscriptionDialogRouter] Invalid plugin provided');
			return of(null);
		}

		// Check if user has an active subscription for this plugin
		return this.subscriptionFacade.getActiveSubscriptionForPlugin(plugin.id).pipe(
			take(1),
			switchMap((activeSubscription) => {
				if (activeSubscription) {
					// User has active subscription - route to PluginSubscriptionManager
					console.log(
						'[SubscriptionDialogRouter] Active subscription found, opening SubscriptionManager',
						activeSubscription
					);
					return this.openSubscriptionManager(plugin, activeSubscription);
				} else {
					// User has no active subscription - route to PluginSubscriptionPlanSelection
					console.log('[SubscriptionDialogRouter] No active subscription, opening PlanSelection');
					return this.openPlanSelection(plugin);
				}
			})
		);
	}

	/**
	 * Opens the PluginSubscriptionManager dialog for users with active subscriptions
	 *
	 * @param plugin The plugin to manage
	 * @param currentSubscription The user's active subscription
	 * @returns Observable that emits when the dialog closes
	 */
	private openSubscriptionManager(
		plugin: IPlugin,
		currentSubscription: IPluginSubscription
	): Observable<IPluginSubscriptionPlanSelectionResult | null> {
		return this.dialogService
			.open(PluginSubscriptionManagerComponent, {
				context: {
					plugin: plugin,
					currentSubscription: currentSubscription
				},
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(
				take(1),
				map((result) => {
					if (result?.success) {
						console.log('[SubscriptionDialogRouter] Subscription manager action completed:', result.action);
						// Map to plan selection result format for consistency
						return {
							subscriptionPlan: result.subscription || null,
							subscriptionInput: null,
							proceedWithInstallation: false // Don't proceed with installation when managing existing subscription
						} as IPluginSubscriptionPlanSelectionResult;
					}
					return null;
				})
			);
	}

	/**
	 * Opens the PluginSubscriptionPlanSelection dialog for users without active subscriptions
	 *
	 * @param plugin The plugin to subscribe to
	 * @returns Observable that emits when the dialog closes
	 */
	private openPlanSelection(plugin: IPlugin): Observable<IPluginSubscriptionPlanSelectionResult | null> {
		return this.dialogService
			.open(PluginSubscriptionPlanSelectionComponent, {
				context: {
					plugin: plugin,
					pluginId: plugin.id
				},
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(take(1));
	}

	/**
	 * Determines if a user should be routed to the subscription manager
	 *
	 * @param pluginId The plugin ID to check
	 * @returns Observable<boolean> indicating if user has an active subscription
	 */
	public shouldRouteToManager(pluginId: string): Observable<boolean> {
		return this.subscriptionFacade.hasActiveSubscriptionForPlugin(pluginId);
	}

	/**
	 * Determines if a user should be routed to the plan selection
	 *
	 * @param pluginId The plugin ID to check
	 * @returns Observable<boolean> indicating if user needs to select a plan
	 */
	public shouldRouteToPlanSelection(pluginId: string): Observable<boolean> {
		return this.shouldRouteToManager(pluginId).pipe(map((hasActive) => !hasActive));
	}
}
