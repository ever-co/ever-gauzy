import { isNotEmpty } from '@gauzy/common';
import { getConfig } from '@gauzy/config';
import { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { PLUGIN_METADATA } from './constants';
import { PluginLifecycleMethods } from './extension-plugin';

export function getEntitiesFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<Type<any>> {
	if (!plugins) {
		return [];
	}
	return plugins
		.map((plugin) => reflectMetadata(plugin, PLUGIN_METADATA.ENTITIES))
		.reduce((all, entities) => [...all, ...(entities || [])], []);
}

export function getPluginExtensions(plugins: Array<Type<any> | DynamicModule>) {
	if (!plugins) {
		return [];
	}
	return plugins
		.map((plugin) => reflectMetadata(plugin, PLUGIN_METADATA.EXTENSIONS))
		.filter(isNotEmpty);
}

export function getPluginModules(
	plugins: Array<Type<any> | DynamicModule>
): Array<Type<any>> {
	return plugins.map((p) => (isDynamicModule(p) ? p.module : p));
}

function reflectMetadata(
	metatype: Type<any> | DynamicModule,
	metadataKey: string
) {
	return Reflect.getMetadata(
		metadataKey,
		isDynamicModule(metatype) ? metatype.module : metatype
	);
}

export function hasLifecycleMethod<M extends keyof PluginLifecycleMethods>(
	plugin: any,
	lifecycleMethod: M
): plugin is { [key in M]: PluginLifecycleMethods[M] } {
	return typeof (plugin as any)[lifecycleMethod] === 'function';
}

export function isDynamicModule(
	type: Type<any> | DynamicModule
): type is DynamicModule {
	return !!(type as DynamicModule).module;
}

export function reflectDynamicModuleMetadata(module: Type<any>) {
	return {
		controllers: reflectMetadata(module, MODULE_METADATA.CONTROLLERS) || [],
		providers: reflectMetadata(module, MODULE_METADATA.PROVIDERS) || [],
		imports: reflectMetadata(module, MODULE_METADATA.IMPORTS) || [],
		exports: reflectMetadata(module, MODULE_METADATA.EXPORTS) || []
	};
}

export function getDynamicPluginsModules(): DynamicModule[] {
	return getConfig()
		.plugins.map((plugin) => {
			const pluginModule = isDynamicModule(plugin)
				? plugin.module
				: plugin;
			const { imports, providers } = reflectDynamicModuleMetadata(
				pluginModule
			);
			return {
				module: pluginModule,
				imports,
				providers: [...providers]
			};
		})
		.filter(isNotEmpty);
}
