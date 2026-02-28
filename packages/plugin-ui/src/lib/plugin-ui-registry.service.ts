import { Injectable } from '@angular/core';
import { IPluginUiExtendedLifecycleMethods } from './plugin-ui.interface';
import { hasPluginUiLifecycleMethod } from './plugin-ui.helper';

/**
 * A plugin module instance that may implement lifecycle hooks (required and optional).
 * Used as the type constraint for the registry.
 */
export type PluginUiInstance = Partial<IPluginUiExtendedLifecycleMethods>;

/**
 * Root-level registry that tracks all bootstrapped UI plugin module instances.
 *
 * Feature-level modules register plugin instances here during bootstrap, and
 * the root bootstrap module can use this registry during application shutdown.
 */
@Injectable({ providedIn: 'root' })
export class PluginUiRegistryService {
	/** Ordered set of live plugin module instances. */
	private readonly _instances: Set<PluginUiInstance> = new Set();

	/**
	 * Register a plugin module instance.
	 *
	 * @param instance The plugin module instance (e.g. `JobEmployeeModule`).
	 */
	register(instance: PluginUiInstance): void {
		this._instances.add(instance);
	}

	/**
	 * Remove a plugin module instance from the registry.
	 *
	 * @param instance The plugin module instance to deregister.
	 */
	deregister(instance: PluginUiInstance): void {
		this._instances.delete(instance);
	}

	/**
	 * Invoke `ngOnPluginBeforeDestroy` (if implemented), then `ngOnPluginDestroy`
	 * on every registered plugin, and clear the registry.
	 *
	 * Intended to be called by the root bootstrap module during app shutdown.
	 */
	async destroyAll(): Promise<void> {
		for (const instance of this._instances) {
			if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginBeforeDestroy')) {
				try {
					const result = instance.ngOnPluginBeforeDestroy!();
					if (result && typeof result.then === 'function') {
						await result;
					}
				} catch (err) {
					const name = instance.constructor?.name || '(anonymous plugin)';
					console.error(`Error in ngOnPluginBeforeDestroy for [${name}]:`, err);
				}
			}
		}
		for (const instance of this._instances) {
			if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginDestroy')) {
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
