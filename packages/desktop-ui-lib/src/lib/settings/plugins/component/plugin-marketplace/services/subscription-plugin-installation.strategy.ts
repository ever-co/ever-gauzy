import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';
import { ToastrNotificationService } from '../../../../../services';
import { PluginSubscriptionSelectionComponent } from '../plugin-subscription-selection/plugin-subscription-selection.component';
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
		private readonly dialogService: NbDialogService,
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
				reason: hasAccess
					? 'Active subscription found'
					: 'No active subscription - user must subscribe first'
			}))
		);
	}

	/**
	 * Prepares plugin for installation by ensuring subscription exists
	 * Shows subscription dialog if needed
	 */
	prepareForInstallation(plugin: IPlugin): Observable<void> {
		return this.validateInstallation(plugin).pipe(
			switchMap((result) => {
				if (result.canProceed) {
					// Already has access, no preparation needed
					return new Observable<void>((observer) => {
						observer.next();
						observer.complete();
					});
				}

				// No access - show subscription dialog
				this.toastrService.info(
					this.translateService.instant('PLUGIN.SUBSCRIPTION.REQUIRED_FOR_INSTALLATION')
				);

				return new Observable<void>((observer) => {
					this.dialogService
						.open(PluginSubscriptionSelectionComponent, {
							context: {
								plugin: plugin,
								pluginId: plugin.id
							},
							backdropClass: 'backdrop-blur',
							closeOnEsc: false
						})
						.onClose.pipe(take(1))
						.subscribe({
							next: (subscriptionResult) => {
								if (subscriptionResult?.proceedWithInstallation) {
									// Verify access was granted after subscription
									this.accessFacade
										.hasAccess$(plugin.id)
										.pipe(take(1))
										.subscribe({
											next: (hasAccess) => {
												if (hasAccess) {
													observer.next();
													observer.complete();
												} else {
													this.toastrService.error(
														this.translateService.instant(
															'PLUGIN.SUBSCRIPTION.ACCESS_NOT_GRANTED'
														)
													);
													observer.error(new Error('Access not granted after subscription'));
												}
											},
											error: (err) => observer.error(err)
										});
								} else {
									observer.error(new Error('User cancelled subscription'));
								}
							},
							error: (err) => observer.error(err)
						});
				});
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
