import { Injectable } from '@angular/core';
import { PluginStatus } from '@gauzy/contracts';
import { Observable, of } from 'rxjs';
import {
	IInstallationValidationContext,
	InstallationValidator,
	IValidationStepResult
} from '../installation-validator.abstract';

/**
 * Validates plugin status before installation
 * Checks if plugin is in a valid state for installation
 */
@Injectable({
	providedIn: 'root'
})
export class PluginStatusValidator extends InstallationValidator {
	protected doValidate(context: IInstallationValidationContext): Observable<IValidationStepResult> {
		const { plugin } = context;

		// Check if plugin is active
		if (plugin.status !== PluginStatus.ACTIVE) {
			return of({
				canProceed: false,
				error: `Plugin is ${plugin.status}. Only active plugins can be installed.`
			});
		}

		// Check if plugin has versions
		if (!plugin.versions || plugin.versions.length === 0) {
			return of({
				canProceed: false,
				error: 'Plugin has no available versions to install.'
			});
		}

		// Check if plugin has a current version
		if (!plugin.version) {
			return of({
				canProceed: false,
				error: 'Plugin version information is missing.'
			});
		}

		return of({
			canProceed: true,
			metadata: {
				statusValidated: true,
				pluginStatus: plugin.status
			}
		});
	}
}
