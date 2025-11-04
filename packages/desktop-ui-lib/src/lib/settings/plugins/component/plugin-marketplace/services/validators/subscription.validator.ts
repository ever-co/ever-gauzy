import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
	IInstallationValidationContext,
	InstallationValidator,
	IValidationStepResult
} from '../installation-validator.abstract';
import { PluginInstallationFacade } from '../plugin-installation.facade';

/**
 * Validates subscription requirements before installation
 * Ensures user has proper subscription if required
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionValidator extends InstallationValidator {
	constructor(private readonly installationFacade: PluginInstallationFacade) {
		super();
	}

	protected doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult> {
		const { plugin } = context;

		// Check if subscription is required
		if (!this.installationFacade.requiresSubscription(plugin)) {
			return new Observable<IValidationStepResult>((observer) => {
				observer.next({
					canProceed: true,
					metadata: { subscriptionRequired: false }
				});
				observer.complete();
			});
		}

		// Validate subscription
		return this.installationFacade.validateInstallation(plugin).pipe(
			switchMap((validationResult) => {
				if (!validationResult.canProceed) {
					// Need to get subscription - prepare for installation
					return this.installationFacade.prepareForInstallation(plugin).pipe(
						map(() => ({
							canProceed: true,
							metadata: {
								subscriptionRequired: true,
								subscriptionObtained: true
							}
						}))
					);
				}

				// Already has subscription
				return new Observable<IValidationStepResult>((observer) => {
					observer.next({
						canProceed: true,
						metadata: {
							subscriptionRequired: true,
							hasActiveSubscription: true
						}
					});
					observer.complete();
				});
			})
		);
	}
}
