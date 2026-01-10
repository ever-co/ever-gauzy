import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { concatMap, switchMap } from 'rxjs/operators';
import {
	IInstallationValidationContext,
	InstallationValidator,
	IValidationStepResult
} from '../installation-validator.abstract';
import { PluginInstallationContext } from '../plugin-installation.context';

/**
 * Validates subscription requirements before installation
 * Ensures user has proper subscription if required
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionValidator extends InstallationValidator {
	constructor(private readonly installation: PluginInstallationContext) {
		super();
	}

	protected doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult> {
		// Validate input context
		if (!context || !context.plugin) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.INVALID_CONTEXT',
				metadata: { subscriptionValidated: false, validationError: true }
			});
		}

		const { plugin } = context;

		// Check if subscription is required
		try {
			if (!this.installation.requiresSubscription(plugin)) {
				console.log(`[SubscriptionValidator] Plugin ${plugin.name} does not require subscription`);
				return of({
					canProceed: true,
					metadata: {
						subscriptionRequired: false,
						subscriptionValidated: true,
						pluginType: 'free'
					}
				});
			}
		} catch (error) {
			console.error('[SubscriptionValidator] Error checking subscription requirement:', error);
			return of({
				canProceed: false,
				error: `PLUGIN.VALIDATION.SUBSCRIPTION_CHECK_ERROR: ${error?.message || 'Unknown error'}`,
				metadata: { subscriptionValidated: false, checkError: true }
			});
		}

		console.log(`[SubscriptionValidator] Validating subscription for plugin ${plugin.name}`);

		// Validate subscription
		return this.installation.validate(plugin).pipe(
			concatMap((validationResult) => {
				if (!validationResult) {
					return of({
						canProceed: false,
						error: 'PLUGIN.VALIDATION.SUBSCRIPTION_VALIDATION_FAILED',
						metadata: { subscriptionValidated: false, validationFailed: true }
					});
				}

				if (!validationResult.canProceed) {
					console.log(
						`[SubscriptionValidator] Subscription needed for ${plugin.name} - opening subscription dialog`
					);

					// Open subscription dialog - user must complete subscription and retry
					// We don't wait for subscription creation as it's an async user action
					return this.installation.prepare(plugin).pipe(
						switchMap(() => {
							// prepare() completes after opening dialog
							// Block installation - user needs to subscribe first
							console.log(`[SubscriptionValidator] Subscription dialog opened for ${plugin.name}`);
							return of({
								canProceed: false,
								error: 'PLUGIN.SUBSCRIPTION.REQUIRED',
								metadata: {
									subscriptionRequired: true,
									subscriptionDialogOpened: true,
									subscriptionValidated: false,
									userMustSubscribe: true
								}
							});
						})
					);
				}

				// Already has subscription
				console.log(`[SubscriptionValidator] Plugin ${plugin.name} has active subscription`);
				return of({
					canProceed: true,
					metadata: {
						subscriptionRequired: true,
						hasActiveSubscription: true,
						subscriptionValidated: true,
						validationReason: validationResult.reason
					}
				});
			})
		);
	}
}
