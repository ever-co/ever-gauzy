import { EnvironmentInjector, inject, Injectable, Injector, runInInjectionContext, Type } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { PluginUiDefinition, PLUGIN_OPTIONS, PLUGIN_DEFINITION } from '../plugin-ui.types';
import { PluginUiRegistryService } from '../plugin-ui-registry.service';
import { hasPluginUiLifecycleMethod } from '../plugin-ui.helper';
import { PageExtensionRegistryService } from '../plugin-extension/page-extension-registry.service';
import { PluginEventBusService } from '../plugin-extension/plugin-event-bus.service';
import { PluginSettingsRegistryService } from './plugin-settings-registry.service';
import { PluginServiceRegistryService } from './plugin-service-registry.service';
import { PluginStateService } from './plugin-state.service';

/**
 * Result of a dynamic plugin load operation.
 */
export interface DynamicPluginLoadResult {
	/** Whether the load was successful. */
	success: boolean;
	/** The plugin ID that was loaded. */
	pluginId: string;
	/** Error message if unsuccessful. */
	error?: string;
}

/**
 * Service for dynamically loading and unloading plugins after the initial
 * application bootstrap.
 *
 * Use this when plugins need to be added or removed at runtime — for example,
 * when a user enables/disables a feature, or when a plugin is installed
 * from a marketplace.
 *
 * Emits `plugin:dynamic-loaded` and `plugin:dynamic-unloaded` events on the
 * event bus so other parts of the system can react.
 *
 * @example
 * ```ts
 * const loader = inject(DynamicPluginLoaderService);
 *
 * // Load a declarative plugin at runtime
 * const result = await loader.loadPlugin({
 *   id: 'my-new-plugin',
 *   routes: [...],
 *   tabs: [...],
 *   bootstrap: (injector) => { ... }
 * });
 *
 * // Load a module-based plugin
 * const result = await loader.loadPlugin({
 *   id: 'heavy-plugin',
 *   loadModule: () => import('./heavy-plugin.module').then(m => m.HeavyModule)
 * });
 *
 * // Unload a plugin
 * await loader.unloadPlugin('my-new-plugin');
 *
 * // Observe loaded plugins
 * loader.loadedPluginIds$.subscribe(ids => console.log('Active plugins:', ids));
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DynamicPluginLoaderService {
	private readonly _envInjector = inject(EnvironmentInjector);
	private readonly _registry = inject(PluginUiRegistryService);
	private readonly _extRegistry = inject(PageExtensionRegistryService);
	private readonly _eventBus = inject(PluginEventBusService);
	private readonly _settingsRegistry = inject(PluginSettingsRegistryService);
	private readonly _serviceRegistry = inject(PluginServiceRegistryService);
	private readonly _stateService = inject(PluginStateService);

	/** Tracks dynamically loaded plugins: pluginId → { definition, instance?, injector? } */
	private readonly _loaded = new Map<string, { definition: PluginUiDefinition; instance?: any; injector?: Injector }>();

	/** Observable of loaded plugin IDs. */
	private readonly _loaded$ = new BehaviorSubject<Set<string>>(new Set());

	/**
	 * Observable of all dynamically loaded plugin IDs.
	 */
	get loadedPluginIds$(): Observable<string[]> {
		return this._loaded$.pipe(map((set) => Array.from(set)));
	}

	/**
	 * Returns the currently loaded plugin IDs.
	 */
	get loadedPluginIds(): string[] {
		return Array.from(this._loaded.keys());
	}

	/**
	 * Returns true if a plugin is currently loaded.
	 */
	isLoaded(pluginId: string): boolean {
		return this._loaded.has(pluginId);
	}

	/**
	 * Dynamically loads and bootstraps a plugin after application startup.
	 *
	 * Supports both module-based plugins (with `module` or `loadModule`) and
	 * declarative-only plugins (with `bootstrap` callback).
	 *
	 * @param definition The plugin definition to load.
	 * @returns Result indicating success or failure.
	 */
	async loadPlugin(definition: PluginUiDefinition): Promise<DynamicPluginLoadResult> {
		const { id } = definition;

		// Guard: already loaded
		if (this._loaded.has(id)) {
			return { success: false, pluginId: id, error: `Plugin '${id}' is already loaded.` };
		}

		try {
			let instance: any = undefined;
			let injector: Injector | undefined = undefined;

			if (definition.module || definition.loadModule) {
				// Module-based plugin
				const result = await this._loadModulePlugin(definition);
				instance = result.instance;
				injector = result.injector;
			} else if (definition.bootstrap) {
				// Declarative-only plugin
				injector = await this._loadDeclarativePlugin(definition);
			} else {
				return {
					success: false,
					pluginId: id,
					error: `Plugin '${id}' has no module, loadModule, or bootstrap — nothing to load.`
				};
			}

			this._loaded.set(id, { definition, instance, injector });
			this._emitLoadedIds();

			// Emit event
			this._eventBus.emit('plugin:dynamic-loaded', { pluginId: id }, { source: 'dynamic-plugin-loader' });

			return { success: true, pluginId: id };
		} catch (e: any) {
			const error = e?.message ?? String(e);
			console.error(`[DynamicPluginLoader] Failed to load plugin '${id}':`, e);
			return { success: false, pluginId: id, error };
		}
	}

	/**
	 * Unloads a dynamically loaded plugin.
	 *
	 * Invokes lifecycle hooks (`ngOnPluginBeforeDestroy`, `ngOnPluginDestroy`),
	 * deregisters extensions, settings, services, event subscriptions, and state.
	 *
	 * @param pluginId The ID of the plugin to unload.
	 * @returns Result indicating success or failure.
	 */
	async unloadPlugin(pluginId: string): Promise<DynamicPluginLoadResult> {
		const entry = this._loaded.get(pluginId);
		if (!entry) {
			return { success: false, pluginId, error: `Plugin '${pluginId}' is not dynamically loaded.` };
		}

		try {
			const { instance, injector } = entry;

			// Invoke lifecycle hooks on module-based plugins
			if (instance) {
				if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginBeforeDestroy')) {
					try {
						const result = instance.ngOnPluginBeforeDestroy!();
						if (result instanceof Promise) await result;
					} catch (e) {
						console.error(`[DynamicPluginLoader] Error in ngOnPluginBeforeDestroy for '${pluginId}':`, e);
					}
				}

				if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginDestroy')) {
					try {
						await instance.ngOnPluginDestroy();
					} catch (e) {
						console.error(`[DynamicPluginLoader] Error in ngOnPluginDestroy for '${pluginId}':`, e);
					}
				}

				this._registry.deregister(instance);
			}

			// Destroy child injector to trigger OnDestroy on provided services
			if (injector && typeof (injector as any).destroy === 'function') {
				try {
					(injector as any).destroy();
				} catch (e) {
					console.error(`[DynamicPluginLoader] Error destroying injector for '${pluginId}':`, e);
				}
			}

			// Clean up extensions
			this._extRegistry.deregisterByPlugin(pluginId);

			// Clean up settings
			this._settingsRegistry.unregister(pluginId);

			// Clean up cross-plugin services
			this._serviceRegistry.unregisterByPlugin(pluginId);

			// Clean up event subscriptions
			this._eventBus.unsubscribeByPlugin(pluginId);

			// Clean up plugin state (convention: pluginId:* keys)
			this._stateService.deleteByPrefix(`${pluginId}:`);

			// Remove from tracking
			this._loaded.delete(pluginId);
			this._emitLoadedIds();

			// Emit event
			this._eventBus.emit('plugin:dynamic-unloaded', { pluginId }, { source: 'dynamic-plugin-loader' });

			return { success: true, pluginId };
		} catch (e: any) {
			const error = e?.message ?? String(e);
			console.error(`[DynamicPluginLoader] Failed to unload plugin '${pluginId}':`, e);
			return { success: false, pluginId, error };
		}
	}

	/**
	 * Reloads a plugin by unloading and re-loading it.
	 * Useful for hot-reloading plugin configuration changes.
	 */
	async reloadPlugin(definition: PluginUiDefinition): Promise<DynamicPluginLoadResult> {
		const { id } = definition;
		if (this._loaded.has(id)) {
			const unloadResult = await this.unloadPlugin(id);
			if (!unloadResult.success) return unloadResult;
		}
		return this.loadPlugin(definition);
	}

	// ─── Private helpers ─────────────────────────────────────────

	/**
	 * Loads a module-based plugin: resolves the module class, creates an
	 * instance in the environment injector context, registers it, and
	 * invokes lifecycle hooks.
	 */
	private async _loadModulePlugin(definition: PluginUiDefinition): Promise<{ instance: any; injector: Injector }> {
		const resolvedModule: Type<any> | undefined =
			definition.module ?? (definition.loadModule ? await definition.loadModule() : undefined);

		if (!resolvedModule) {
			throw new Error(`Plugin '${definition.id}' loadModule resolved to null/undefined.`);
		}

		const options = definition.options ?? {};
		const childInjector = Injector.create({
			providers: [
				{ provide: PLUGIN_OPTIONS, useValue: options },
				{ provide: PLUGIN_DEFINITION, useValue: definition }
			],
			parent: this._envInjector
		});

		const instance = runInInjectionContext(childInjector, () => new resolvedModule());
		this._registry.register(instance);

		// Run lifecycle hooks
		if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginBootstrap')) {
			const result = instance.ngOnPluginBootstrap!();
			if (result instanceof Promise) await result;
		}

		if (hasPluginUiLifecycleMethod(instance, 'ngOnPluginAfterBootstrap')) {
			const result = instance.ngOnPluginAfterBootstrap!();
			if (result instanceof Promise) await result;
		}

		return { instance, injector: childInjector };
	}

	/**
	 * Loads a declarative-only plugin by running its bootstrap callback
	 * inside a child injector context that provides PLUGIN_OPTIONS and
	 * PLUGIN_DEFINITION, consistent with module-based plugins.
	 */
	private async _loadDeclarativePlugin(definition: PluginUiDefinition): Promise<Injector> {
		const options = definition.options ?? {};
		const childInjector = Injector.create({
			providers: [
				{ provide: PLUGIN_OPTIONS, useValue: options },
				{ provide: PLUGIN_DEFINITION, useValue: definition }
			],
			parent: this._envInjector
		});

		const result = runInInjectionContext(childInjector, () => definition.bootstrap!(childInjector));
		if (result instanceof Promise) await result;

		return childInjector;
	}

	/**
	 * Emits the current set of loaded plugin IDs.
	 */
	private _emitLoadedIds(): void {
		this._loaded$.next(new Set(this._loaded.keys()));
	}
}
