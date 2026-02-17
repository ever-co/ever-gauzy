/**
 * Interface for UI plugins with a bootstrap lifecycle method.
 *
 * Implement this in your Angular module class so the `PluginUiModule`
 * can call it after the module has been instantiated.
 */
export interface IOnPluginUiBootstrap {
	/**
	 * Called when the plugin module is being initialized.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginBootstrap(): void | Promise<void>;
}

/**
 * Interface for UI plugins with a destroy lifecycle method.
 *
 * Implement this in your Angular module class so the `PluginUiModule`
 * can call it before the module is destroyed.
 */
export interface IOnPluginUiDestroy {
	/**
	 * Called when the plugin module is being destroyed.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginDestroy(): void | Promise<void>;
}

/**
 * Optional: called after all plugins have completed `ngOnPluginBootstrap`.
 * Useful for cross-plugin wiring or logic that must run once the full plugin tree is ready.
 */
export interface IOnPluginAfterBootstrap {
	ngOnPluginAfterBootstrap(): void | Promise<void>;
}

/**
 * Optional: called before `ngOnPluginDestroy` when the application is shutting down.
 * Use for preparatory cleanup before the main destroy logic runs.
 */
export interface IOnPluginBeforeDestroy {
	ngOnPluginBeforeDestroy(): void | Promise<void>;
}

/**
 * Optional: for guard-style checks before a plugin's routes are activated.
 * Implement this and invoke via a custom `CanActivate` guard that delegates
 * to the plugin (e.g. using route data to identify the plugin).
 * Not invoked automatically by PluginUiModule.
 */
export interface IOnPluginBeforeRouteActivate {
	ngOnPluginBeforeRouteActivate(): boolean | Promise<boolean>;
}

/**
 * Optional: for reacting to runtime config changes.
 * Reserved for future use when dynamic config reload is supported.
 * Not invoked automatically by PluginUiModule.
 */
export interface IOnPluginConfigChange {
	ngOnPluginConfigChange(): void | Promise<void>;
}

/**
 * Combined lifecycle contract for UI plugins (bootstrap + destroy).
 *
 * Use this when you want a single interface that expresses both lifecycle hooks.
 */
export interface IPluginUiLifecycleMethods extends IOnPluginUiBootstrap, IOnPluginUiDestroy {}

/**
 * Extended lifecycle methods (optional hooks).
 * Plugins may implement any subset of these.
 */
export interface IPluginUiExtendedLifecycleMethods extends IPluginUiLifecycleMethods {
	ngOnPluginAfterBootstrap?(): void | Promise<void>;
	ngOnPluginBeforeDestroy?(): void | Promise<void>;
	ngOnPluginBeforeRouteActivate?(): boolean | Promise<boolean>;
	ngOnPluginConfigChange?(): void | Promise<void>;
}

/**
 * Backwards‑compatible alias used by helper utilities.
 */
export type PluginUiLifecycleMethods = IPluginUiExtendedLifecycleMethods;

