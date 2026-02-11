import {
	EnvironmentInjector,
	inject,
	ModuleWithProviders,
	NgModule,
	OnDestroy,
	provideAppInitializer,
	runInInjectionContext
} from '@angular/core';
import { getAppUIConfig } from './ui-plugin.loader';
import { UIPluginLifecycleMethods } from './ui-plugin.interface';
import { getUIPluginModules, hasUILifecycleMethod } from './ui-plugin.helper';
import { UIPluginRegistryService } from './ui-plugin-registry.service';
import { LoggerService } from '../logger';

/**
 * Angular module responsible for managing UI plugin lifecycles.
 *
 * Import `UIPluginModule.init()` in the root `AppBootstrapModule`.
 * During application startup the module creates every plugin instance
 * inside the root injection context (via `provideAppInitializer`) so that
 * `inject()` calls in plugin classes resolve correctly, then invokes
 * `ngOnPluginBootstrap` / `ngOnPluginDestroy` lifecycle hooks.
 *
 * Plugin creation is deferred to the app initializer (not the module
 * constructor) because the root injector is not fully initialized
 * when module constructors run. The initializer runs after injector
 * setup but before the first component renders, which guarantees that
 * routes and menu items are available in time.
 *
 * All bootstrapped instances are registered with the root-level
 * `UIPluginRegistryService` so that the root bootstrap module can reach
 * them during application shutdown.
 *
 * @example
 * ```ts
 * @NgModule({
 *     imports: [
 *         UIPluginModule.init(),   // auto-resolves every plugin from config
 *         AppModule
 *     ],
 *     bootstrap: [AppComponent]
 * })
 * export class AppBootstrapModule {}
 * ```
 */
@NgModule({})
export class UIPluginModule implements OnDestroy {
	private readonly _envInjector = inject(EnvironmentInjector);
	private readonly _registry = inject(UIPluginRegistryService);
	private readonly _log = inject(LoggerService).withContext('UIPluginModule');

	/**
	 * Plugin instances created during app initializer.
	 * Stored so lifecycle methods can be called on destroy.
	 */
	private readonly _pluginInstances: any[] = [];

	/**
	 * Configure the UIPluginModule.
	 *
	 * Returns a `ModuleWithProviders` that registers an app initializer
	 * (via `provideAppInitializer`) which creates and bootstraps all
	 * plugin instances at startup.
	 *
	 * No config is read here because `@NgModule` metadata is
	 * evaluated at module-definition time (before `setAppUIConfig()`
	 * has been called). All plugin resolution happens lazily via
	 * the app initializer.
	 *
	 * @returns A `ModuleWithProviders` for `UIPluginModule`.
	 */
	static init(): ModuleWithProviders<UIPluginModule> {
		return {
			ngModule: UIPluginModule,
			providers: [
				provideAppInitializer(() => {
					const pluginModule = inject(UIPluginModule);
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

			const pluginName = instance.constructor?.name || '(anonymous plugin)';
			this._log.debug(`Destroyed UI Plugin [${pluginName}]`);
		});
	}

	// ─── Bootstrap ───────────────────────────────────────────────

	/**
	 * Creates all plugin instances and invokes `ngOnPluginBootstrap`.
	 *
	 * Called by the app initializer — at this point the root
	 * injector is fully initialized, so `inject()` calls inside
	 * plugin classes resolve correctly.
	 */
	async bootstrapPlugins(): Promise<void> {
		this._pluginInstances.push(...this.createPluginInstances());

		await this.invokeLifecycleMethod('ngOnPluginBootstrap', (instance: any) => {
			this._registry.register(instance);

			const pluginName = instance.constructor?.name || '(anonymous plugin)';
			this._log.debug(`Bootstrapped UI Plugin [${pluginName}]`);
		});
	}

	// ─── Private helpers ─────────────────────────────────────────

	/**
	 * Reads the config and creates an instance of every plugin module
	 * class inside the root `EnvironmentInjector` context, so that
	 * `inject()` calls in class fields / constructors resolve correctly.
	 */
	private createPluginInstances(): any[] {
		const config = getAppUIConfig();
		const pluginModules = getUIPluginModules(config.plugins);

		return pluginModules
			.map((mod) => {
				try {
					// `runInInjectionContext` ensures `inject()` calls inside the
					// plugin module class resolve from the root EnvironmentInjector.
					return runInInjectionContext(this._envInjector, () => new mod());
				} catch (e: any) {
					const trace = typeof e?.stack === 'string' ? e.stack : undefined;
					this._log.error(`Error creating UI plugin [${mod.name}]`, trace, e);
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
		lifecycleMethod: keyof UIPluginLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		for (const instance of this._pluginInstances) {
			if (hasUILifecycleMethod(instance, lifecycleMethod)) {
				try {
					await instance[lifecycleMethod]();

					if (typeof closure === 'function') {
						closure(instance);
					}
				} catch (e: any) {
					const name = instance.constructor?.name || '(anonymous plugin)';
					const trace = typeof e?.stack === 'string' ? e.stack : undefined;
					this._log.error(`Error in ${String(lifecycleMethod)} for plugin [${name}]`, trace, e);
				}
			}
		}
	}
}
