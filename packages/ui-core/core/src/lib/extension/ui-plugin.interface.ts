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
 *     onPluginBootstrap(): void {
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
	onPluginBootstrap(): void | Promise<void>;
}

/**
 * Interface for UI plugins with a destroy lifecycle method.
 *
 * Implement this in your Angular module class so the `UIPluginModule`
 * can call it when the application is shutting down.
 *
 * @example
 * ```ts
 * @NgModule({ … })
 * export class JobEmployeeModule implements IOnUIPluginDestroy {
 *     onPluginDestroy(): void {
 *         console.log('JobEmployeeModule destroyed');
 *     }
 * }
 * ```
 */
export interface IOnUIPluginDestroy {
	/**
	 * Called when the plugin module is being destroyed.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	onPluginDestroy(): void | Promise<void>;
}

/**
 * Represents the combined lifecycle methods for a UI plugin.
 * This type combines interfaces for bootstrapping and destroying a plugin.
 */
export type UIPluginLifecycleMethods = IOnUIPluginBootstrap & IOnUIPluginDestroy;
