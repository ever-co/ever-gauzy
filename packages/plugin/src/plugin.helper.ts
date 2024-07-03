import { isNotEmpty } from '@gauzy/common';
import { getConfig } from '@gauzy/config';
import { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PLUGIN_METADATA } from './plugin-metadata';
import { PluginLifecycleMethods } from './plugin.interface';

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
