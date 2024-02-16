/**
 * Interface for plugins with a bootstrap lifecycle method.
 */
export interface IOnPluginBootstrap {
    /**
     * Called when the plugin is being initialized.
     * @returns A void or a Promise representing the completion of the operation.
     */
    onPluginBootstrap(): void | Promise<void>;
}

/**
 * Interface for plugins with a destroy lifecycle method.
 */
export interface IOnPluginDestroy {
    /**
     * Called when the plugin is being destroyed.
     * @returns A void or a Promise representing the completion of the operation.
     */
    onPluginDestroy(): void | Promise<void>;
}

/**
 * Interface for plugins supporting basic seed operations.
 */
export interface IOnPluginWithBasicSeed {
    /**
     * Invoked when seeding basic plugin data.
     * @returns A void or a Promise representing the completion of the operation.
     */
    onPluginBasicSeed(): void | Promise<void>;
}

/**
 * Interface for plugins supporting default seed operations.
 */
export interface IOnPluginWithDefaultSeed {
    /**
     * Invoked when seeding default plugin data.
     * @returns A void or a Promise representing the completion of the operation.
     */
    onPluginDefaultSeed(): void | Promise<void>;
}

/**
 * Interface for plugins supporting random seed operations.
 */
export interface IOnPluginWithRandomSeed {
    /**
     * Invoked when seeding random plugin data.
     * @returns A void or a Promise representing the completion of the operation.
     */
    onPluginRandomSeed(): void | Promise<void>;
}
