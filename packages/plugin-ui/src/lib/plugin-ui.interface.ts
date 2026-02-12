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
 * Combined lifecycle contract for UI plugins (bootstrap + destroy).
 *
 * Use this when you want a single interface that expresses both lifecycle hooks.
 */
export interface IPluginUiLifecycleMethods {
	/**
	 * Called when the plugin module is being initialized.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginBootstrap(): void | Promise<void>;

	/**
	 * Called when the plugin module is being destroyed.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginDestroy(): void | Promise<void>;
}

/**
 * Backwards‑compatible alias used by helper utilities.
 */
export type PluginUiLifecycleMethods = IPluginUiLifecycleMethods;

