import { Injectable } from '@angular/core';
import { IOnUIPluginBootstrap, IOnUIPluginDestroy } from './ui-plugin.interface';
import { hasUILifecycleMethod } from './ui-plugin.helper';

/**
 * A plugin module instance that may implement bootstrap and/or destroy
 * lifecycle hooks. Used as the type constraint for the registry.
 */
export type UIPluginInstance = Partial<IOnUIPluginBootstrap & IOnUIPluginDestroy>;

/**
 * Root-level registry that tracks all bootstrapped UI plugin module instances.
 *
 * Because Angular lazy-loaded modules live in child injectors, the root
 * bootstrap module cannot reach them via its own `Injector`. Instead,
 * each feature-level `UIPluginModule` registers plugin instances here
 * during bootstrap, and the root module uses this registry during
 * application shutdown.
 *
 * A single place where all plugin instances are reachable regardless of
 * which injector created them.
 *
 * @example
 * ```ts
 * // UIPluginModule (feature-level) registers instances:
 * this._registry.register(pluginInstance);
 *
 * // Root bootstrap module (e.g. AppBootstrapModule) destroys them:
 * await this._registry.destroyAll();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UIPluginRegistryService {
	/** Ordered set of live plugin module instances. */
	private readonly _instances: Set<UIPluginInstance> = new Set();

	/**
	 * Register a plugin module instance.
	 * Called by `UIPluginModule` after successfully bootstrapping a plugin.
	 *
	 * @param instance The plugin module instance (e.g. `JobEmployeeModule`).
	 */
	register(instance: UIPluginInstance): void {
		this._instances.add(instance);
	}

	/**
	 * Remove a plugin module instance from the registry.
	 * Called when a feature module is destroyed (lazy-module unload).
	 *
	 * @param instance The plugin module instance to deregister.
	 */
	deregister(instance: UIPluginInstance): void {
		this._instances.delete(instance);
	}

	/**
	 * Invoke `ngOnPluginDestroy` on every registered plugin and clear the registry.
	 *
	 * Called by the root bootstrap module's `ngOnDestroy()` during application shutdown.
	 */
	async destroyAll(): Promise<void> {
		for (const instance of this._instances) {
			if (hasUILifecycleMethod(instance, 'ngOnPluginDestroy')) {
				try {
					await instance.ngOnPluginDestroy();
					const name = instance.constructor?.name || '(anonymous plugin)';
					console.log(`Destroyed UI Plugin [${name}]`);
				} catch (err) {
					const name = instance.constructor?.name || '(anonymous plugin)';
					console.error(`Error destroying UI plugin [${name}]:`, err);
				}
			}
		}
		this._instances.clear();
	}

	/**
	 * Returns the number of currently registered plugin instances.
	 */
	get size(): number {
		return this._instances.size;
	}
}
