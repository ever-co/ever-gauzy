import { InjectionToken, Type } from '@angular/core';
import type { ExtensionDefinition } from './plugin-extension/extension-slot.types';

/**
 * Minimal shape for a plugin-contributed page route.
 * Compatible with PageRouteRegistryConfig from @gauzy/ui-core.
 */
export interface PluginRouteInput {
	/** Location identifier (e.g. 'page-sections', 'jobs-sections'). */
	location: string;
	/** Route path. */
	path: string;
	/** Component to render (if not using loadChildren). */
	component?: Type<unknown>;
	/** Lazy load a module. */
	loadChildren?: () => Promise<Type<unknown> | unknown> | Type<unknown> | unknown;
	/** Route data. */
	data?: Record<string, unknown>;
	/** Route guards. */
	canActivate?: unknown[];
	/** Additional route options. */
	route?: Record<string, unknown>;
	resolve?: Record<string, unknown>;
}

/**
 * Minimal shape for a plugin-contributed nav section or item.
 * Compatible with NavMenuSectionItem from @gauzy/ui-core.
 */
export interface PluginNavItemInput {
	id: string;
	title?: string;
	icon?: string;
	link?: string;
	items?: PluginNavItemInput[];
	menuCategory?: 'main' | 'settings' | 'accordion';
	data: {
		translationKey: string;
		permissionKeys?: unknown[];
		featureKey?: unknown;
		/** Function or plain boolean to control visibility. */
		hide?: (() => boolean) | boolean;
		/** Link for the add/action button (e.g. create new). */
		add?: string;
	};
}

/**
 * Declarative nav contribution: either a new section (parent) or items for an existing section (children).
 * Sections are parent menus; items are child/nested menus under a section.
 * Use the `type` discriminant for type-narrowing and exhaustive checks.
 */
export type PluginNavContribution =
	| { type: 'config'; config: PluginNavItemInput; before?: string }
	| { type: 'section'; sectionId: string; items: PluginNavItemInput[]; before?: string };

/**
 * Minimal shape for a plugin-contributed page tab.
 * Compatible with PageTabRegistryConfig from @gauzy/ui-core.
 */
export interface PluginTabInput {
	/** Tabset id (e.g. 'dashboard-page', 'timesheet-page', 'job-employee-page'). */
	tabsetId: string;
	/** Unique tab id. */
	tabId: string;
	/** Tab title (translation key or resolved string). */
	tabTitle: string | ((i18n: unknown) => string);
	/** Tab icon. */
	tabIcon?: string;
	/** Display order. */
	order?: number;
	/** Tabset type: 'route' or 'standard'. */
	tabsetType: 'route' | 'standard';
	/** Route path (for route tabset). */
	path?: string;
	/** Component to render. */
	component?: Type<unknown>;
	/** Permissions to show tab. */
	permissions?: unknown | unknown[];
	/** Hide flag. */
	hide?: boolean;
}

/**
 * Defines a UI plugin for the Gauzy application.
 *
 * Each plugin encapsulates an Angular module, its metadata, and a
 * location key used by the plugin registry to wire routes, navigation
 * menus, and feature modules dynamically.
 *
 * Plugins can be hierarchical: a parent plugin may have `plugins` that
 * belong under it. Parent plugins with nested plugins can omit `module` and
 * act as logical groups (e.g. JobsPlugin containing JobEmployeePlugin,
 * JobMatchingPlugin, etc.).
 *
 * Declarative registration: set `routes`, `navMenu`, etc. to have them applied
 * when the plugin bootstraps. The plugin module can call
 * `applyDeclarativeRegistrations(inject(PLUGIN_DEFINITION), { navBuilder, pageRouteRegistry })`.
 */
export interface PluginUiDefinition {
	/** Unique identifier for this plugin (e.g. 'job-employee', 'job-search', 'jobs'). */
	id: string;

	/**
	 * The Angular module class that this plugin provides.
	 * Optional when `plugins` or `loadModule` is present.
	 */
	module?: Type<any>;

	/**
	 * Async factory to lazy-load the plugin module. When provided, the module
	 * is loaded on demand at bootstrap (or when the plugin is first needed).
	 * Use for code-splitting heavy plugins.
	 *
	 * @example
	 * loadModule: () => import('@gauzy/plugin-jobs-ui').then(m => m.JobsModule)
	 */
	loadModule?: () => Promise<Type<any>>;

	/**
	 * The page-route registry location this plugin contributes to.
	 * Matches the `location` value used in `PageRouteRegistryService.registerPageRoute()`.
	 * Examples: 'jobs-sections', 'integrations-sections'.
	 */
	location?: string;

	/**
	 * Child plugins under this parent.
	 * Use for grouping (e.g. JobsPlugin.plugins = [JobEmployeePlugin, ...]).
	 */
	plugins?: PluginUiDefinition[];

	/**
	 * Optional plugin-specific options or metadata.
	 * Available to the plugin module via `inject(PLUGIN_OPTIONS)`.
	 */
	options?: Record<string, unknown>;

	/**
	 * Declarative page routes. Applied via PageRouteRegistryService when
	 * the plugin module calls applyDeclarativeRegistrations().
	 */
	routes?: PluginRouteInput[];

	/**
	 * Declarative nav menu contributions: sections (parent menus) and/or items (children under existing sections).
	 * Use { config, before? } for new sections; { sectionId, items, before? } for items under an existing section.
	 */
	navMenu?: PluginNavContribution[];

	/**
	 * Feature required for this plugin to activate. When using PLUGIN_ACTIVATION_PREDICATE,
	 * the host can check this to skip bootstrapping the plugin when the feature is disabled.
	 */
	featureKey?: unknown;

	/**
	 * Permissions required for this plugin to activate. When using PLUGIN_ACTIVATION_PREDICATE,
	 * the host can check these to skip bootstrapping the plugin when the user lacks permissions.
	 */
	permissionKeys?: unknown[];

	/**
	 * Plugin IDs that must be bootstrapped before this plugin. Ensures load order
	 * when plugins have implicit dependencies (e.g. a child plugin needing its parent).
	 */
	dependsOn?: string[];

	/**
	 * Extensions to register with PageExtensionRegistryService at bootstrap.
	 * Use applyDeclarativeRegistrations() with pageExtensionRegistry to apply.
	 */
	extensions?: ExtensionDefinition[];

	/**
	 * Page tabs to register with PageTabRegistryService (e.g. dashboard-page, timesheet-page).
	 * Use applyDeclarativeRegistrations() with pageTabRegistry to apply.
	 */
	tabs?: PluginTabInput[];
}

/**
 * Valid day-of-week value for week start (0 = Sunday … 6 = Saturday).
 * Used by Moment.js and calendar components.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Application-level UI configuration.
 *
 * Single source of truth for i18n defaults and the list of active UI plugins.
 * Loaded before Angular bootstrap so every module can rely on it at init time.
 */
export interface PluginUiConfig {
	/** BCP-47 language code used when no user/browser preference is available. */
	defaultLanguage: string;

	/** Locale identifier used for number/date formatting (e.g. 'en-US'). */
	defaultLocale: string;

	/**
	 * Fallback language when a translation is missing. Defaults to `defaultLanguage` if omitted.
	 */
	fallbackLocale?: string;

	/** Language codes the UI supports (populates the language switcher). */
	availableLanguages: string[];

	/** Locale identifiers the UI supports (populates the locale switcher). */
	availableLocales: string[];

	/**
	 * Day of week the week starts on (0 = Sunday, 1 = Monday, … 6 = Saturday).
	 * Used by Moment.js and calendar components.
	 */
	startWeekOn?: DayOfWeek;

	/** Active UI plugins. */
	plugins: PluginUiDefinition[];
}

/**
 * InjectionToken that provides the application UI configuration.
 */
export const PLUGIN_UI_CONFIG = new InjectionToken<PluginUiConfig>('PLUGIN_UI_CONFIG');

/**
 * InjectionToken that provides the current plugin's options.
 * Set by PluginUiModule when creating each plugin instance.
 * Use `inject(PLUGIN_OPTIONS)` inside a plugin module to access its options.
 */
export const PLUGIN_OPTIONS = new InjectionToken<Record<string, unknown>>('PLUGIN_OPTIONS');

/**
 * InjectionToken that provides the current plugin's definition.
 * Set by PluginUiModule when creating each plugin instance.
 * Use `inject(PLUGIN_DEFINITION)` to read declarative routes/navMenu/tabs/extensions
 * and call applyDeclarativeRegistrations() to apply them.
 */
export const PLUGIN_DEFINITION = new InjectionToken<PluginUiDefinition>('PLUGIN_DEFINITION');

/**
 * Optional predicate to filter which plugins are activated at bootstrap.
 * When provided, plugins for which the predicate returns false (or resolves to false)
 * are skipped and never instantiated.
 *
 * @example
 * ```ts
 * { provide: PLUGIN_ACTIVATION_PREDICATE, useFactory: () => {
 *   const store = inject(Store);
 *   return (def: PluginUiDefinition) => {
 *     if (def.featureKey && !store.hasFeatureEnabled(def.featureKey)) return false;
 *     if (def.permissionKeys?.length && !store.hasAnyPermission(...def.permissionKeys)) return false;
 *     return true;
 *   };
 * }, deps: [Store] }
 * ```
 */
export const PLUGIN_ACTIVATION_PREDICATE = new InjectionToken<
	(definition: PluginUiDefinition) => boolean | Promise<boolean>
>('PLUGIN_ACTIVATION_PREDICATE');

/**
 * @deprecated Use `PluginUiConfig` instead. Will be removed in a future release.
 */
export type AppPluginConfig = PluginUiConfig;

// ─── Utility helpers ────────────────────────────────────────────────

function getNestedPlugins(p: PluginUiDefinition): PluginUiDefinition[] | undefined {
	return p.plugins?.length ? p.plugins : undefined;
}

/**
 * Orders plugins by dependsOn so that dependencies are bootstrapped first.
 * Throws if a circular dependency is detected.
 *
 * @param plugins Flat plugin list (e.g. from flattenPlugins).
 * @returns Plugins reordered so each plugin comes after its dependsOn.
 */
export function orderPluginsByDependencies(plugins: PluginUiDefinition[]): PluginUiDefinition[] {
	const byId = new Map(plugins.map((p) => [p.id, p]));
	const sorted: PluginUiDefinition[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function visit(id: string): void {
		if (visited.has(id)) return;
		if (visiting.has(id)) {
			throw new Error(`Plugin dependency cycle detected involving "${id}"`);
		}
		visiting.add(id);
		const def = byId.get(id);
		if (def?.dependsOn?.length) {
			for (const depId of def.dependsOn) {
				if (byId.has(depId)) {
					visit(depId);
				}
			}
		}
		visiting.delete(id);
		visited.add(id);
		if (def) sorted.push(def);
	}

	for (const p of plugins) {
		visit(p.id);
	}
	return sorted;
}

/**
 * Flattens a plugin tree into a list of all plugins (including nested plugins).
 * Order is top-down: parent before children. Parent group plugins that have no
 * module are not included; only leaf plugins and parent plugins with a module
 * are returned. Plugins are initialized in this order (parent first, then children).
 * Use orderPluginsByDependencies() afterward if plugins use dependsOn.
 *
 * @param plugins Top-level plugins array (may contain parents with nested plugins).
 * @returns Flat array in parent-before-children order.
 */
export function flattenPlugins(plugins: PluginUiDefinition[]): PluginUiDefinition[] {
	const result: PluginUiDefinition[] = [];
	for (const p of plugins) {
		const nested = getNestedPlugins(p);
		if (nested?.length) {
			if (p.module) {
				result.push(p);
			}
			result.push(...flattenPlugins(nested));
		} else {
			result.push(p);
		}
	}
	return result;
}

/**
 * Collects all plugin IDs from a plugin tree (including nested plugins).
 */
export function collectPluginIds(plugins: PluginUiDefinition[]): string[] {
	const ids: string[] = [];
	for (const p of plugins) {
		ids.push(p.id);
		const nested = getNestedPlugins(p);
		if (nested?.length) {
			ids.push(...collectPluginIds(nested));
		}
	}
	return ids;
}

/**
 * Checks whether a specific plugin is present in the configuration.
 */
export function isPluginActive(config: PluginUiConfig, pluginId: string): boolean {
	return collectPluginIds(config.plugins).includes(pluginId);
}

/**
 * Returns all plugins whose `location` matches the given value.
 */
export function getPluginsByLocation(config: PluginUiConfig, location: string): PluginUiDefinition[] {
	return flattenPlugins(config.plugins).filter((p) => p.location === location);
}

/**
 * Returns the Angular module classes for all plugins that match a given location.
 */
export function getPluginModulesByLocation(config: PluginUiConfig, location: string): Type<any>[] {
	return getPluginsByLocation(config, location)
		.filter((p): p is PluginUiDefinition & { module: Type<any> } => !!p.module)
		.map((p) => p.module);
}

/**
 * Recursively finds a plugin by ID in the plugin tree (includes module-less group parents).
 */
function findPluginById(plugins: PluginUiDefinition[], pluginId: string): PluginUiDefinition | undefined {
	for (const p of plugins) {
		if (p.id === pluginId) return p;
		const nested = getNestedPlugins(p);
		if (nested?.length) {
			const found = findPluginById(nested, pluginId);
			if (found) return found;
		}
	}
	return undefined;
}

/**
 * Returns the plugin definition for a given plugin ID.
 * Includes module-less group parents (unlike flattenPlugins), so it is consistent
 * with isPluginActive(config, pluginId).
 */
export function getPluginDefinition(config: PluginUiConfig, pluginId: string): PluginUiDefinition | undefined {
	return findPluginById(config.plugins, pluginId);
}

/**
 * Returns the plugin definition that provides the given module class.
 */
export function getPluginDefinitionByModule(
	config: PluginUiConfig,
	moduleType: Type<any>
): PluginUiDefinition | undefined {
	return flattenPlugins(config.plugins).find((p) => p.module === moduleType);
}
