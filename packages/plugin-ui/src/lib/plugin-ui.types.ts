import { InjectionToken, Type } from '@angular/core';

/**
 * Defines a UI plugin for the Gauzy application.
 *
 * Each plugin encapsulates an Angular module, its metadata, and a
 * location key used by the plugin registry to wire routes, navigation
 * menus, and feature modules dynamically.
 */
export interface PluginUiDefinition {
	/** Unique identifier for this plugin (e.g. 'job-employee', 'job-search'). */
	id: string;

	/** The Angular module class that this plugin provides. */
	module: Type<any>;

	/**
	 * The page-route registry location this plugin contributes to.
	 * Matches the `location` value used in `PageRouteRegistryService.registerPageRoute()`.
	 * Examples: 'jobs', 'settings', 'integrations'.
	 */
	location?: string;
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

/**
 * Checks whether a specific plugin is present in the configuration.
 */
export function isPluginActive(config: PluginUiConfig, pluginId: string): boolean {
	return config.plugins.some((p) => p.id === pluginId);
}

/**
 * Returns all plugins whose `location` matches the given value.
 */
export function getPluginsByLocation(config: PluginUiConfig, location: string): PluginUiDefinition[] {
	return config.plugins.filter((p) => p.location === location);
}

/**
 * Returns the Angular module classes for all plugins that match a given location.
 */
export function getPluginModulesByLocation(config: PluginUiConfig, location: string): Type<any>[] {
	return getPluginsByLocation(config, location).map((p) => p.module);
}

