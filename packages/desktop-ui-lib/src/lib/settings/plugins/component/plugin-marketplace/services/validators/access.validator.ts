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
		// Free plugins don't need access validation
		if (!context.plugin.hasPlan) {
			return of({
				canProceed: true,
				metadata: { accessValidated: true, requiresSubscription: false }
			});
		}

		// Check access for subscription-based plugins
		return this.accessGuard.checkPluginAccess(context.plugin).pipe(
			map((accessResult) => ({
				canProceed: accessResult.hasAccess,
				error: accessResult.hasAccess ? undefined : 'Access denied: Active subscription required',
				metadata: {
					accessValidated: true,
					hasAccess: accessResult.hasAccess,
					requiresSubscription: true
				}
			}))
		);
	}
}
