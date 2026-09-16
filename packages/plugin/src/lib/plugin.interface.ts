import { ModuleMetadata, Type } from '@nestjs/common';
import { ExtensionConfigurationOptions, ApplicationPluginConfigurationFn } from '@gauzy/common';
import {
	PluginFeatureContribution,
	PluginPermissionContribution,
	PluginSettingContribution
} from './plugin-contributions';

/**
 * Metadata definition for a plugin in NestJS.
 */
export interface PluginMetadata extends ModuleMetadata {
	/**
	 * Definition of extensions provided by the plugin.
	 */
	extensions?: ExtensionConfigurationOptions;

	/**
	 * List of entities injected by the plugin.
	 */
	entities?: Array<Type<any>> | (() => Array<Type<any>>);

	/**
	 * List of subscribers injected by the plugin.
	 */
	subscribers?: Array<Type<any>> | (() => Array<Type<any>>);

	/**
	 * Returns a configuration callback function for the plugin.
	 */
	configuration?: ApplicationPluginConfigurationFn;

	/**
	 * Database migrations owned by the plugin.
	 *
	 * A plugin ships the migrations for the tables it owns. The platform merges every declared
	 * migration into the connection's migration list before the connection is created, so ordering
	 * follows each migration's own timestamp rather than the order plugins are listed in.
	 */
	migrations?: Array<Type<any>> | (() => Array<Type<any>>);

	/**
	 * Permissions the plugin contributes to the platform role model.
	 */
	permissions?: Array<PluginPermissionContribution> | (() => Array<PluginPermissionContribution>);

	/**
	 * Feature flags the plugin contributes.
	 */
	features?: Array<PluginFeatureContribution> | (() => Array<PluginFeatureContribution>);

	/**
	 * Settings the plugin reads.
	 */
	settings?: Array<PluginSettingContribution> | (() => Array<PluginSettingContribution>);

	/**
	 * Plugins that must be loaded before this one.
	 *
	 * Declaring a dependency makes the load order deterministic and lets the platform refuse an
	 * installation where a required plugin is missing instead of failing at request time.
	 */
	dependsOn?: Array<Type<any>>;
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
 * Interface for plugins supporting various seed operations.
 */
export interface IOnPluginSeedable {
	/**
	 * Invoked when seeding basic plugin data.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	onPluginBasicSeed?(): void | Promise<void>;

	/**
	 * Invoked when seeding default plugin data.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	onPluginDefaultSeed?(): void | Promise<void>;

	/**
	 * Invoked when seeding random plugin data.
	 * @returns A void or a Promise representing the completion of the operation.
	 */
	onPluginRandomSeed?(): void | Promise<void>;
}

/**
 * Represents the combined lifecycle methods for a plugin.
 * This type combines interfaces for initializing and destroying a plugin.
 */
export type PluginLifecycleMethods = IOnPluginBootstrap & IOnPluginDestroy & IOnPluginSeedable;
