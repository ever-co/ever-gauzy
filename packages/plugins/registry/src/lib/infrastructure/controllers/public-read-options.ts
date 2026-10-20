/**
 * What an unauthenticated registry read may ask the store for.
 *
 * The plugin and category reads are `@Public()`: they run without a caller, through services that do not scope by
 * tenant, and they used to hand the query string's `relations`, `where` and `select` to the store as they came. Any
 * visitor could load every tenant's plugin settings with their values (`settings`, `plugins.settings`), each tenant's
 * plugin configuration and its allowed and denied users (`pluginTenants.*`), and the subscribers and billings of every
 * subscription (`subscriptions.subscriber`, `subscriptions.billings`), or filter on any of them to learn whether a
 * hidden row matched. A public read now loads only the relations the marketplace shows, and filters only on the
 * entity's own columns.
 */

/** The relations a public plugin read may load: what the marketplace lists and the plugin page shows. */
export const PUBLIC_PLUGIN_RELATIONS: readonly string[] = [
	'versions',
	'versions.sources',
	'category',
	'uploadedBy',
	'subscriptions',
	'subscriptions.plan',
	'subscriptionPlans',
	'pluginTags',
	'pluginTags.tag'
];

/** The relations a public plugin category read may load. */
export const PUBLIC_PLUGIN_CATEGORY_RELATIONS: readonly string[] = ['parent', 'children', 'plugins'];

/**
 * The relations a query string asks for, as dotted paths, in every form it can carry them: the legacy array
 * (`relations[0]=a.b`), a comma-separated list, or the nested object Express builds from `relations[a][b]=true`.
 *
 * @param relations - The `relations` the query string carried.
 */
export function relationPaths(relations: unknown): string[] {
	if (!relations) return [];
	if (typeof relations === 'string') {
		return relations
			.split(',')
			.map((path) => path.trim())
			.filter(Boolean);
	}
	if (Array.isArray(relations)) {
		return relations.flatMap((relation) => relationPaths(relation));
	}
	if (typeof relations === 'object') {
		return Object.entries(relations).flatMap(([name, nested]) => [
			name,
			...(nested && typeof nested === 'object' ? relationPaths(nested).map((path) => `${name}.${path}`) : [])
		]);
	}
	return [];
}

/**
 * The relations a public read loads: those asked for that `allowed` names, each once. Anything else is left out
 * rather than refused, so a client asking for more than it may see still gets the public part.
 *
 * @param requested - The `relations` the query string carried.
 * @param allowed - The dotted relation paths the read may load.
 */
export function allowedRelations(requested: unknown, allowed: readonly string[]): string[] {
	return [...new Set(relationPaths(requested).filter((path) => allowed.includes(path)))];
}

/**
 * A public read's filter: conditions on the entity's own columns only. A condition on a relation (`where[settings]
 * [value]=…`) would tell whether a row the caller cannot see matches, one guess at a time.
 *
 * @param where - The `where` the query string carried.
 * @returns The conditions on plain values, or `undefined` when none is left.
 */
export function ownColumnFilter(where: unknown): Record<string, string | number | boolean | null> | undefined {
	if (!where || typeof where !== 'object' || Array.isArray(where)) return undefined;
	const conditions = Object.entries(where).filter(
		([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value)
	);
	return conditions.length > 0 ? Object.fromEntries(conditions) : undefined;
}
