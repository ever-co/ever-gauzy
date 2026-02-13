import { InjectionToken, Type } from '@angular/core';

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
 */
export interface PluginUiDefinition {
	/** Unique identifier for this plugin (e.g. 'job-employee', 'job-search', 'jobs'). */
	id: string;

	/**
	 * The Angular module class that this plugin provides.
	 * Optional when `plugins` is present — the parent acts as a logical group.
	 */
	module?: Type<any>;

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
}

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

	/** Language codes the UI supports (populates the language switcher). */
	availableLanguages: string[];

	/** Locale identifiers the UI supports (populates the locale switcher). */
	availableLocales: string[];

	/**
	 * Moment.js week option: `dow` is the day of week the week starts on (0 = Sunday, 1 = Monday, …).
	 */
	week?: { dow: number };

	/** Active UI plugins. */
	plugins: PluginUiDefinition[];
}

/**
 * InjectionToken that provides the application UI configuration.
 */
export const PLUGIN_UI_CONFIG = new InjectionToken<PluginUiConfig>('PLUGIN_UI_CONFIG');

/**
 * @deprecated Use `PluginUiConfig` instead. Will be removed in a future release.
 */
export type AppPluginConfig = PluginUiConfig;

// ─── Utility helpers ────────────────────────────────────────────────

function getNestedPlugins(p: PluginUiDefinition): PluginUiDefinition[] | undefined {
	return p.plugins?.length ? p.plugins : undefined;
}

/**
 * Flattens a plugin tree into a list of all plugins (including nested plugins).
 * Order is top-down: parent before children. Parent group plugins that have no
 * module are not included; only leaf plugins and parent plugins with a module
 * are returned. Plugins are initialized in this order (parent first, then children).
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
