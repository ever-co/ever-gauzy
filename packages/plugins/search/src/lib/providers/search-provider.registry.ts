import { Injectable, Logger } from '@nestjs/common';
import { ISearchProvider, ISearchProviderHealth } from '@gauzy/contracts';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';
import { DatabaseSearchProvider } from './database-search.provider';

/**
 * The seam between a query and the backend that answers it.
 *
 * One contract, and a built-in implementation that is always present. The database provider is
 * registered the moment this registry is constructed, so "no external engine is configured" is a
 * first-class deployment rather than a degraded one: a search answered by `search_document` is the
 * same code path, the same contract and the same result shape as a search answered by an engine.
 *
 * Nothing in this package depends on an engine. A deployment that has one registers a provider through
 * {@link SearchProviderRegistry.register} and names its key in configuration; a deployment that does
 * not never loads one, and nothing else in the package changes.
 */
@Injectable()
export class SearchProviderRegistry {
	private readonly logger = new Logger(SearchProviderRegistry.name);
	private readonly providers = new Map<string, ISearchProvider>();

	/** The key the deployment configured, empty when it configured none. */
	private engineKey: string = SEARCH_SETTING_DEFAULTS.engineKey;

	constructor(private readonly databaseSearchProvider: DatabaseSearchProvider) {
		this.register(databaseSearchProvider);
	}

	/**
	 * The key of the built-in provider — the one that always answers when nothing else can.
	 */
	get defaultKey(): string {
		return this.databaseSearchProvider.key;
	}

	/**
	 * The engine key the deployment configured.
	 */
	get configuredEngineKey(): string {
		return this.engineKey;
	}

	/**
	 * Names the engine provider a query should be answered by.
	 *
	 * Setting the key does not verify it: an operator may configure an engine before its package is
	 * loaded, and a typo must degrade to the built-in provider rather than refuse to boot. Resolution
	 * is where the key is checked, and where an unusable one is reported.
	 *
	 * @param key The provider key, or an empty value for the built-in provider.
	 */
	configureEngine(key?: string): void {
		this.engineKey = String(key ?? '').trim();
	}

	/**
	 * Registers a provider.
	 *
	 * Registering the same provider twice is a no-op, because a package loaded twice must register
	 * once. Registering a *different* provider under a key that is already taken is an error: two
	 * backends behind one key would answer the same query differently depending on load order.
	 *
	 * @param provider The provider.
	 * @throws Error when the declaration is unusable or the key is taken by another provider.
	 */
	register(provider: ISearchProvider): void {
		if (!provider?.key) {
			throw new Error('A search provider must declare a key.');
		}

		const registered = this.providers.get(provider.key);

		if (registered === provider) {
			return;
		}

		if (registered) {
			throw new Error(
				`The search provider key "${provider.key}" is already registered. A second provider behind ` +
					'one key would answer the same query differently depending on load order.'
			);
		}

		this.providers.set(provider.key, provider);
	}

	/**
	 * Stops a provider answering queries.
	 *
	 * The built-in provider is never unregistered: a registry without it would have nothing to fall
	 * back to, and a search that cannot be answered at all is worse than a slower one.
	 *
	 * @param key The provider key.
	 */
	unregister(key: string): void {
		if (key === this.defaultKey) {
			return;
		}

		this.providers.delete(key);
	}

	/**
	 * One registered provider by key.
	 *
	 * @param key The provider key.
	 * @returns The provider, or `undefined` when no provider claims the key.
	 */
	get(key: string): ISearchProvider | undefined {
		return this.providers.get(String(key ?? '').trim());
	}

	/**
	 * Every registered provider, the built-in one first.
	 *
	 * @returns The providers.
	 */
	list(): ISearchProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * The provider that answers a query, and the fallback that keeps search working.
	 *
	 * The fallback is deliberate and it is the reason the capability can ship at all: when no engine is
	 * configured, when the configured key names nothing registered, or when the engine reports
	 * unhealthy, the built-in database provider answers. A deployment that mislays an engine key loses
	 * ranking quality, not search.
	 *
	 * @param engineKey The definition's engine key, or nothing to use the configured one.
	 * @returns The provider to query, and the provider that actually answered.
	 */
	async resolve(engineKey?: string): Promise<{ provider: ISearchProvider; providerKey: string; fallback: boolean }> {
		const key = String(engineKey ?? '').trim() || this.engineKey;

		if (!key || key === this.defaultKey) {
			return { provider: this.databaseSearchProvider, providerKey: this.databaseSearchProvider.key, fallback: false };
		}

		const provider = this.providers.get(key);

		if (!provider) {
			this.logger.warn(
				`No search provider is registered for the engine key "${key}". The built-in database provider answers instead.`
			);

			return { provider: this.databaseSearchProvider, providerKey: this.databaseSearchProvider.key, fallback: true };
		}

		const health = await provider.health().catch(
			(error): ISearchProviderHealth => ({
				key: provider.key,
				healthy: false,
				external: provider.external,
				detail: (error as Error)?.message ?? String(error)
			})
		);

		if (!health.healthy) {
			this.logger.warn(
				`The search provider "${provider.key}" reports unhealthy, so the built-in database provider answers: ${health.detail ?? 'no detail'}`
			);

			return { provider: this.databaseSearchProvider, providerKey: this.databaseSearchProvider.key, fallback: true };
		}

		return { provider, providerKey: provider.key, fallback: false };
	}

	/**
	 * What every registered provider reports about itself.
	 *
	 * @returns One health report per provider, in registration order.
	 */
	async health(): Promise<ISearchProviderHealth[]> {
		return Promise.all(
			this.list().map((provider) =>
				provider.health().catch(
					(error): ISearchProviderHealth => ({
						key: provider.key,
						healthy: false,
						external: provider.external,
						detail: (error as Error)?.message ?? String(error)
					})
				)
			)
		);
	}
}
