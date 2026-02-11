/**
 * Interface for UI plugins with a bootstrap lifecycle method.
 *
 * Implement this in your Angular module class so the `UIPluginModule`
 * can call it after the module has been instantiated.
 *
 * @example
 * ```ts
 * @NgModule({ … })
 * export class JobEmployeeModule implements IOnUIPluginBootstrap {
 *     ngOnPluginBootstrap(): void {
 *         console.log('JobEmployeeModule bootstrapped');
 *     }
 * }
 * ```
 */
export interface IOnUIPluginBootstrap {
	/**
	 * Called when the plugin module is being initialized.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginBootstrap(): void | Promise<void>;
}

/**
 * Interface for UI plugins with a destroy lifecycle method.
 *
 * Implement this in your Angular module class so the `UIPluginModule`
 * can call it before the module is destroyed.
 */
export interface IOnUIPluginDestroy {
	/**
	 * Called when the plugin module is being destroyed.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	ngOnPluginDestroy(): void | Promise<void>;
}

/**
 * Combined lifecycle contract for UI plugins (bootstrap + destroy).
 *
 * Use this when you want a **single interface** that expresses both
 * lifecycle hooks:
 *
 * ```ts
 * export class JobEmployeeModule implements IUIPluginLifecycleMethods {
 *   ngOnPluginBootstrap(): void { … }
 *   ngOnPluginDestroy(): void { … }
 * }
 * ```
 */
export interface IUIPluginLifecycleMethods {
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
export type UIPluginLifecycleMethods = IUIPluginLifecycleMethods;
