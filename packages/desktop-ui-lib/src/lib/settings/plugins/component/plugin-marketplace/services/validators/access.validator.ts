import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PluginSubscriptionAccessService } from '../../../../services/plugin-subscription-access.service';
import {
	IInstallationValidationContext,
	InstallationValidator,
	IValidationStepResult
} from '../installation-validator.abstract';

/**
 * Validates plugin access before installation
 * Checks if user has permission to install the plugin
 */
@Injectable({
	providedIn: 'root'
})
export class AccessValidator extends InstallationValidator {
	constructor(private readonly accessService: PluginSubscriptionAccessService) {
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
		return this.accessService.checkAccess(plugin.id).pipe(
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
						accessReason: 'Subscription access check',
						accessLevel: accessResult.accessLevel
					}
				};
			}),
			catchError((error) => {
				console.error('[AccessValidator] Error checking access:', error);
				return of({
					canProceed: false,
					error: `PLUGIN.VALIDATION.ACCESS_CHECK_ERROR: ${error?.message || 'Unknown error'}`,
					metadata: { accessValidated: false, checkError: true }
				});
			})
		);
	}
}
