import {
	EnvironmentInjector,
	inject,
	ModuleWithProviders,
	NgModule,
	OnDestroy,
	provideAppInitializer,
	runInInjectionContext
} from '@angular/core';
import { getPluginUiConfig } from './plugin-ui.loader';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';
import { getUIPluginModules, hasPluginUiLifecycleMethod } from './plugin-ui.helper';
import { PluginUiRegistryService } from './plugin-ui-registry.service';

/**
 * Angular module responsible for managing UI plugin lifecycles.
 *
 * Import `PluginUiModule.init()` in the root bootstrap module. During application
 * startup the module creates every plugin instance inside the root injection
 * context (via `provideAppInitializer`) so that `inject()` calls in plugin
 * classes resolve correctly, then invokes `ngOnPluginBootstrap` / `ngOnPluginDestroy`
 * lifecycle hooks.
 */
@NgModule({})
export class PluginUiModule implements OnDestroy {
	private readonly _envInjector = inject(EnvironmentInjector);
	private readonly _registry = inject(PluginUiRegistryService);

	/**
	 * Plugin instances created during app initializer.
	 * Stored so lifecycle methods can be called on destroy.
	 */
	private readonly _pluginInstances: any[] = [];

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
		this.invokeLifecycleMethod('ngOnPluginDestroy', (instance: any) => {
			this._registry.deregister(instance);
		});
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
		this._pluginInstances.push(...this.createPluginInstances());

		await this.invokeLifecycleMethod('ngOnPluginBootstrap', (instance: any) => {
			this._registry.register(instance);
		});
	}

	// ─── Private helpers ─────────────────────────────────────────

	/**
	 * Reads the config and creates an instance of every plugin module
	 * class inside the root `EnvironmentInjector` context, so that
	 * `inject()` calls in class fields / constructors resolve correctly.
	 */
	private createPluginInstances(): any[] {
		const config = getPluginUiConfig();
		const pluginModules = getUIPluginModules(config.plugins);

		return pluginModules
			.map((mod) => {
				try {
					// `runInInjectionContext` ensures `inject()` calls inside the
					// plugin module class resolve from the root EnvironmentInjector.
					return runInInjectionContext(this._envInjector, () => new mod());
				} catch (e: any) {
					const trace = typeof e?.stack === 'string' ? e.stack : undefined;
					console.error(`Error creating UI plugin [${mod.name}]`, trace, e);
					return null;
				}
			})
			.filter(Boolean);
	}

	/**
	 * Invokes a specified lifecycle method on each plugin instance,
	 * optionally running a closure afterward.
	 *
	 * @param lifecycleMethod The lifecycle method name to invoke.
	 * @param closure Optional callback executed after each invocation.
	 */
	private async invokeLifecycleMethod(
		lifecycleMethod: keyof PluginUiLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		for (const instance of this._pluginInstances) {
			if (hasPluginUiLifecycleMethod(instance, lifecycleMethod)) {
				try {
					await instance[lifecycleMethod]();

					if (typeof closure === 'function') {
						closure(instance);
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


