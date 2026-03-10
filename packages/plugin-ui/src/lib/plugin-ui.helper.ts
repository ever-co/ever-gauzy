import { DestroyRef, InjectionToken, Injector, Type } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import type { PageExtensionDefinition } from './plugin-extension/page-extension-slot.types';
import {
	PluginUiDefinition,
	PluginNavContribution,
	PluginRouteInput,
	PluginTabInput,
	flattenPlugins
} from './plugin-ui.types';
import { PluginUiLifecycleMethods } from './plugin-ui.interface';
import { PageExtensionRegistryService } from './plugin-extension/page-extension-registry.service';
import { PluginSettingsRegistryService } from './plugin-host/plugin-settings-registry.service';
import { namespaceTranslations } from './plugin-i18n-namespace';

// ─── Declarative service tokens ──────────────────────────────────────────────

/**
 * Optional InjectionToken for the nav-menu builder service.
 * Provide via `PluginUiModule.init({ navBuilder: NavMenuBuilderService })`.
 * Used internally by `defineDeclarativePlugin` to wire up nav contributions.
 */
export const PLUGIN_NAV_BUILDER = new InjectionToken<IDeclarativeNavBuilder>('PLUGIN_NAV_BUILDER');

/**
 * Optional InjectionToken for the page-route registry service.
 * Provide via `PluginUiModule.init({ routeRegistry: PageRouteRegistryService })`.
 * Used internally by `defineDeclarativePlugin` to register plugin routes.
 */
export const PLUGIN_ROUTE_REGISTRY = new InjectionToken<IDeclarativePageRouteRegistry>('PLUGIN_ROUTE_REGISTRY');

/**
 * Optional InjectionToken for the page-tab registry service.
 * Provide via `PluginUiModule.init({ tabRegistry: PageTabRegistryService })`.
 * Used internally by `defineDeclarativePlugin` to register plugin tabs.
 */
export const PLUGIN_TAB_REGISTRY = new InjectionToken<IDeclarativePageTabRegistry>('PLUGIN_TAB_REGISTRY');

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
	register(extension: PageExtensionDefinition, options?: IDeclarativeExtensionRegistryOptions): void;
	registerAll(extensions: PageExtensionDefinition[], options?: IDeclarativeExtensionRegistryOptions): void;
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
 * Minimal interface for plugin translation management (read + write).
 * Structurally compatible with @ngx-translate/core TranslateService (duck typing).
 */
export interface IPluginTranslateService {
	// ─── Write (merge) ───────────────────────────────────────────
	setTranslation(lang: string, translations: Record<string, any>, shouldMerge?: boolean): void;
	getTranslations(lang: string): Readonly<Record<string, any>> | undefined;

	// ─── Read ────────────────────────────────────────────────────
	getCurrentLang(): string;
	getFallbackLang(): string | null;
	/** Synchronous translation lookup. Returns the key itself if not found. */
	instant(key: string, params?: Record<string, unknown>): string;
	/** Reactive translation. Re-emits when language or translations change. */
	stream(key: string, params?: Record<string, unknown>): Observable<string>;

	// ─── Events ──────────────────────────────────────────────────
	/** Emits whenever the active language changes (after translations are loaded). */
	onLangChange: Observable<{ lang: string }>;
}

/**
 * Optional InjectionToken for the translate service.
 * Provide via `PluginUiModule.init({ translateService: TranslateService })`.
 * Used internally by `defineDeclarativePlugin` to merge plugin translations.
 */
export const PLUGIN_TRANSLATE_SERVICE = new InjectionToken<IPluginTranslateService>('PLUGIN_TRANSLATE_SERVICE');

// ─── Translate Backing Delegates ─────────────────────────────────────────────

/**
 * Minimal interface for the backing translate service (e.g. `TranslateService` from `@ngx-translate/core`).
 * Used by the built-in `TranslateAdapterService` inside `@gauzy/plugin-ui`.
 *
 * The host application provides the concrete service via:
 * ```typescript
 * { provide: PLUGIN_TRANSLATE_DELEGATE, useExisting: TranslateService }
 * ```
 */
export interface IPluginTranslateDelegate {
	setTranslation(lang: string, translations: Record<string, any>, shouldMerge?: boolean): void;
	getCurrentLang(): string;
	getFallbackLang(): string | null;
	instant(key: string, params?: Record<string, unknown>): string;
	stream(key: string, params?: Record<string, unknown>): Observable<string>;
	onLangChange: Observable<{ lang: string }>;
}

/**
 * Minimal interface for the backing translate store (e.g. `TranslateStore` from `@ngx-translate/core`).
 * Provides access to compiled translation data by language.
 *
 * The host application provides the concrete store via:
 * ```typescript
 * { provide: PLUGIN_TRANSLATE_STORE_DELEGATE, useExisting: TranslateStore }
 * ```
 */
export interface IPluginTranslateStoreDelegate {
	getTranslations(lang: string): Readonly<Record<string, any>> | undefined;
}

/**
 * InjectionToken for the host application's translate service (e.g. `TranslateService`).
 */
export const PLUGIN_TRANSLATE_DELEGATE = new InjectionToken<IPluginTranslateDelegate>('PLUGIN_TRANSLATE_DELEGATE');

/**
 * InjectionToken for the host application's translate store (e.g. `TranslateStore`).
 */
export const PLUGIN_TRANSLATE_STORE_DELEGATE = new InjectionToken<IPluginTranslateStoreDelegate>(
	'PLUGIN_TRANSLATE_STORE_DELEGATE'
);

// ─── Permission & Feature Flag Interfaces ────────────────────────────────────

/**
 * Minimal interface for checking user permissions.
 * Implement by wrapping your app's permission service (e.g. Store.hasPermission).
 *
 * Provided via `PluginUiModule.init({ permissionChecker: ... })`.
 * Used by `PageExtensionRegistryService` to gate extension visibility.
 */
export interface IPluginPermissionChecker {
	/** Returns true if the user has the specified permission. */
	hasPermission(permission: string): boolean;
	/** Returns true if the user has ALL specified permissions. */
	hasAllPermissions(...permissions: string[]): boolean;
	/** Returns true if the user has ANY of the specified permissions. */
	hasAnyPermission(...permissions: string[]): boolean;
}

/**
 * Minimal interface for checking feature flags.
 * Implement by wrapping your app's feature store (e.g. Store.hasFeatureEnabled).
 *
 * Provided via `PluginUiModule.init({ featureChecker: ... })`.
 * Used by `PageExtensionRegistryService` to gate extension visibility.
 */
export interface IPluginFeatureChecker {
	/** Returns true if the specified feature is enabled. */
	isFeatureEnabled(featureKey: string): boolean;
}

/**
 * Optional InjectionToken for checking user permissions.
 * Provide via `PluginUiModule.init({ permissionChecker: PermissionAdapterService })`.
 * Used by `PageExtensionRegistryService._checkPermissions()`.
 */
export const PLUGIN_PERMISSION_CHECKER = new InjectionToken<IPluginPermissionChecker>('PLUGIN_PERMISSION_CHECKER');

/**
 * Optional InjectionToken for checking feature flags.
 * Provide via `PluginUiModule.init({ featureChecker: FeatureAdapterService })`.
 * Used by `PageExtensionRegistryService._checkFeature()`.
 */
export const PLUGIN_FEATURE_CHECKER = new InjectionToken<IPluginFeatureChecker>('PLUGIN_FEATURE_CHECKER');

// ─── Backing Store Interface ─────────────────────────────────────────────────

/**
 * Minimal interface for the application's backing store (e.g. `Store` from `@gauzy/ui-core/core`).
 *
 * Used by the built-in `PermissionAdapterService` and `FeatureAdapterService` inside
 * `@gauzy/plugin-ui`. The host application provides its store via:
 *
 * ```typescript
 * { provide: PLUGIN_APP_STORE, useExisting: Store }
 * ```
 *
 * This avoids a dependency from `@gauzy/plugin-ui` → `@gauzy/ui-core/core`.
 */
export interface IPluginAppStore {
	hasPermission(permission: any): boolean;
	hasAllPermissions(...permissions: any[]): boolean;
	hasAnyPermission(...permissions: any[]): boolean;
	hasFeatureEnabled(featureKey: any): boolean;
}

/**
 * InjectionToken for the host application's backing store.
 *
 * Provide via the root module's `providers` array:
 * ```typescript
 * { provide: PLUGIN_APP_STORE, useExisting: Store }
 * ```
 */
export const PLUGIN_APP_STORE = new InjectionToken<IPluginAppStore>('PLUGIN_APP_STORE');

/**
 * Filters incoming translation data to only include keys that don't already
 * exist in the target. Recursively walks nested objects so that new nested
 * keys can be added without overriding existing leaf values.
 *
 * This ensures plugins can only ADD translations — never override core keys.
 *
 * @returns A filtered object containing only new keys, or `null` if nothing is new.
 */
export function filterNewTranslationKeys(
	existing: Record<string, any>,
	incoming: Record<string, any>
): Record<string, any> | null {
	const result: Record<string, any> = {};
	let hasNewKeys = false;

	for (const [key, value] of Object.entries(incoming)) {
		if (!(key in existing)) {
			// Key doesn't exist in core — include it entirely
			result[key] = value;
			hasNewKeys = true;
		} else if (
			typeof value === 'object' &&
			value !== null &&
			!Array.isArray(value) &&
			typeof existing[key] === 'object' &&
			existing[key] !== null &&
			!Array.isArray(existing[key])
		) {
			// Both are objects — recurse to find new nested keys
			const nested = filterNewTranslationKeys(existing[key], value);
			if (nested) {
				result[key] = nested;
				hasNewKeys = true;
			}
		}
		// Leaf key already exists in core → skip (never override)
	}

	return hasNewKeys ? result : null;
}

/**
 * Options for defining a simple plugin.
 *
 * Supports the full range of declarative fields (routes, tabs, navMenu, etc.)
 * so `definePlugin()` can serve as the single API for both module-based and
 * feature-rich plugins.
 */
export interface DefinePluginOptions {
	/** Page-route registry location (e.g. 'jobs-sections', 'integrations-sections'). */
	location?: string;
	/** Plugin-specific options, available via `inject(PLUGIN_OPTIONS)`. */
	options?: Record<string, unknown>;
	/** Lazy-load the module. Use for code-splitting. */
	loadModule?: () => Promise<Type<any>>;
	/** Declarative page routes. */
	routes?: PluginUiDefinition['routes'];
	/** Declarative nav menu contributions. */
	navMenu?: PluginUiDefinition['navMenu'];
	/** Page tabs to register. */
	tabs?: PluginUiDefinition['tabs'];
	/** Extensions to register at bootstrap. */
	extensions?: PluginUiDefinition['extensions'];
	/** Plugin translations keyed by language code. */
	translations?: PluginUiDefinition['translations'];
	/** Translation namespace prefix. */
	translationNamespace?: PluginUiDefinition['translationNamespace'];
	/** Plugin settings schema. */
	settings?: PluginUiDefinition['settings'];
	/** Semantic version of this plugin. */
	version?: PluginUiDefinition['version'];
	/** Peer plugin requirements. */
	peerPlugins?: PluginUiDefinition['peerPlugins'];
	/** Plugin IDs that must be bootstrapped first. */
	dependsOn?: PluginUiDefinition['dependsOn'];
	/** Feature key for activation predicate. */
	featureKey?: PluginUiDefinition['featureKey'];
	/** Permission keys for activation predicate. */
	permissionKeys?: PluginUiDefinition['permissionKeys'];
	/** Loading strategy (only meaningful with loadModule). */
	loadStrategy?: PluginUiDefinition['loadStrategy'];
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
		options: options?.options,
		routes: options?.routes,
		navMenu: options?.navMenu,
		tabs: options?.tabs,
		extensions: options?.extensions,
		translations: options?.translations,
		translationNamespace: options?.translationNamespace,
		settings: options?.settings,
		version: options?.version,
		peerPlugins: options?.peerPlugins,
		dependsOn: options?.dependsOn,
		featureKey: options?.featureKey,
		permissionKeys: options?.permissionKeys,
		loadStrategy: options?.loadStrategy
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
export function getUIPluginModulesWithDefinitions(plugins: PluginUiDefinition[]): Array<{
	definition: PluginUiDefinitionWithModuleOrLoader;
	module?: Type<any>;
	loadModule?: () => Promise<Type<any>>;
}> {
	const flat = flattenPlugins(plugins);
	return flat
		.filter((p): p is PluginUiDefinitionWithModuleOrLoader => !!p.module || !!p.loadModule)
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
			// Map PluginTabInput.path → PageTabRegistryConfig.route (used by NbRouteTabset)
			pageTabRegistry.registerPageTab({ ...tab, route: tab.path });
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

/**
 * Creates a declarative plugin definition with a zero-boilerplate `bootstrap` callback.
 *
 * Use this instead of hand-writing a `bootstrap` function that manually calls
 * `injector.get(NavMenuBuilderService)` etc. The helper auto-generates the callback
 * using the optional InjectionTokens registered by `PluginUiModule.init(services)`.
 *
 * Services are looked up at bootstrap time (not at definition time), so they are
 * always fully initialized when the callback runs.
 *
 * @example
 * ```ts
 * // plugin.ts
 * export const MyPlugin = defineDeclarativePlugin('my-plugin', {
 *   location: 'my-sections',
 *   routes: [MY_ROUTE],
 *   tabs: [MY_TAB],
 * });
 *
 * // bootstrap.module.ts
 * PluginUiModule.init({
 *   navBuilder: NavMenuBuilderService,
 *   routeRegistry: PageRouteRegistryService,
 *   tabRegistry: PageTabRegistryService,
 * })
 * ```
 *
 * @param id Unique plugin identifier.
 * @param definition All other plugin fields except `id` and `bootstrap`.
 */
export function defineDeclarativePlugin(
	id: string,
	definition: Omit<PluginUiDefinition, 'id' | 'bootstrap'>
): PluginUiDefinition {
	const plugin: PluginUiDefinition = { ...definition, id };
	plugin.bootstrap = (injector: Injector): void => {
		// Apply all declarative registrations (nav, routes, tabs, extensions) using the injected services.
		applyDeclarativeRegistrations(plugin, {
			navBuilder: injector.get(PLUGIN_NAV_BUILDER, null) ?? undefined,
			pageRouteRegistry: injector.get(PLUGIN_ROUTE_REGISTRY, null) ?? undefined,
			pageTabRegistry: injector.get(PLUGIN_TAB_REGISTRY, null) ?? undefined,
			pageExtensionRegistry: injector.get(PageExtensionRegistryService, null) ?? undefined
		});

		// Merge plugin translations into the global @ngx-translate namespace.
		// Safe merge: only adds new keys, never overrides core translations.
		//
		// IMPORTANT: Plugin translations must be merged AFTER core translations
		// are loaded. Calling setTranslation() before the core HTTP loader
		// completes would mark the language as "available" in TranslateStore,
		// causing ngx-translate to skip the HTTP load entirely — breaking
		// all core translations.
		//
		// Strategy: subscribe to onLangChange (fires after core translations
		// are loaded) and merge plugin translations on each language switch.
		// Also handle the case where the language was already loaded before
		// plugin bootstrap (merge immediately for the current language).
		if (plugin.translations) {
			const translateService = injector.get(PLUGIN_TRANSLATE_SERVICE, null);
			if (translateService) {
				// Apply namespace isolation: wrap translations under the namespace key
				// so plugins never collide with core or other plugins' keys.
				const translations = plugin.translationNamespace
					? namespaceTranslations(plugin.translationNamespace, plugin.translations)
					: plugin.translations;

				const mergeForLang = (lang: string): void => {
					const fallbackLang = translateService.getFallbackLang() || 'en';
					const data = translations[lang] ?? translations[fallbackLang];
					if (!data) return;

					const existing = translateService.getTranslations(lang);
					if (existing && Object.keys(existing).length > 0) {
						const newKeys = filterNewTranslationKeys(existing as Record<string, any>, data);
						if (newKeys) {
							translateService.setTranslation(lang, newKeys, true);
						}
					}
				};

				// If a language is already active (core translations loaded),
				// merge plugin translations immediately.
				const currentLang = translateService.getCurrentLang();
				if (currentLang) {
					mergeForLang(currentLang);
				}

				// Subscribe to future language changes — merge whenever core
				// translations are loaded for a new language.
				const langSub: Subscription = translateService.onLangChange.subscribe(({ lang }) => {
					mergeForLang(lang);
				});

				// Auto-unsubscribe when the injector is destroyed (e.g., dynamic plugin unload).
				// For statically bootstrapped plugins, DestroyRef may not be available — in that
				// case the subscription intentionally lives for the app lifetime.
				const destroyRef = injector.get(DestroyRef, null);
				if (destroyRef) {
					destroyRef.onDestroy(() => langSub.unsubscribe());
				}
			}
		}

		// Register plugin settings schema with the settings registry.
		if (plugin.settings) {
			const settingsRegistry = injector.get(PluginSettingsRegistryService, null);
			if (settingsRegistry) {
				settingsRegistry.register(id, plugin.settings);
			}
		}
	};

	return plugin;
}
