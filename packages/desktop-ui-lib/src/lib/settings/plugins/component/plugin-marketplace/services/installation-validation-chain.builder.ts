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
 */
@Injectable({
	providedIn: 'root'
})
export class InstallationValidationChainBuilder {
	constructor(
		private readonly statusValidator: PluginStatusValidator,
		private readonly subscriptionValidator: SubscriptionValidator,
		private readonly accessValidator: AccessValidator
	) {}

	/**
	 * Builds validation chain for new installation
	 * Order: Status → Subscription → Access
	 */
	buildForNewInstallation(): InstallationValidator {
		// Create fresh instances to avoid state pollution
		const statusCheck = this.statusValidator;
		const subscriptionCheck = this.subscriptionValidator;
		const accessCheck = this.accessValidator;

		statusCheck.setNext(subscriptionCheck);
		subscriptionCheck.setNext(accessCheck);

		return statusCheck;
	}

	/**
	 * Builds validation chain for update
	 * Order: Status → Access (subscription already exists)
	 */
	buildForUpdate(): InstallationValidator {
		const statusCheck = this.statusValidator;
		const accessCheck = this.accessValidator;

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
		const context: IInstallationValidationContext = {
			plugin,
			isUpdate,
			errors: [],
			warnings: [],
			metadata: {}
		};

		const chain = isUpdate ? this.buildForUpdate() : this.buildForNewInstallation();
		return chain.validate(context);
	}

	/**
	 * Quick check if installation can proceed
	 * @param plugin Plugin to check
	 * @param isUpdate Whether this is an update
	 * @returns Observable<boolean>
	 */
	canProceedWithInstallation(plugin: IPlugin, isUpdate: boolean = false): Observable<boolean> {
		return new Observable<boolean>((observer) => {
			this.validate(plugin, isUpdate).subscribe({
				next: (context) => {
					observer.next(context.errors.length === 0);
					observer.complete();
				},
				error: (err) => {
					observer.next(false);
					observer.complete();
				}
			});
		});
	}
}
