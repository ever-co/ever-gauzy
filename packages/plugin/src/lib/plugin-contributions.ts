/**
 * Contribution contracts a plugin declares through the `@GauzyCorePlugin` decorator.
 *
 * Every contribution is additive: the platform unions what plugins declare with the values it
 * already ships, so a plugin never edits a platform enum to register itself, and an installation
 * that does not load the plugin is never aware of it.
 */

/**
 * A setting a plugin reads at runtime.
 *
 * The declaration is metadata only. Resolution always goes through the platform settings store, so
 * an operator can override any declared default per tenant, per organization or per channel without
 * a code change.
 */
export interface PluginSettingContribution {
	/**
	 * Setting key, dot separated and namespaced by concern rather than by the plugin that reads it,
	 * e.g. `stock.reservationTtlMinutes`.
	 */
	readonly key: string;

	/**
	 * Value kind. Decides how the stored string is decoded and what the operator may enter.
	 */
	readonly type: 'string' | 'number' | 'boolean' | 'json' | 'string[]';

	/**
	 * Value used when neither the tenant, the organization nor the channel has stored one.
	 */
	readonly default?: unknown;

	/**
	 * One-line explanation shown wherever the setting is documented or administered.
	 */
	readonly description?: string;

	/**
	 * Scope the value is resolved at. `TENANT` is the widest and the fallback for the narrower
	 * scopes.
	 */
	readonly scope?: 'TENANT' | 'ORGANIZATION' | 'CHANNEL';

	/**
	 * When true the stored value is never returned to a caller and is masked in exports.
	 */
	readonly secret?: boolean;
}

/**
 * A permission value a plugin grants through the platform role model.
 *
 * The value is unioned into the platform permission catalogue at bootstrap, so a role can be granted
 * it exactly like a built-in permission. The naming convention matches the existing catalogue:
 * resource, underscore, action, both upper case — for example `ORDERS_VIEW`.
 */
export interface PluginPermissionContribution {
	/**
	 * Permission value. Must be upper snake case and must not collide with a built-in value.
	 */
	readonly value: string;

	/**
	 * Human readable label used in the permission catalogue.
	 */
	readonly label: string;

	/**
	 * Catalogue group the permission is listed under.
	 */
	readonly group?: 'GENERAL' | 'ADMINISTRATION';

	/**
	 * One-line explanation of what the permission grants.
	 */
	readonly description?: string;

	/**
	 * Roles that receive the permission when a tenant is provisioned from scratch. Existing tenants
	 * are handled by the permission reload, which only ever inserts missing rows.
	 */
	readonly defaultFor?: string[];
}

/**
 * A feature flag a plugin contributes.
 *
 * A contributed feature is registered in the platform feature catalogue and starts disabled for
 * every existing tenant; it is enabled per tenant through the feature toggle rows exactly like a
 * built-in feature.
 */
export interface PluginFeatureContribution {
	/**
	 * Feature code, upper snake case and prefixed with `FEATURE_`, e.g. `FEATURE_ORDERS`.
	 */
	readonly code: string;

	/**
	 * Human readable name.
	 */
	readonly name: string;

	/**
	 * One-line explanation of what the feature enables.
	 */
	readonly description?: string;

	/**
	 * Icon name used wherever features are listed. Presentation only.
	 */
	readonly icon?: string;

	/**
	 * Link opened when a user selects the feature in a listing. Presentation only.
	 */
	readonly link?: string;

	/**
	 * Whether the feature is enabled for a tenant provisioned from scratch. A contributed feature
	 * defaults to `false` so that loading a plugin never changes an existing installation's
	 * behaviour.
	 */
	readonly defaultEnabled?: boolean;

	/**
	 * Feature codes this one depends on. Declaring a dependency does not enable it; it lets the
	 * platform refuse an inconsistent state instead of failing later.
	 */
	readonly dependsOn?: string[];
}

/**
 * A migration a plugin owns.
 *
 * A plugin ships the migrations for the tables it owns. The platform merges every declared class
 * into the connection's migration list before the connection is created, so ordering is decided by
 * the migration's own timestamp and never by the order plugins happen to be listed in.
 */
export interface PluginMigrationContribution {
	/**
	 * Migration class. The class carries the numeric timestamp that orders it against every other
	 * migration in the installation.
	 */
	readonly migration: any;

	/**
	 * Owning package name, used in diagnostics when two migrations claim the same timestamp.
	 */
	readonly owner?: string;
}

/**
 * Everything a plugin may contribute beyond its entities, subscribers and resolvers.
 */
export interface PluginContributions {
	readonly migrations?: PluginMigrationContribution[];
	readonly permissions?: PluginPermissionContribution[];
	readonly features?: PluginFeatureContribution[];
	readonly settings?: PluginSettingContribution[];
}

/**
 * A resolved migration, carrying the timestamp the platform ordered it by.
 */
export interface RegisteredMigration {
	readonly migration: any;
	readonly timestamp: number;
	readonly name: string;
	readonly owner: string;
}

/**
 * Extracts the numeric timestamp a migration class carries.
 *
 * The platform numbers migrations by prefixing the class name with the creation time, so the
 * timestamp is recovered from the class name and cross-checked against the `name` property the
 * class declares.
 *
 * @param migration The migration class or instance to inspect.
 * @returns The timestamp, or `null` when the class does not follow the convention.
 */
export function readMigrationTimestamp(migration: any): number | null {
	if (!migration) {
		return null;
	}

	const candidates: string[] = [];

	if (typeof migration === 'function' && typeof migration.name === 'string') {
		candidates.push(migration.name);
	}

	const declaredName = (migration as any)?.name;
	if (typeof declaredName === 'string') {
		candidates.push(declaredName);
	}

	for (const candidate of candidates) {
		const match = /(\d{10,})/.exec(candidate);
		if (match) {
			return Number(match[1]);
		}
	}

	return null;
}
