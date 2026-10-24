/**
 * The public plugin read (`GET /plugins`, `GET /plugins/:id`, no sign-in) never loads a plugin's subscriptions.
 *
 * The plugin store is shared by every tenant and the read is not scoped to one, so `?relations[]=subscriptions` gave
 * any visitor every tenant's subscription to the plugin: its tenant, organization, subscriber, status, dates and plan.
 * The subscription ids it gave out also opened the billing routes of other tenants (ever-co/ever-gauzy#11234). A
 * signed-in caller reads their own subscription from `GET /plugins/:pluginId/subscriptions/me`, and the plugin's
 * publisher every subscription from `GET /plugins/:pluginId/subscriptions/publisher` (owner decision, 2026-10-22).
 */

/** The relation that holds a plugin's subscriptions. */
const SUBSCRIPTIONS = 'subscriptions';

/** Whether a dotted relation path is the subscriptions or something under them (`subscriptions.plan`). */
function isSubscriptionPath(path: unknown): boolean {
	return typeof path === 'string' && (path.trim() === SUBSCRIPTIONS || path.trim().startsWith(`${SUBSCRIPTIONS}.`));
}

/**
 * A `relations`, `where` or `select` option without the subscriptions, in every form a query string carries it: the
 * legacy array (`relations[0]=subscriptions.plan`), a comma-separated list, or the object the query DTOs canonicalize
 * it to (`{ subscriptions: { plan: true } }`), and an array of `where` alternatives.
 *
 * @param value - The option as the request carried it.
 */
function withoutSubscriptionKey(value: unknown): unknown {
	if (typeof value === 'string') {
		return value
			.split(',')
			.filter((path) => !isSubscriptionPath(path))
			.join(',');
	}
	if (Array.isArray(value)) {
		return value
			.filter((item) => !isSubscriptionPath(item))
			.map((item) => (item && typeof item === 'object' ? withoutSubscriptionKey(item) : item));
	}
	if (value && typeof value === 'object') {
		const rest = { ...(value as Record<string, unknown>) };
		delete rest[SUBSCRIPTIONS];
		return rest;
	}
	return value;
}

/**
 * The options of a public plugin read, without the plugin's subscriptions: not loaded (`relations`), not selected
 * (`select`) and not filtered on (`where`, which would tell whether a hidden subscription matches). The rest of the
 * options is kept as it came.
 *
 * @param options - The query options of the public read.
 */
export function withoutSubscriptions<T extends object>(options: T): T {
	if (!options || typeof options !== 'object') {
		return options;
	}
	const read = options as Record<string, unknown>;
	const stripped: Record<string, unknown> = {};
	for (const key of ['relations', 'where', 'select']) {
		if (read[key] !== undefined) {
			stripped[key] = withoutSubscriptionKey(read[key]);
		}
	}
	return Object.assign(options, stripped);
}
