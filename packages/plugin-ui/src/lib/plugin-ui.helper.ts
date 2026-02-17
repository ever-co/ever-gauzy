import { Type } from '@angular/core';
import type { ExtensionDefinition } from './plugin-extension/extension-slot.types';
import {
	PluginUiDefinition,
	PluginNavContribution,
	PluginRouteInput,
	PluginTabInput,
	flattenPlugins
} from './plugin-ui.types';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';

/**
 * Minimal interface for applying nav sections/items.
 * Implemented by NavMenuBuilderService from @gauzy/ui-core.
 */
export interface IDeclarativeNavBuilder {
	addNavMenuSection(config: unknown, before?: string): void;
	addNavMenuItems(configs: unknown[], sectionId: string, before?: string): void;
}

/**
 * Minimal interface for registering page routes.
 * Implemented by PageRouteRegistryService from @gauzy/ui-core.
 */
export interface IDeclarativePageRouteRegistry {
	registerPageRoute(config: unknown): void;
	registerPageRoutes(configs: unknown[]): void;
}

/**
 * Options for extension registration (e.g. pluginId for lifecycle cleanup).
 */
export interface IDeclarativeExtensionRegistryOptions {
	pluginId?: string;
}

/**
 * Minimal interface for registering extensions.
 * Implemented by PageExtensionRegistryService from @gauzy/plugin-ui.
 */
export interface IDeclarativeExtensionRegistry {
	register(extension: ExtensionDefinition, options?: IDeclarativeExtensionRegistryOptions): void;
	registerAll(extensions: ExtensionDefinition[], options?: IDeclarativeExtensionRegistryOptions): void;
}

/**
 * Minimal interface for registering page tabs.
 * Implemented by PageTabRegistryService from @gauzy/ui-core.
 */
export interface IDeclarativePageTabRegistry {
	registerPageTab(config: unknown): void;
	registerPageTabs(configs: unknown[]): void;
}

/**
 * Options for defining a simple plugin.
 */
export interface DefinePluginOptions {
	/** Page-route registry location (e.g. 'jobs-sections', 'integrations-sections'). */
	location?: string;
	/** Plugin-specific options, available via `inject(PLUGIN_OPTIONS)`. */
	options?: Record<string, unknown>;
	/** Lazy-load the module. Use for code-splitting. */
	loadModule?: () => Promise<Type<any>>;
}

/**
 * Options for defining a plugin group (parent with child plugins).
 *
 * The `init` option signature is `(opts, base)` where:
 * - `opts` is `{ plugins: PluginUiDefinition[] }` (runtime plugin list to merge)
 * - `base` is the base `PluginUiDefinition` built from the group options
 *
 * The value returned by `definePluginGroup` has an `init` property (`initBound`) that
 * is the same function with `base` already bound, so it takes only
 * `(opts: { plugins: PluginUiDefinition[] })` and returns `PluginUiDefinition`.
 * See `definePluginGroup` for how `base` and `initBound` are constructed.
 */
export interface DefinePluginGroupOptions extends DefinePluginOptions {
	/** Default child plugins. */
	plugins: PluginUiDefinition[];
	/**
	 * Optional init factory. Signature: `(opts, base)`.
	 * When omitted, defaults to merging `opts.plugins` into base.
	 */
	init?: (opts: { plugins: PluginUiDefinition[] }, base: PluginUiDefinition) => PluginUiDefinition;
}

/**
 * Creates a plugin definition from an NgModule.
 *
 * @param id Unique plugin identifier.
 * @param module Angular module class.
 * @param options Optional location, options, or plugins.
 *
 * @example
 * ```ts
 * export const JobEmployeePlugin = definePlugin('job-employee', JobEmployeeModule, {
 *   location: 'jobs-sections'
 * });
 * ```
 */
export function definePlugin(
	id: string,
	moduleOrLoad: Type<any> | (() => Promise<Type<any>>),
	options?: DefinePluginOptions
): PluginUiDefinition {
	const isLoader = typeof moduleOrLoad === 'function' && !moduleOrLoad.prototype;
	return {
		id,
		module: isLoader ? undefined : (moduleOrLoad as Type<any>),
		loadModule: isLoader ? (moduleOrLoad as () => Promise<Type<any>>) : options?.loadModule,
		location: options?.location,
		options: options?.options
	};
}

/**
 * Creates a plugin group definition (parent with child plugins).
 *
 * The options `init` (see {@link DefinePluginGroupOptions}) has signature
 * `(opts, base)` where `opts` is `{ plugins: PluginUiDefinition[] }` and
 * `base` is the base `PluginUiDefinition`. The returned object's `init`
 * (`initBound`) is the same function with `base` already bound, so callers
 * pass only `(opts: { plugins: PluginUiDefinition[] })` and receive
 * `PluginUiDefinition`. This pre-binding avoids confusion between the raw
 * init signature and the convenience init on the returned object.
 *
 * @param id Unique plugin identifier.
 * @param module Angular module class (the parent layout/shell).
 * @param options Location, child plugins, and optional init factory.
 *
 * @example
 * ```ts
 * export const JobsPlugin = definePluginGroup('jobs', JobsModule, {
 *   location: 'jobs-sections',
 *   plugins: [JobEmployeePlugin, JobSearchPlugin],
 *   init: (opts, base) => ({ ...base, plugins: opts.plugins })
 * });
 * ```
 *
 * If `init` is omitted, a default merges `opts.plugins` into the base definition.
 */
export function definePluginGroup(
	id: string,
	module: Type<any>,
	options: DefinePluginGroupOptions
): PluginUiDefinition & { init: (opts: { plugins: PluginUiDefinition[] }) => PluginUiDefinition } {
	const base: PluginUiDefinition = {
		id,
		module,
		location: options.location,
		plugins: options.plugins,
		options: options.options
	};
	const init =
		options.init ??
		((opts: { plugins: PluginUiDefinition[] }, b: PluginUiDefinition) => ({
			...b,
			plugins: opts.plugins
		}));
	const initBound = (opts: { plugins: PluginUiDefinition[] }) => init(opts, base);
	return Object.assign(base, { init: initBound });
}

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

/** Plugin definition with at least one of module or loadModule present (from flattenPlugins output). */
export type PluginUiDefinitionWithModuleOrLoader = PluginUiDefinition &
	({ module: Type<any> } | { loadModule: () => Promise<Type<any>> });

/**
 * Extract (definition, module) pairs from plugin definitions.
 * Includes plugins with either `module` or `loadModule`; for loadModule,
 * the module is resolved async in createPluginInstances.
 *
 * Uses flattenPlugins, then filters with !!p.module || !!p.loadModule so the returned
 * definition is narrowed to PluginUiDefinitionWithModuleOrLoader (at least one present).
 */
export function getUIPluginModulesWithDefinitions(
	plugins: PluginUiDefinition[]
): Array<{
	definition: PluginUiDefinitionWithModuleOrLoader;
	module?: Type<any>;
	loadModule?: () => Promise<Type<any>>;
}> {
	const flat = flattenPlugins(plugins);
	return flat
		.filter(
			(p): p is PluginUiDefinitionWithModuleOrLoader => !!p.module || !!p.loadModule
		)
		.map((definition) => ({
			definition,
			module: definition.module,
			loadModule: definition.loadModule
		}));
}

/**
 * All plugin lifecycle method names (including optional extended hooks).
 */
export const PLUGIN_LIFECYCLE_METHOD_NAMES = [
	'ngOnPluginBootstrap',
	'ngOnPluginDestroy',
	'ngOnPluginAfterBootstrap',
	'ngOnPluginBeforeDestroy',
	'ngOnPluginBeforeRouteActivate',
	'ngOnPluginConfigChange'
] as const;

/**
 * Applies declarative registrations from a plugin definition.
 * Call this in the plugin module constructor (or ngOnPluginBootstrap) after
 * injecting PLUGIN_DEFINITION, NavMenuBuilderService, and PageRouteRegistryService.
 *
 * @param definition The plugin definition (from inject(PLUGIN_DEFINITION)).
 * @param services Nav builder and/or page route registry. Omit services you don't need.
 *
 * @example
 * ```ts
 * constructor() {
 *   const def = inject(PLUGIN_DEFINITION);
 *   applyDeclarativeRegistrations(def, {
 *     navBuilder: inject(NavMenuBuilderService),
 *     pageRouteRegistry: inject(PageRouteRegistryService)
 *   });
 * }
 * ```
 */
export function applyDeclarativeRegistrations(
	definition: PluginUiDefinition,
	services: {
		navBuilder?: IDeclarativeNavBuilder;
		pageRouteRegistry?: IDeclarativePageRouteRegistry;
		pageTabRegistry?: IDeclarativePageTabRegistry;
		pageExtensionRegistry?: IDeclarativeExtensionRegistry;
	}
): void {
	const { navBuilder, pageRouteRegistry, pageTabRegistry, pageExtensionRegistry } = services;

	if (pageRouteRegistry && definition.routes?.length) {
		for (const r of definition.routes) {
			pageRouteRegistry.registerPageRoute(r as PluginRouteInput & { location: string });
		}
	}

	if (navBuilder && definition.navMenu?.length) {
		for (const entry of definition.navMenu as PluginNavContribution[]) {
			if (entry.type === 'section') {
				navBuilder.addNavMenuItems(entry.items, entry.sectionId, entry.before);
			} else {
				navBuilder.addNavMenuSection(entry.config, entry.before);
			}
		}
	}

	if (pageTabRegistry && definition.tabs?.length) {
		for (const tab of definition.tabs as PluginTabInput[]) {
			pageTabRegistry.registerPageTab(tab);
		}
	}

	if (pageExtensionRegistry && definition.extensions?.length) {
		pageExtensionRegistry.registerAll(definition.extensions, { pluginId: definition.id });
	}
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
