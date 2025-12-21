import { IPlugin } from '@gauzy/contracts';
import { Observable } from 'rxjs';

/**
 * Result of installation preparation
 * Contains information needed to proceed with installation
 */
export interface IInstallationPreparationResult {
	canProceed: boolean;
	reason?: string;
	requiresSubscription: boolean;
	hasActiveSubscription?: boolean;
}

/**
 * Strategy interface for plugin installation validation
 * Follows Strategy Pattern and Interface Segregation Principle
 *
 * Each implementation handles a specific type of plugin (free, subscription-based)
 */
export interface IPluginInstallationStrategy {
	/**
	 * Validates if installation can proceed
	 * @param plugin Plugin to validate
	 * @returns Observable with validation result
	 */
	validate(plugin: IPlugin): Observable<IInstallationPreparationResult>;

	/**
	 * Prepares the plugin for installation
	 * Handles any prerequisites (e.g., subscription, access checks)
	 * @param plugin Plugin to prepare
	 * @returns Observable that completes when preparation is done
	 */
	prepare(plugin: IPlugin): Observable<void>;

	/**
	 * Checks if this strategy can handle the given plugin
	 * @param plugin Plugin to check
	 * @returns true if this strategy applies
	 */
	canHandle(plugin: IPlugin): boolean;
}
