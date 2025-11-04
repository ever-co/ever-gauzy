import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { Observable } from 'rxjs';
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
export class PluginInstallationFacade {
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
	validateInstallation(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		const strategy = this.getStrategyForPlugin(plugin);
		return strategy.validateInstallation(plugin);
	}

	/**
	 * Prepares plugin for installation
	 * Handles subscription requirements, access checks, etc.
	 * @param plugin Plugin to prepare
	 * @returns Observable that completes when ready for installation
	 */
	prepareForInstallation(plugin: IPlugin): Observable<void> {
		const strategy = this.getStrategyForPlugin(plugin);
		return strategy.prepareForInstallation(plugin);
	}

	/**
	 * Validates and prepares plugin for installation in one call
	 * @param plugin Plugin to validate and prepare
	 * @returns Observable that completes when ready for installation
	 */
	validateAndPrepare(plugin: IPlugin): Observable<IInstallationPreparationResult> {
		return this.validateInstallation(plugin).pipe(
			tap((result) => {
				console.log('[PluginInstallationFacade] Validation result:', result);
			}),
			switchMap((result) => {
				if (!result.canProceed && result.requiresSubscription) {
					// Need to prepare (get subscription)
					return this.prepareForInstallation(plugin).pipe(switchMap(() => this.validateInstallation(plugin)));
				}
				// Already can proceed
				return new Observable<IInstallationPreparationResult>((observer) => {
					observer.next(result);
					observer.complete();
				});
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
