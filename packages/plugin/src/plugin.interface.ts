import { IAPIExtensionDefinition } from '@gauzy/common';
import { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Metadata definition for a plugin in NestJS.
 */
export interface IPluginMetaData extends ModuleMetadata {
    /**
     * Definition of extensions provided by the plugin.
     */
    extensions?: IAPIExtensionDefinition;

    /**
     * List of entities injected by the plugin.
     */
    entities?: Type<any>[];

    /**
     * List of subscribers injected by the plugin.
     */
    subscribers?: Type<any>[];
}


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

/**
 * Represents the combined lifecycle methods for a plugin.
 * This type combines interfaces for initializing and destroying a plugin.
 */
export type PluginLifecycleMethods = IOnPluginBootstrap & IOnPluginDestroy & IOnPluginWithBasicSeed & IOnPluginWithDefaultSeed & IOnPluginWithRandomSeed;
