import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { EMPTY, Observable, of } from 'rxjs';
import { IInstallationPreparationResult, IPluginInstallationStrategy } from './plugin-installation-strategy.interface';

/**
 * Strategy for installing free plugins (no subscription required)
 * Follows Single Responsibility Principle - handles only free plugin logic
 * Follows Open/Closed Principle - can be extended without modifying existing code
 */
@Injectable({
	providedIn: 'root'
})
export class FreePluginInstallationStrategy implements IPluginInstallationStrategy {
	/**
	 * Validates free plugin installation
	 * Free plugins can always be installed
	 */
	public validate(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		return of({
			canProceed: true,
			requiresSubscription: false,
			reason: 'Free plugin - no subscription required'
		});
	}

	/**
	 * Prepares free plugin for installation
	 * No preparation needed for free plugins
	 */
	public prepare(plugin: IPlugin): Observable<void> {
		return EMPTY;
	}

	/**
	 * Checks if this strategy handles the plugin
	 * Handles plugins without subscription plans
	 */
	public canHandle(plugin: IPlugin): boolean {
		return !plugin.hasPlan;
	}
}
