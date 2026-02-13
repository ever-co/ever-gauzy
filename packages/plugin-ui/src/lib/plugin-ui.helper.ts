import { Type } from '@angular/core';
import { PluginUiDefinition, flattenPlugins } from './plugin-ui.types';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';

/**
 * Extract Angular module classes from an array of UI plugin definitions.
 * Returns modules in top-down order (parent before children) for initialization.
 *
 * @param plugins An array of `PluginUiDefinition` entries (may contain parent plugins with nested plugins).
 * @returns An array of Angular module `Type` references, parent-first order.
 */
export function getUIPluginModules(plugins: PluginUiDefinition[]): Type<any>[] {
	const flat = flattenPlugins(plugins);
	return flat.filter((p): p is PluginUiDefinition & { module: Type<any> } => !!p.module).map((p) => p.module);
}

/**
 * Checks if a plugin instance implements a specific lifecycle method.
 *
 * Performs a runtime typeof check and narrows the type via a type predicate.
 *
 * @param plugin The plugin module instance to inspect.
 * @param lifecycleMethod The lifecycle method name to look for.
 * @returns `true` if the instance has a callable method with that name.
 */
export function hasPluginUiLifecycleMethod<M extends keyof PluginUiLifecycleMethods>(
	plugin: any,
	lifecycleMethod: M
): plugin is { [key in M]: PluginUiLifecycleMethods[M] } {
	return typeof plugin?.[lifecycleMethod] === 'function';
}

