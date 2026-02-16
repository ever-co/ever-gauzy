import {
	EnvironmentInjector,
	inject,
	Injector,
	ModuleWithProviders,
	NgModule,
	OnDestroy,
	provideAppInitializer,
	runInInjectionContext
} from '@angular/core';
import { getPluginUiConfig } from './plugin-ui.loader';
import {
	PLUGIN_ACTIVATION_PREDICATE,
	PLUGIN_DEFINITION,
	PLUGIN_OPTIONS,
	orderPluginsByDependencies,
	PluginUiDefinition
} from './plugin-ui.types';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';
import { getUIPluginModulesWithDefinitions, hasPluginUiLifecycleMethod } from './plugin-ui.helper';
import { PageExtensionRegistryService } from './plugin-extension/extension-registry.service';
import { PluginUiRegistryService } from './plugin-ui-registry.service';

/**
 * Angular module responsible for managing UI plugin lifecycles.
 *
 * Import `PluginUiModule.init()` in the root bootstrap module. During application
 * startup the module creates plugin instances in top-down order (parent before
 * children), then invokes `ngOnPluginBootstrap` / `ngOnPluginDestroy` lifecycle
 * hooks. Parent plugins (e.g. JobsPlugin) are initialized before their children.
 */
@NgModule({})
export class PluginUiModule implements OnDestroy {
	private readonly _envInjector = inject(EnvironmentInjector);
	private readonly _registry = inject(PluginUiRegistryService);
	private readonly _extRegistry = inject(PageExtensionRegistryService);

	/**
	 * Plugin instances created during app initializer.
	 * Stored so lifecycle methods can be called on destroy.
	 */
	private readonly _pluginInstances: any[] = [];

	/** Plugin definitions for instances; used to deregister extensions on destroy. */
	private readonly _pluginDefinitions: PluginUiDefinition[] = [];

	/**
	 * Configure the PluginUiModule.
	 *
	 * Returns a `ModuleWithProviders` that registers an app initializer
	 * (via `provideAppInitializer`) which creates and bootstraps all
	 * plugin instances at startup.
	 */
	static init(): ModuleWithProviders<PluginUiModule> {
		return {
			ngModule: PluginUiModule,
			providers: [
				provideAppInitializer(() => {
					const pluginModule = inject(PluginUiModule);
					return pluginModule.bootstrapPlugins();
				})
			]
		};
	}

	/**
	 * Lifecycle hook called when the module is being destroyed.
	 * Deregisters plugin instances from the global registry and calls
	 * `ngOnPluginDestroy` on each plugin.
	 */
	ngOnDestroy(): void {
		this.invokeLifecycleMethodSync('ngOnPluginBeforeDestroy');

		// Extension deregistration moved into closure so it runs per-plugin *after* each
		// ngOnPluginDestroy completes (avoids race where extensions were removed before hooks ran).
		this.invokeLifecycleMethod('ngOnPluginDestroy', (instance: any, def?: PluginUiDefinition) => {
			this._registry.deregister(instance);
			if (def?.extensions?.length) {
				this._extRegistry.deregisterByPlugin(def.id);
			}
		}).catch((e: unknown) => {
			console.error('[PluginUiModule] Error during plugin destroy', e);
		});
		// Plugins without ngOnPluginDestroy: deregister extensions immediately (no async hook to wait for).
		for (let i = 0; i < this._pluginInstances.length; i++) {
			const instance = this._pluginInstances[i];
			const def = this._pluginDefinitions[i];
			if (!hasPluginUiLifecycleMethod(instance, 'ngOnPluginDestroy') && def?.extensions?.length) {
				this._extRegistry.deregisterByPlugin(def.id);
			}
		}
	}

	// ─── Bootstrap ───────────────────────────────────────────────

	/**
	 * Creates all plugin instances and invokes `ngOnPluginBootstrap`.
	 *
	 * Called by the app initializer — at this point the root injector is
	 * fully initialized, so `inject()` calls inside plugin classes resolve
	 * correctly.
	 */
	async bootstrapPlugins(): Promise<void> {
		this._pluginInstances.push(...(await this.createPluginInstances()));

		await this.invokeLifecycleMethod('ngOnPluginBootstrap', (instance: any) => {
			this._registry.register(instance);
		});

		await this.invokeLifecycleMethod('ngOnPluginAfterBootstrap');
	}

	// ─── Private helpers ─────────────────────────────────────────

	/**
	 * Reads the config and creates an instance of every plugin module
	 * class inside the root `EnvironmentInjector` context, so that
	 * `inject()` calls in class fields / constructors resolve correctly.
	 * Plugins are filtered by PLUGIN_ACTIVATION_PREDICATE when provided.
	 */
	private async createPluginInstances(): Promise<any[]> {
		const config = getPluginUiConfig();
		let pluginsWithModules = getUIPluginModulesWithDefinitions(config.plugins);
		pluginsWithModules = orderPluginsByDependencies(pluginsWithModules.map((p) => p.definition)).map(
			(def) => pluginsWithModules.find((p) => p.definition === def)!
		);
		const predicate = this._envInjector.get(PLUGIN_ACTIVATION_PREDICATE, null);

		const oks =
			predicate == null
				? pluginsWithModules.map(() => true)
				: await Promise.all(
						pluginsWithModules.map(async ({ definition }) => {
							const result = predicate(definition);
							return typeof result === 'boolean' ? result : await result;
						})
				  );
		const filtered = pluginsWithModules.filter((_, i) => oks[i]);

		const instances: any[] = [];
		for (const { definition, module: mod, loadModule } of filtered) {
			try {
				const resolvedModule = mod ?? (loadModule ? await loadModule() : null);
				if (!resolvedModule) continue;

				const options = definition.options ?? {};
				const childInjector = Injector.create({
					providers: [
						{ provide: PLUGIN_OPTIONS, useValue: options },
						{ provide: PLUGIN_DEFINITION, useValue: definition }
					],
					parent: this._envInjector
				});
				const instance = runInInjectionContext(childInjector, () => new resolvedModule());
				instances.push(instance);
				this._pluginDefinitions.push(definition);
			} catch (e: any) {
				const trace = typeof e?.stack === 'string' ? e.stack : undefined;
				console.error(`Error creating UI plugin [${definition.id}]`, trace, e);
			}
		}
		return instances;
	}

	/**
	 * Invokes a specified lifecycle method on each plugin instance,
	 * optionally running a closure afterward.
	 *
	 * @param lifecycleMethod The lifecycle method name to invoke.
	 * @param closure Optional callback executed after each invocation. Receives (instance, definition).
	 */
	private async invokeLifecycleMethod(
		lifecycleMethod: keyof PluginUiLifecycleMethods,
		closure?: (instance: any, definition?: PluginUiDefinition) => void
	): Promise<void> {
		for (let i = 0; i < this._pluginInstances.length; i++) {
			const instance = this._pluginInstances[i];
			const definition = this._pluginDefinitions[i];
			if (hasPluginUiLifecycleMethod(instance, lifecycleMethod)) {
				try {
					await instance[lifecycleMethod]!();

					if (typeof closure === 'function') {
						closure(instance, definition);
					}
				} catch (e: any) {
					const name = instance.constructor?.name || '(anonymous plugin)';
					const trace = typeof e?.stack === 'string' ? e.stack : undefined;
					console.error(`Error in ${String(lifecycleMethod)} for plugin [${name}]`, trace, e);
				}
			}
		}
	}

	/**
	 * Invokes a synchronous lifecycle method on each plugin instance.
	 * Used for ngOnPluginBeforeDestroy (Angular's ngOnDestroy is synchronous).
	 */
	private invokeLifecycleMethodSync(lifecycleMethod: keyof PluginUiLifecycleMethods): void {
		for (const instance of this._pluginInstances) {
			if (hasPluginUiLifecycleMethod(instance, lifecycleMethod)) {
				try {
					const result = instance[lifecycleMethod]!();
					if (result instanceof Promise) {
						// If it returned a Promise, we can't await in sync context - log and continue
						result.catch((e: unknown) => {
							const name = instance.constructor?.name || '(anonymous plugin)';
							console.error(`Error in ${String(lifecycleMethod)} for plugin [${name}]`, e);
						});
					}
				} catch (e: any) {
					const name = instance.constructor?.name || '(anonymous plugin)';
					const trace = typeof e?.stack === 'string' ? e.stack : undefined;
					console.error(`Error in ${String(lifecycleMethod)} for plugin [${name}]`, trace, e);
				}
			}
		}
	}
}
