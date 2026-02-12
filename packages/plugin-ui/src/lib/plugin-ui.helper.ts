import { Type } from '@angular/core';
import { PluginUiDefinition } from './plugin-ui.types';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';

/**
 * Extract Angular module classes from an array of UI plugin definitions.
 *
 * @param plugins An array of `PluginUiDefinition` entries.
 * @returns An array of Angular module `Type` references.
 */
export function getUIPluginModules(plugins: PluginUiDefinition[]): Type<any>[] {
	return plugins.map((plugin) => plugin.module);
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

