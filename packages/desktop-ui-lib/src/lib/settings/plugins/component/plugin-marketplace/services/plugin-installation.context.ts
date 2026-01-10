import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Observable, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { FreePluginInstallationStrategy } from './free-plugin-installation.strategy';
import { IInstallationPreparationResult, IPluginInstallationStrategy } from './plugin-installation-strategy.interface';
import { SubscriptionPluginInstallationStrategy } from './subscription-plugin-installation.strategy';

/**
 * Facade for plugin installation process
 * Follows Facade Pattern - provides simplified interface to complex subsystem
 * Follows Single Responsibility - coordinates installation flow
 * Follows Dependency Inversion - depends on strategy abstractions
 *
 * This facade:
 * 1. Selects appropriate strategy based on plugin type
 * 2. Validates installation prerequisites
 * 3. Prepares plugin for installation
 * 4. Coordinates the installation flow
 */
@Injectable({
	providedIn: 'root'
})
export class PluginInstallationContext {
	private readonly strategies: IPluginInstallationStrategy[];

	constructor(
		private readonly freeStrategy: FreePluginInstallationStrategy,
		private readonly subscriptionStrategy: SubscriptionPluginInstallationStrategy
	) {
		// Register all available strategies
		this.strategies = [this.subscriptionStrategy, this.freeStrategy];
	}

	/**
	 * Validates if plugin installation can proceed
	 * @param plugin Plugin to validate
	 * @returns Observable with validation result
	 */
	validate(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		const strategy = this.getStrategyForPlugin(plugin);
		return strategy.validate(plugin);
	}

	/**
	 * Prepares plugin for installation
	 * Handles subscription requirements, access checks, etc.
	 * @param plugin Plugin to prepare
	 * @returns Observable that completes when ready for installation
	 */
	prepare(plugin: IPlugin): Observable<void> {
		const strategy = this.getStrategyForPlugin(plugin);
		return strategy.prepare(plugin);
	}

	/**
	 * Validates and prepares plugin for installation in one call
	 * If subscription is required but missing, opens subscription dialog and returns failure.
	 * User must complete subscription and retry installation.
	 * @param plugin Plugin to validate and prepare
	 * @returns Observable with validation result
	 */
	validateAndPrepare(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		return this.validate(plugin).pipe(
			tap((result) => {
				console.log('[PluginInstallationContext] Validation result:', result);
			}),
			switchMap((result) => {
				if (!result.canProceed && result.requiresSubscription) {
					// Open subscription dialog - but don't wait for subscription
					// User will need to complete subscription and retry installation
					return this.prepare(plugin).pipe(
						switchMap(() => of(result)) // Return original result (canProceed: false)
					);
				}
				// Already can proceed or doesn't require subscription
				return of(result);
			})
		);
	}

	/**
	 * Checks if plugin requires subscription
	 * @param plugin Plugin to check
	 * @returns true if subscription is required
	 */
	requiresSubscription(plugin: IPlugin): boolean {
		return plugin.hasPlan;
	}

	/**
	 * Gets the appropriate strategy for the plugin
	 * Follows Strategy Pattern selection logic
	 * @param plugin Plugin to get strategy for
	 * @returns Installation strategy
	 * @throws Error if no strategy can handle the plugin
	 */
	private getStrategyForPlugin(plugin: IPlugin): IPluginInstallationStrategy {
		const strategy = this.strategies.find((s) => s.canHandle(plugin));

		if (!strategy) {
			throw new Error(`No installation strategy found for plugin: ${plugin.name} (hasPlan: ${plugin.hasPlan})`);
		}

		return strategy;
	}
}
