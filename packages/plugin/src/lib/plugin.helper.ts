import { DynamicModule, Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { getConfig } from '@gauzy/config';
import { isNotEmpty } from '@gauzy/utils';
import { PLUGIN_METADATA } from './plugin-metadata';
import { PluginLifecycleMethods } from './plugin.interface';
import {
	PluginFeatureContribution,
	PluginPermissionContribution,
	PluginSettingContribution,
	RegisteredMigration,
	readMigrationTimestamp
} from './plugin-contributions';

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
 * Get the GraphQL resolver classes a set of plugins contributes.
 *
 * A plugin declares its resolvers alongside its schema extension. Both halves are needed for the
 * contribution to be usable: the schema fragment declares the fields, and the resolver supplies
 * their behaviour and the guards that protect them.
 *
 * @param plugins An array of plugins that may declare resolvers.
 * @returns Every declared resolver class, in plugin order.
 */
export function getResolversFromPlugins(plugins: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return getPluginExtensions(plugins).flatMap((extension: any) => {
		const declared = extension?.resolvers;
		if (!declared) {
			return [];
		}

		const resolved = typeof declared === 'function' ? declared() : declared;
		return Array.isArray(resolved) ? resolved : [];
	});
}

/**
 * Get the GraphQL scalar classes a set of plugins contributes.
 *
 * @param plugins An array of plugins that may declare scalars.
 * @returns A map of scalar name to scalar definition.
 */
export function getScalarsFromPlugins(plugins: Array<Type<any> | DynamicModule>): Record<string, any> {
	return getPluginExtensions(plugins).reduce((scalars: Record<string, any>, extension: any) => {
		const declared = extension?.scalars;
		if (!declared) {
			return scalars;
		}

		const resolved = typeof declared === 'function' ? declared() : declared;
		return { ...scalars, ...(resolved ?? {}) };
	}, {});
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
 * Resolves a metadata value that may be declared either as a literal array or as a function
 * returning one.
 *
 * Plugin metadata is evaluated when the module is imported, so a plugin whose contributions depend
 * on other imports declares them as a thunk. Both forms are accepted everywhere.
 *
 * @param value The declared metadata value.
 * @returns The resolved array.
 */
function resolveContribution<T>(value: Array<T> | (() => Array<T>) | undefined): Array<T> {
	if (!value) {
		return [];
	}

	if (typeof value === 'function') {
		const resolved = (value as () => Array<T>)();
		return Array.isArray(resolved) ? resolved : [];
	}

	return Array.isArray(value) ? value : [];
}

/**
 * Collects a declared contribution list from every plugin.
 *
 * @param plugins The plugin list.
 * @param metadataKey One of the contribution metadata keys.
 * @returns Every declared contribution, in plugin order.
 */
function getContributionsFromPlugins<T>(plugins: Array<Type<any> | DynamicModule>, metadataKey: string): Array<T> {
	if (!plugins) {
		return [];
	}

	return plugins.flatMap((plugin: Type<any> | DynamicModule) => {
		const declared = reflectMetadata(plugin, metadataKey) as Array<T> | (() => Array<T>) | undefined;
		return resolveContribution<T>(declared);
	});
}

/**
 * Get the migrations owned by a set of plugins.
 *
 * @param plugins An array of plugins containing migration metadata.
 * @returns Every declared migration class.
 */
export function getMigrationsFromPlugins(plugins?: Array<Type<any> | DynamicModule>): Array<Type<any>> {
	return getContributionsFromPlugins<Type<any>>(plugins ?? [], PLUGIN_METADATA.MIGRATIONS);
}

/**
 * Get the permissions contributed by a set of plugins.
 *
 * @param plugins An array of plugins containing permission metadata.
 * @returns Every declared permission contribution.
 */
export function getPermissionsFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginPermissionContribution> {
	return getContributionsFromPlugins<PluginPermissionContribution>(plugins ?? [], PLUGIN_METADATA.PERMISSIONS);
}

/**
 * Get the feature flags contributed by a set of plugins.
 *
 * @param plugins An array of plugins containing feature metadata.
 * @returns Every declared feature contribution.
 */
export function getFeaturesFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginFeatureContribution> {
	return getContributionsFromPlugins<PluginFeatureContribution>(plugins ?? [], PLUGIN_METADATA.FEATURES);
}

/**
 * Get the settings declared by a set of plugins.
 *
 * @param plugins An array of plugins containing setting metadata.
 * @returns Every declared setting contribution.
 */
export function getSettingsFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginSettingContribution> {
	return getContributionsFromPlugins<PluginSettingContribution>(plugins ?? [], PLUGIN_METADATA.SETTINGS);
}

/**
 * A resource query schema a plugin declares.
 *
 * Typed structurally rather than by importing the core declaration: a plugin package depends on the
 * core package and never the reverse, so the shape a plugin contributes is described here and the
 * consumer checks it before use. Nothing in this contract is optional beyond the allow-lists,
 * because a declaration without a resource name cannot be collected at all.
 */
export interface PluginApiQuerySchemaContribution {
	/** The concept root word: `role`, never a storage-qualified name. */
	readonly resource: string;

	/** Fields a caller may filter on. A dotted entry is a one-level relation path. */
	readonly filterable?: readonly string[];

	/** Fields a caller may sort by. */
	readonly sortable?: readonly string[];

	/** Paths a caller may ask for in a sparse fieldset. */
	readonly selectable?: readonly string[];

	/** Relations a caller may expand, as dotted paths. */
	readonly expandable?: readonly string[];

	/** Fields the free-text parameter searches. */
	readonly searchable?: readonly string[];

	/** The sort applied when a caller asks for none. */
	readonly defaultSort?: readonly string[];

	/** The kind of each filterable field, which decides the operators it accepts. */
	readonly kinds?: Readonly<Record<string, string>>;

	/** The page size used when a caller asks for none. */
	readonly defaultPageSize?: number;

	/** The largest page a caller may ask for. */
	readonly maxPageSize?: number;
}

/**
 * Get the resource query schemas a set of plugins contributes.
 *
 * @param plugins An array of plugins that may declare query schemas.
 * @returns Every declared schema, in plugin order.
 */
export function getApiQuerySchemasFromPlugins(
	plugins?: Array<Type<any> | DynamicModule>
): Array<PluginApiQuerySchemaContribution> {
	return getContributionsFromPlugins<PluginApiQuerySchemaContribution>(
		plugins ?? [],
		PLUGIN_METADATA.API_QUERY_SCHEMAS
	);
}

/**
 * Get the prerequisites a given plugin declares.
 *
 * An entry is either the prerequisite's class or its package name; the loader resolves both, and
 * the return type says so, so a caller does not have to cast a declaration that is perfectly valid.
 *
 * @param plugin The plugin to inspect.
 * @returns The declared prerequisites, as written.
 */
export function getPluginDependencies(plugin: Type<any> | DynamicModule): Array<Type<any> | string> {
	const declared = reflectMetadata(plugin, PLUGIN_METADATA.DEPENDS_ON) as
		| Array<Type<any> | string>
		| (() => Array<Type<any> | string>)
		| undefined;

	return resolveContribution<Type<any> | string>(declared);
}

/**
 * The spellings a configured plugin can be named by.
 *
 * A prerequisite is normally declared as the plugin's class, which is the form the compiler checks.
 * It may also be declared as the package name, and that form is not a mistake: it lets a plugin say
 * what it must be loaded after without taking a build-time dependency on that package, which is the
 * only way to express a prerequisite on something that is not independently importable. Both
 * spellings therefore have to resolve to the same configured plugin.
 *
 * @param plugin A configured plugin.
 * @returns The names it answers to.
 */
function pluginNamesOf(plugin: Type<any> | DynamicModule): string[] {
	const identity = isDynamicModule(plugin) ? plugin.module : plugin;
	const className = identity?.name ?? '';
	const names: string[] = [];

	if (className) {
		names.push(className);

		// The package convention is `@gauzy/plugin-<kebab>` for the class `<Pascal>Plugin`, so the
		// package name a plugin answers to is derived from its class rather than looked up.
		const stem = className.replace(/Plugin$/, '');
		if (stem) {
			const kebab = stem.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
			names.push(`@gauzy/plugin-${kebab}`);
			// The bare stem as well, because a dependency is written the way an author says it out
			// loud: "promotion needs pricing" declares `dependsOn: ['pricing']` while the package is
			// `@gauzy/plugin-pricing`. Both are the same plugin, and a declaration that resolves only
			// under one spelling turns a correct declaration into a boot failure.
			names.push(kebab);
		}
	}

	return names;
}

/**
 * Orders a plugin list so that every declared prerequisite is loaded before the plugin that
 * requires it.
 *
 * The sort is stable: plugins that declare no dependency keep their configured order, so enabling a
 * dependency never reshuffles unrelated plugins.
 *
 * @param plugins The configured plugin list.
 * @returns The same plugins in dependency order.
 * @throws When a dependency is missing, or when the declared dependencies contain a cycle.
 */
export function resolvePluginLoadOrder(plugins: Array<Type<any> | DynamicModule>): Array<Type<any> | DynamicModule> {
	if (!plugins || plugins.length === 0) {
		return [];
	}

	const identityOf = (plugin: Type<any> | DynamicModule): Type<any> =>
		isDynamicModule(plugin) ? plugin.module : plugin;

	// A prerequisite may be named by class or by package name, so the configured plugins are indexed
	// under every spelling they answer to. What is looked up is the plugin's IDENTITY, and what is
	// visited and emitted is the entry as it was configured — so a dynamic module is still loaded,
	// and still emitted, as itself.
	const originalOf = new Map<Type<any>, Type<any> | DynamicModule>();
	const configured = new Map<Type<any> | string, Type<any>>();
	for (const plugin of plugins) {
		const identity = identityOf(plugin);
		originalOf.set(identity, plugin);
		// The class itself is an answer, not only its names. `dependsOn` accepts either — a plugin
		// that imports its prerequisite writes the class, one that must not import it writes the
		// package name — and indexing only the names makes the first spelling unresolvable: the
		// declaration is legal, the plugin list is complete, and the boot is refused with a message
		// naming a prerequisite that is right there in the list.
		if (!configured.has(identity)) {
			configured.set(identity, identity);
		}
		for (const name of pluginNamesOf(plugin)) {
			if (!configured.has(name)) {
				configured.set(name, identity);
			}
		}
	}

	const ordered: Array<Type<any> | DynamicModule> = [];
	const visiting = new Set<Type<any>>();
	const visited = new Set<Type<any>>();

	const visit = (plugin: Type<any> | DynamicModule, path: string[]): void => {
		const identity = identityOf(plugin);

		if (visited.has(identity)) {
			return;
		}

		if (visiting.has(identity)) {
			throw new Error(
				`Plugin dependency cycle detected: ${[...path, identity.name].join(' -> ')}. ` +
					'A plugin load order cannot be resolved while the declared dependencies form a cycle.'
			);
		}

		visiting.add(identity);

		// An entry may be a prerequisite's class or its package name; both are resolved below.
		for (const dependency of getPluginDependencies(plugin)) {
			const resolved = configured.get(dependency);

			if (!resolved) {
				// Name the dependency as it was written. A string has no `name`, so the previous
				// message reported that the plugin required "an unnamed plugin" and gave an operator
				// nothing to search for.
				const named =
					typeof dependency === 'string' ? `"${dependency}"` : dependency?.name ?? 'an unnamed plugin';
				throw new Error(
					`Plugin ${identity.name} requires ${named}, ` + 'which is not present in the configured plugin list.'
				);
			}

			visit(originalOf.get(resolved) ?? resolved, [...path, identity.name]);
		}

		visiting.delete(identity);
		visited.add(identity);
		ordered.push(plugin);
	};

	for (const plugin of plugins) {
		visit(plugin, []);
	}

	return ordered;
}

/**
 * Validates the migrations declared across a plugin list.
 *
 * Two migrations sharing a timestamp would make the applied order depend on the file system, so the
 * installation is refused instead. A migration whose class name carries no timestamp cannot be
 * ordered at all and is refused for the same reason.
 *
 * @param migrations The declared migration classes.
 * @param ownerOf Resolves the package name that declared a migration, for diagnostics.
 * @returns The migrations with their resolved timestamps, in ascending order.
 * @throws When a timestamp is missing or duplicated.
 */
export function orderPluginMigrations(
	migrations: Array<Type<any>>,
	ownerOf: (migration: Type<any>) => string = () => 'unknown'
): Array<RegisteredMigration> {
	const seen = new Map<number, RegisteredMigration>();
	const ordered: Array<RegisteredMigration> = [];

	for (const migration of migrations) {
		const timestamp = readMigrationTimestamp(migration);

		if (timestamp === null) {
			throw new Error(
				`Migration ${migration?.name ?? 'unknown'} does not carry a timestamp in its class name. ` +
					'Plugin migrations must follow the <Name><timestamp> convention so they can be ordered.'
			);
		}

		const existing = seen.get(timestamp);
		if (existing) {
			throw new Error(
				`Two migrations claim the same timestamp ${timestamp}: ` +
					`${existing.name} (${existing.owner}) and ${migration?.name ?? 'unknown'} (${ownerOf(migration)}).`
			);
		}

		const entry: RegisteredMigration = {
			migration,
			timestamp,
			name: migration?.name ?? String(timestamp),
			owner: ownerOf(migration)
		};

		seen.set(timestamp, entry);
		ordered.push(entry);
	}

	return ordered.sort((left, right) => left.timestamp - right.timestamp);
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
