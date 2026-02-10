import { InjectionToken, Type } from '@angular/core';

/**
 * Defines a UI plugin for the Gauzy application.
 *
 * Each plugin encapsulates an Angular module, its metadata, and a
 * location key used by the plugin registry to wire routes, navigation
 * menus, and feature modules dynamically.
 *
 * Lifecycle hooks live on the **module class** itself — implement
 * `IOnUIPluginBootstrap` and/or `IOnUIPluginDestroy` on your
 * `@NgModule` class and the `UIPluginModule` will call them
 * automatically.
 *
 * @example
 * ```ts
 * export const JobEmployeePlugin: GauzyUIPlugin = {
 *     id: 'job-employee',
 *     module: JobEmployeeModule,
 *     location: 'jobs'
 * };
 * ```
 */
export interface GauzyUIPlugin {
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
 * Single source of truth for authentication strategy, internationalization
 * defaults, and the list of active UI plugins. Loaded before Angular
 * bootstrap so every module can rely on it at initialization time.
 *
 * @example
 * ```ts
 * export const uiPluginConfig: AppUIConfig = {
 *     defaultLanguage: 'en',
 *     defaultLocale: 'en-US',
 *     availableLanguages: ['en', 'fr', 'de', 'es'],
 *     availableLocales: ['en-US', 'fr-FR', 'de-DE', 'es-ES'],
 *     plugins: [
 *         JobEmployeePlugin,
 *         JobMatchingPlugin
 *     ]
 * };
 * ```
 */
export interface AppUIConfig {
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
	 * Used when calling `moment.updateLocale()` for default calendar behavior.
	 */
	week?: { dow: number };

	/** Active UI plugins. */
	plugins: GauzyUIPlugin[];
}

/**
 * InjectionToken that provides the application UI configuration.
 *
 * Inject this in services or components as an alternative to the
 * functional `getAppUIConfig()` accessor — useful for testing and
 * when you prefer explicit DI over ambient singletons.
 *
 * @example
 * ```ts
 * constructor(@Inject(APP_UI_CONFIG) private config: AppUIConfig) {
 *     console.log(config.defaultLanguage);
 * }
 * ```
 */
export const APP_UI_CONFIG = new InjectionToken<AppUIConfig>('APP_UI_CONFIG');

/**
 * @deprecated Use `AppUIConfig` instead. Will be removed in a future release.
 */
export type AppPluginConfig = AppUIConfig;

// ─── Utility helpers ────────────────────────────────────────────────

/**
 * Checks whether a specific plugin is present in the configuration.
 *
 * @param config The application UI configuration.
 * @param pluginId The plugin `id` to look for.
 * @returns `true` if the plugin is listed in the config.
 */
export function isPluginActive(config: AppUIConfig, pluginId: string): boolean {
	return config.plugins.some((p) => p.id === pluginId);
}

/**
 * Returns all plugins whose `location` matches the given value.
 *
 * @param config The application UI configuration.
 * @param location The page-route registry location to filter by (e.g. 'jobs').
 * @returns An array of matching `GauzyUIPlugin` entries.
 */
export function getPluginsByLocation(config: AppUIConfig, location: string): GauzyUIPlugin[] {
	return config.plugins.filter((p) => p.location === location);
}

/**
 * Returns the Angular module classes for all plugins that match a given location.
 *
 * Useful for spreading into an `@NgModule.imports` array so that only
 * configured plugins are loaded.
 *
 * @param config The application UI configuration.
 * @param location The page-route registry location to filter by.
 * @returns An array of Angular module `Type` references.
 *
 * @example
 * ```ts
 * const JOB_PLUGIN_MODULES = getPluginModulesByLocation(uiPluginConfig, 'jobs');
 *
 * @NgModule({ imports: [...JOB_PLUGIN_MODULES] })
 * export class JobsModule {}
 * ```
 */
export function getPluginModulesByLocation(config: AppUIConfig, location: string): Type<any>[] {
	return getPluginsByLocation(config, location).map((p) => p.module);
}
