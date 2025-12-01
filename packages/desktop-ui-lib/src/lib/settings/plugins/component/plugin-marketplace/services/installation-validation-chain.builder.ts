import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { IInstallationValidationContext, InstallationValidator } from './installation-validator.abstract';
import { AccessValidator } from './validators/access.validator';
import { PluginStatusValidator } from './validators/plugin-status.validator';
import { SubscriptionValidator } from './validators/subscription.validator';

/**
 * Builder for creating validation chains
 * Follows Builder Pattern
 * Follows Single Responsibility - only builds validation chains
 *
 * This builder creates different validation chains for different scenarios:
 * - New installation
 * - Update installation
 * - Reinstallation
 *
 * NOTE: Each validation creates fresh validator instances to prevent state pollution
 * and ensure thread-safety in concurrent validation scenarios.
 */
@Injectable({
	providedIn: 'root'
})
export class InstallationValidationChainBuilder {
	constructor(
		private readonly statusValidatorFactory: PluginStatusValidator,
		private readonly subscriptionValidatorFactory: SubscriptionValidator,
		private readonly accessValidatorFactory: AccessValidator
	) {}

	/**
	 * Builds validation chain for new installation
	 * Order: Status → Subscription → Access
	 * @returns Fresh validation chain with no shared state
	 */
	private buildForNewInstallation(): InstallationValidator {
		// Create fresh instances to avoid state pollution between validations
		const statusCheck = Object.create(this.statusValidatorFactory);
		const subscriptionCheck = Object.create(this.subscriptionValidatorFactory);
		const accessCheck = Object.create(this.accessValidatorFactory);

		statusCheck.setNext(subscriptionCheck);
		subscriptionCheck.setNext(accessCheck);

		return statusCheck;
	}

	/**
	 * Builds validation chain for update
	 * Order: Status → Access (subscription already exists)
	 * @returns Fresh validation chain with no shared state
	 */
	private buildForUpdate(): InstallationValidator {
		// Create fresh instances to avoid state pollution
		const statusCheck = Object.create(this.statusValidatorFactory);
		const accessCheck = Object.create(this.accessValidatorFactory);

		statusCheck.setNext(accessCheck);

		return statusCheck;
	}

	/**
	 * Validates plugin installation using appropriate chain
	 * @param plugin Plugin to validate
	 * @param isUpdate Whether this is an update
	 * @returns Observable with validation context containing errors/warnings
	 */
	validate(plugin: IPlugin, isUpdate: boolean = false): Observable<IInstallationValidationContext> {
		// Validate input
		if (!plugin) {
			return new Observable<IInstallationValidationContext>((observer) => {
				observer.next({
					plugin: null,
					isUpdate,
					errors: ['PLUGIN.VALIDATION.INVALID_PLUGIN'],
					warnings: [],
					metadata: { validationFailed: true }
				});
				observer.complete();
			});
		}

		const context: IInstallationValidationContext = {
			plugin,
			isUpdate,
			errors: [],
			warnings: [],
			metadata: {
				validationStarted: new Date().toISOString(),
				validationType: isUpdate ? 'update' : 'new-installation'
			}
		};

		try {
			const chain = isUpdate ? this.buildForUpdate() : this.buildForNewInstallation();
			return chain.validate(context);
		} catch (error) {
			return new Observable<IInstallationValidationContext>((observer) => {
				context.errors.push(`PLUGIN.VALIDATION.CHAIN_BUILD_ERROR: ${error?.message || 'Unknown error'}`);
				context.metadata.buildError = true;
				observer.next(context);
				observer.complete();
			});
		}
	}

	/**
	 * Quick check if installation can proceed
	 * @param plugin Plugin to check
	 * @param isUpdate Whether this is an update
	 * @returns Observable<boolean>
	 */
	canProceedWithInstallation(plugin: IPlugin, isUpdate: boolean = false): Observable<boolean> {
		return new Observable<boolean>((observer) => {
			if (!plugin) {
				observer.next(false);
				observer.complete();
				return;
			}

			const subscription = this.validate(plugin, isUpdate).subscribe({
				next: (context) => {
					const canProceed = context.errors.length === 0;
					if (!canProceed) {
						console.warn('[ValidationChainBuilder] Validation failed:', context.errors);
					}
					observer.next(canProceed);
					observer.complete();
				},
				error: (err) => {
					console.error('[ValidationChainBuilder] Validation error:', err);
					observer.next(false);
					observer.complete();
				}
			});

			// Cleanup on unsubscribe
			return () => subscription.unsubscribe();
		});
	}
}
