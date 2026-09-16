import { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { getConfig } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { PLUGIN_METADATA } from './plugin-metadata';
import { PluginLifecycleMethods } from './plugin.interface';
import {
	PluginFeatureContribution,
	PluginPermissionContribution,
	PluginSettingContribution,
	RegisteredMigration,
	readMigrationTimestamp
} from './plugin-contributions';

/**
 * Get plugin classes from an array of plugins by reflecting metadata.
 * @param plugins An array of plugins containing metadata.
 * @param metadataKey The metadata key to retrieve from plugins.
 * @returns An array of classes obtained from the provided plugins and metadata key.
 */
function getClassesFromPlugins(plugins: Array<Type<any> | DynamicModule>, metadataKey: string): Array<Type<any>> {
	if (!plugins) {
		return [];
	}

	return plugins.flatMap((plugin: Type<any> | DynamicModule) => reflectMetadata(plugin, metadataKey) ?? []);
}

/**
 * Get plugin entities classes from an array of plugins.
 * @param plugins An array of plugins containing entity metadata.
 * @returns An array of entity classes obtained from the provided plugins.
 */
export function getEntitiesFromPlugins(plugins?: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return getClassesFromPlugins(plugins, PLUGIN_METADATA.ENTITIES);
}

/**
 * Get subscribers from an array of plugins.
 * @param plugins An array of plugins containing subscriber metadata.
 * @returns An array of subscriber classes obtained from the provided plugins.
 */
export function getSubscribersFromPlugins(plugins?: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return getClassesFromPlugins(plugins, PLUGIN_METADATA.SUBSCRIBERS);
}

/**
 * Get plugin extensions from an array of plugins by reflecting metadata.
 * @param plugins An array of plugins containing extension metadata.
 * @returns An array of extensions obtained from the provided plugins.
 */
export function getPluginExtensions(plugins: Array<Type<any> | DynamicModule>) {
	if (!plugins) {
		return [];
	}

	return plugins.flatMap(
		(plugin: Type<any> | DynamicModule) => reflectMetadata(plugin, PLUGIN_METADATA.EXTENSIONS) ?? []
	);
}

/**
 * Get plugin configuration from an array of plugins by reflecting metadata.
 * @param plugins An array of plugins containing configuration metadata.
 * @returns An array of configurations obtained from the provided plugins.
 */
export function getPluginConfigurations(plugins: (Type<any> | DynamicModule)[] = []): any[] {
	if (!plugins) {
		return [];
	}

	return plugins.flatMap(
		(plugin: Type<any> | DynamicModule) => reflectMetadata(plugin, PLUGIN_METADATA.CONFIGURATION) || []
	);
}

/**
 * Resolves a metadata value that may be declared either as a literal array or as a function
 * returning one.
 *
 * Plugin metadata is evaluated when the module is imported, so a plugin whose contributions depend
 * on other imports declares them as a thunk. Both forms are accepted everywhere.
 *
 * @param value The declared metadata value.
 * @returns The resolved array.
 */
function resolveContribution<T>(value: Array<T> | (() => Array<T>) | undefined): Array<T> {
	if (!value) {
		return [];
	}

	if (typeof value === 'function') {
		const resolved = (value as () => Array<T>)();
		return Array.isArray(resolved) ? resolved : [];
	}

	return Array.isArray(value) ? value : [];
}

/**
 * Collects a declared contribution list from every plugin.
 *
 * @param plugins The plugin list.
 * @param metadataKey One of the contribution metadata keys.
 * @returns Every declared contribution, in plugin order.
 */
function getContributionsFromPlugins<T>(plugins: Array<Type<any> | DynamicModule>, metadataKey: string): Array<T> {
	if (!plugins) {
		return [];
	}

	return plugins.flatMap((plugin: Type<any> | DynamicModule) => {
		const declared = reflectMetadata(plugin, metadataKey) as Array<T> | (() => Array<T>) | undefined;
		return resolveContribution<T>(declared);
	});
}

/**
 * Get the migrations owned by a set of plugins.
 *
 * @param plugins An array of plugins containing migration metadata.
 * @returns Every declared migration class.
 */
export function getMigrationsFromPlugins(plugins?: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return getContributionsFromPlugins<Type<any>>(plugins ?? [], PLUGIN_METADATA.MIGRATIONS);
}

/**
 * Get the permissions contributed by a set of plugins.
 *
 * @param plugins An array of plugins containing permission metadata.
 * @returns Every declared permission contribution.
 */
export function getPermissionsFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginPermissionContribution> {
	return getContributionsFromPlugins<PluginPermissionContribution>(plugins ?? [], PLUGIN_METADATA.PERMISSIONS);
}

/**
 * Get the feature flags contributed by a set of plugins.
 *
 * @param plugins An array of plugins containing feature metadata.
 * @returns Every declared feature contribution.
 */
export function getFeaturesFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginFeatureContribution> {
	return getContributionsFromPlugins<PluginFeatureContribution>(plugins ?? [], PLUGIN_METADATA.FEATURES);
}

/**
 * Get the settings declared by a set of plugins.
 *
 * @param plugins An array of plugins containing setting metadata.
 * @returns Every declared setting contribution.
 */
export function getSettingsFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginSettingContribution> {
	return getContributionsFromPlugins<PluginSettingContribution>(plugins ?? [], PLUGIN_METADATA.SETTINGS);
}

/**
 * Get the plugin classes a given plugin declares as prerequisites.
 *
 * @param plugin The plugin to inspect.
 * @returns The declared prerequisite plugin classes.
 */
export function getPluginDependencies(plugin: Type<any> | DynamicModule): Array<Type<any>> {
	const declared = reflectMetadata(plugin, PLUGIN_METADATA.DEPENDS_ON) as
		| Array<Type<any>>
		| (() => Array<Type<any>>)
		| undefined;

	return resolveContribution<Type<any>>(declared);
}

/**
 * Orders a plugin list so that every declared prerequisite is loaded before the plugin that
 * requires it.
 *
 * The sort is stable: plugins that declare no dependency keep their configured order, so enabling a
 * dependency never reshuffles unrelated plugins.
 *
 * @param plugins The configured plugin list.
 * @returns The same plugins in dependency order.
 * @throws When a dependency is missing, or when the declared dependencies contain a cycle.
 */
export function resolvePluginLoadOrder(plugins: Array<Type<any> | DynamicModule>): Array<Type<any> | DynamicModule> {
	if (!plugins || plugins.length === 0) {
		return [];
	}

	const identityOf = (plugin: Type<any> | DynamicModule): Type<any> =>
		isDynamicModule(plugin) ? plugin.module : plugin;

	const configured = new Set<Type<any>>(plugins.map(identityOf));
	const ordered: Array<Type<any> | DynamicModule> = [];
	const visiting = new Set<Type<any>>();
	const visited = new Set<Type<any>>();

	const visit = (plugin: Type<any> | DynamicModule, path: string[]): void => {
		const identity = identityOf(plugin);

		if (visited.has(identity)) {
			return;
		}

		if (visiting.has(identity)) {
			throw new Error(
				`Plugin dependency cycle detected: ${[...path, identity.name].join(' -> ')}. ` +
					'A plugin load order cannot be resolved while the declared dependencies form a cycle.'
			);
		}

		visiting.add(identity);

		for (const dependency of getPluginDependencies(plugin)) {
			if (!configured.has(dependency)) {
				throw new Error(
					`Plugin ${identity.name} requires ${dependency?.name ?? 'an unnamed plugin'}, ` +
						'which is not present in the configured plugin list.'
				);
			}

			visit(dependency, [...path, identity.name]);
		}

		visiting.delete(identity);
		visited.add(identity);
		ordered.push(plugin);
	};

	for (const plugin of plugins) {
		visit(plugin, []);
	}

	return ordered;
}

/**
 * Validates the migrations declared across a plugin list.
 *
 * Two migrations sharing a timestamp would make the applied order depend on the file system, so the
 * installation is refused instead. A migration whose class name carries no timestamp cannot be
 * ordered at all and is refused for the same reason.
 *
 * @param migrations The declared migration classes.
 * @param ownerOf Resolves the package name that declared a migration, for diagnostics.
 * @returns The migrations with their resolved timestamps, in ascending order.
 * @throws When a timestamp is missing or duplicated.
 */
export function orderPluginMigrations(
	migrations: Array<Type<any>>,
	ownerOf: (migration: Type<any>) => string = () => 'unknown'
): Array<RegisteredMigration> {
	const seen = new Map<number, RegisteredMigration>();
	const ordered: Array<RegisteredMigration> = [];

	for (const migration of migrations) {
		const timestamp = readMigrationTimestamp(migration);

		if (timestamp === null) {
			throw new Error(
				`Migration ${migration?.name ?? 'unknown'} does not carry a timestamp in its class name. ` +
					'Plugin migrations must follow the <Name><timestamp> convention so they can be ordered.'
			);
		}

		const existing = seen.get(timestamp);
		if (existing) {
			throw new Error(
				`Two migrations claim the same timestamp ${timestamp}: ` +
					`${existing.name} (${existing.owner}) and ${migration?.name ?? 'unknown'} (${ownerOf(migration)}).`
			);
		}

		const entry: RegisteredMigration = {
			migration,
			timestamp,
			name: migration?.name ?? String(timestamp),
			owner: ownerOf(migration)
		};

		seen.set(timestamp, entry);
		ordered.push(entry);
	}

	return ordered.sort((left, right) => left.timestamp - right.timestamp);
}

/**
 * Get plugin modules from an array of plugins.
 * @param plugins An array of plugins.
 * @returns An array of modules obtained from the provided plugins.
 */
export function getPluginModules(plugins: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return plugins.map((plugin: Type<any> | DynamicModule) => {
		if (isDynamicModule(plugin)) {
			const { module } = plugin;
			return module;
		}
		return plugin;
	});
}

/**
 * Reflect metadata for a given metatype and metadata key.
 * @param metatype The type or dynamic module to reflect metadata from.
 * @param metadataKey The key for the metadata to be reflected.
 * @returns The metadata associated with the given key.
 */
function reflectMetadata(metatype: Type<any> | DynamicModule, metadataKey: string) {
	// Extract the module property if the metatype is a DynamicModule
	const target = isDynamicModule(metatype) ? metatype.module : metatype;

	// Retrieve and return metadata for the specified key
	return Reflect.getMetadata(metadataKey, target);
}

/**
 * Checks if a plugin has a specific lifecycle method.
 * @param plugin The plugin instance to check.
 * @param lifecycleMethod The lifecycle method to check for.
 * @returns True if the plugin has the specified lifecycle method, false otherwise.
 */
export function hasLifecycleMethod<M extends keyof PluginLifecycleMethods>(
	plugin: any,
	lifecycleMethod: M
): plugin is { [key in M]: PluginLifecycleMethods[M] } {
	return typeof (plugin as any)[lifecycleMethod] === 'function';
}

/**
 * Checks if a given type is a DynamicModule.
 * @param type The type to check.
 * @returns True if the type is a DynamicModule, false otherwise.
 */
export function isDynamicModule(type: Type<any> | DynamicModule): type is DynamicModule {
	return !!(type as DynamicModule).module;
}

/**
 * Reflects metadata from a dynamic module, extracting information about controllers, providers,
 * imports, and exports.
 * @param module The dynamic module to reflect metadata from.
 * @returns An object containing metadata information about controllers, providers, imports, and exports.
 */
export function reflectDynamicModuleMetadata(module: Type<any>) {
	return {
		controllers: reflectMetadata(module, MODULE_METADATA.CONTROLLERS) || [],
		providers: reflectMetadata(module, MODULE_METADATA.PROVIDERS) || [],
		imports: reflectMetadata(module, MODULE_METADATA.IMPORTS) || [],
		exports: reflectMetadata(module, MODULE_METADATA.EXPORTS) || []
	};
}

/**
 * Retrieves dynamic plugin modules based on the configuration.
 * @returns An array of DynamicModule instances extracted from the configuration.
 */
export function getDynamicPluginsModules(): DynamicModule[] {
	const plugins = getConfig().plugins;

	return plugins
		.map((plugin: Type<any> | DynamicModule) => {
			const pluginModule = isDynamicModule(plugin) ? plugin.module : plugin;
			const { imports, providers, exports } = reflectDynamicModuleMetadata(pluginModule);
			return {
				module: pluginModule,
				imports,
				exports,
				providers: [...providers]
			};
		})
		.filter(isNotEmpty);
}
