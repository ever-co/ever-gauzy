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
		// Validate input context
		if (!context || !context.plugin) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.INVALID_CONTEXT',
				metadata: { statusValidated: false, validationError: true }
			});
		}

		const { plugin, isUpdate } = context;

		// Validate plugin has required fields
		if (!plugin.id || !plugin.name) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.MISSING_REQUIRED_FIELDS',
				metadata: {
					statusValidated: false,
					missingFields: {
						id: !plugin.id,
						name: !plugin.name
					}
				}
			});
		}

		// Check if plugin is active
		if (plugin.status !== PluginStatus.ACTIVE) {
			return of({
				canProceed: false,
				error: `PLUGIN.VALIDATION.PLUGIN_NOT_ACTIVE`,
				metadata: {
					statusValidated: false,
					currentStatus: plugin.status,
					requiredStatus: PluginStatus.ACTIVE
				}
			});
		}

		// Check if plugin has versions
		if (!plugin.versions || plugin.versions.length === 0) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.NO_VERSIONS_AVAILABLE',
				metadata: {
					statusValidated: false,
					hasVersions: false,
					versionCount: 0
				}
			});
		}

		// Check if plugin has a current version
		if (!plugin.version) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.VERSION_INFO_MISSING',
				metadata: {
					statusValidated: false,
					hasCurrentVersion: false,
					availableVersionCount: plugin.versions.length
				}
			});
		}

		// Additional check for update scenario - verify plugin is actually installed
		if (isUpdate && !plugin.installed) {
			return of({
				canProceed: false,
				error: 'PLUGIN.VALIDATION.CANNOT_UPDATE_NOT_INSTALLED',
				metadata: {
					statusValidated: false,
					isUpdate: true,
					isInstalled: false
				}
			});
		}

		return of({
			canProceed: true,
			metadata: {
				statusValidated: true,
				pluginStatus: plugin.status,
				pluginId: plugin.id,
				pluginName: plugin.name,
				availableVersions: plugin.versions.length,
				currentVersion: plugin.version?.number,
				isUpdate,
				isInstalled: plugin.installed
			}
		});
	}
}
