import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { catchError, defer, map, Observable, of, tap } from 'rxjs';
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
	private validate(plugin: IPlugin, isUpdate: boolean = false): Observable<IInstallationValidationContext> {
		if (!plugin) {
			return of({
				plugin: null,
				isUpdate,
				errors: ['PLUGIN.VALIDATION.INVALID_PLUGIN'],
				warnings: [],
				metadata: { validationFailed: true }
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

		return defer(() => (isUpdate ? this.buildForUpdate() : this.buildForNewInstallation()).validate(context)).pipe(
			catchError((error) => {
				context.errors.push(`PLUGIN.VALIDATION.CHAIN_BUILD_ERROR: ${error?.message || 'Unknown error'}`);
				context.metadata.buildError = true;
				return of(context);
			})
		);
	}

	/**
	 * Quick check if installation can proceed
	 * @param plugin Plugin to check
	 * @param isUpdate Whether this is an update
	 * @returns Observable<boolean>
	 */
	canProceedWithInstallation(plugin: IPlugin, isUpdate: boolean = false): Observable<boolean> {
		if (!plugin) {
			return of(false);
		}

		return this.validate(plugin, isUpdate).pipe(
			tap((context) => {
				if (context.errors.length) {
					console.warn('[ValidationChainBuilder] Validation failed:', context.errors);
				}
			}),
			map((context) => context.errors.length === 0),
			catchError((err) => {
				console.error('[ValidationChainBuilder] Validation error:', err);
				return of(false);
			})
		);
	}
}
