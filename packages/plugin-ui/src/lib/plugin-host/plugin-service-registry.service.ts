import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';

/**
 * Describes a registered cross-plugin service.
 */
export interface PluginServiceRegistration<T = unknown> {
	/** Unique contract identifier (e.g. 'analytics:tracker', 'auth:session'). */
	contractId: string;
	/** The service instance. */
	instance: T;
	/** Plugin ID of the provider. */
	pluginId: string;
	/** Optional version string for contract compatibility checks. */
	version?: string;
}

/**
 * Cross-plugin service registry.
 *
 * Allows Plugin A to expose a service implementation and Plugin B to consume it,
 * using a contract-based approach (string contract IDs).
 *
 * Services are registered with a contract ID and can be retrieved synchronously
 * or observed reactively for late-arriving providers.
 *
 * Convention: use `'pluginId:serviceName'` as contract IDs.
 *
 * @example
 * ```ts
 * // Plugin A (provider) — in ngOnPluginBootstrap or bootstrap callback:
 * const serviceRegistry = injector.get(PluginServiceRegistryService);
 * serviceRegistry.register({
 *   contractId: 'analytics:tracker',
 *   instance: new AnalyticsTracker(),
 *   pluginId: 'analytics-plugin'
 * });
 *
 * // Plugin B (consumer):
 * const tracker = serviceRegistry.get<AnalyticsTracker>('analytics:tracker');
 * if (tracker) {
 *   tracker.track('page-view', { page: '/dashboard' });
 * }
 *
 * // Or reactively (wait for late registration):
 * serviceRegistry.get$<AnalyticsTracker>('analytics:tracker').subscribe(tracker => {
 *   if (tracker) tracker.track('page-view', { page: '/dashboard' });
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PluginServiceRegistryService {
	private readonly _services$ = new BehaviorSubject<Map<string, PluginServiceRegistration>>(new Map());

	// Plugin to contract mapping for cleanup
	private readonly _pluginToContracts = new Map<string, string[]>();

	// ─── Registration ───────────────────────────────────────────────────────

	/**
	 * Registers a service under a contract ID.
	 * Overwrites any existing registration for the same contract ID.
	 */
	register<T>(registration: PluginServiceRegistration<T>): void {
		const services = new Map(this._services$.value);
		services.set(registration.contractId, registration as PluginServiceRegistration);
		this._services$.next(services);

		// Track for plugin cleanup
		const contracts = this._pluginToContracts.get(registration.pluginId) ?? [];
		if (!contracts.includes(registration.contractId)) {
			contracts.push(registration.contractId);
			this._pluginToContracts.set(registration.pluginId, contracts);
		}
	}

	/**
	 * Unregisters a service by contract ID.
	 */
	unregister(contractId: string): void {
		const services = new Map(this._services$.value);
		services.delete(contractId);
		this._services$.next(services);
	}

	/**
	 * Unregisters all services provided by a plugin.
	 * Call from `ngOnPluginDestroy` or plugin cleanup logic.
	 */
	unregisterByPlugin(pluginId: string): void {
		const contracts = this._pluginToContracts.get(pluginId);
		if (contracts) {
			const services = new Map(this._services$.value);
			for (const contractId of contracts) {
				services.delete(contractId);
			}
			this._services$.next(services);
			this._pluginToContracts.delete(pluginId);
		}
	}

	// ─── Retrieval ──────────────────────────────────────────────────────────

	/**
	 * Gets a service instance by contract ID (synchronous).
	 * Returns `undefined` if not registered.
	 */
	get<T>(contractId: string): T | undefined {
		const reg = this._services$.value.get(contractId);
		return reg?.instance as T | undefined;
	}

	/**
	 * Gets a service instance by contract ID, throwing if not found.
	 * Use when the service is required and should have been registered.
	 */
	getRequired<T>(contractId: string): T {
		const instance = this.get<T>(contractId);
		if (instance === undefined) {
			throw new Error(`[PluginServiceRegistry] Required service '${contractId}' is not registered.`);
		}
		return instance;
	}

	/**
	 * Observes a service by contract ID (reactive).
	 * Emits `undefined` initially if not yet registered, then the instance
	 * when it becomes available.
	 */
	get$<T>(contractId: string): Observable<T | undefined> {
		return this._services$.pipe(
			map((services) => services.get(contractId)?.instance as T | undefined)
		);
	}

	/**
	 * Returns the full registration metadata for a contract.
	 */
	getRegistration(contractId: string): PluginServiceRegistration | undefined {
		return this._services$.value.get(contractId);
	}

	// ─── Query ──────────────────────────────────────────────────────────────

	/**
	 * Checks if a service is registered under a contract ID.
	 */
	has(contractId: string): boolean {
		return this._services$.value.has(contractId);
	}

	/**
	 * Returns all registered contract IDs.
	 */
	getContractIds(): string[] {
		return Array.from(this._services$.value.keys());
	}

	/**
	 * Returns all registrations for a given plugin.
	 */
	getByPlugin(pluginId: string): PluginServiceRegistration[] {
		const contracts = this._pluginToContracts.get(pluginId) ?? [];
		return contracts
			.map((id) => this._services$.value.get(id))
			.filter((reg): reg is PluginServiceRegistration => reg !== undefined);
	}

	/**
	 * Observable of all registered services (reactive).
	 */
	get all$(): Observable<PluginServiceRegistration[]> {
		return this._services$.pipe(map((services) => Array.from(services.values())));
	}

	/**
	 * Clears all registrations.
	 */
	clear(): void {
		this._services$.next(new Map());
		this._pluginToContracts.clear();
	}
}
