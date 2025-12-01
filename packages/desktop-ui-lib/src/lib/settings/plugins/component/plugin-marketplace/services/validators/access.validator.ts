import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	IInstallationValidationContext,
	InstallationValidator,
	IValidationStepResult
} from '../installation-validator.abstract';
import { PluginAccessGuard } from '../plugin-access.guard';

/**
 * Validates plugin access before installation
 * Checks if user has permission to install the plugin
 */
@Injectable({
	providedIn: 'root'
})
export class AccessValidator extends InstallationValidator {
	constructor(private readonly accessGuard: PluginAccessGuard) {
		super();
	}

	protected doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult> {
		// Validate input context
		if (!context || !context.plugin) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.INVALID_CONTEXT',
				metadata: { accessValidated: false, validationError: true }
			});
		}

		const { plugin } = context;

		// Validate plugin ID
		if (!plugin.id) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.MISSING_PLUGIN_ID',
				metadata: { accessValidated: false, missingPluginId: true }
			});
		}

		// Free plugins don't need access validation
		if (!plugin.hasPlan) {
			return of({
				canProceed: true,
				metadata: {
					accessValidated: true,
					requiresSubscription: false,
					pluginType: 'free'
				}
			});
		}

		// Check access for subscription-based plugins
		return this.accessGuard.checkPluginAccess(plugin).pipe(
			map((accessResult) => {
				if (!accessResult) {
					return {
						canProceed: false,
						error: 'PLUGIN.VALIDATION.ACCESS_CHECK_FAILED',
						metadata: {
							accessValidated: false,
							checkFailed: true
						}
					};
				}

				return {
					canProceed: accessResult.hasAccess,
					error: accessResult.hasAccess ? undefined : 'PLUGIN.VALIDATION.ACCESS_DENIED',
					metadata: {
						accessValidated: true,
						hasAccess: accessResult.hasAccess,
						requiresSubscription: true,
						pluginType: 'subscription',
						accessReason: accessResult.reason,
						accessLevel: accessResult.accessLevel
					}
				};
			})
		);
	}
}
