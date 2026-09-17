/**
 * Which platform events a client may subscribe to.
 *
 * Subscriptions are not a mirror of the event catalogue. An event is offered as a stream only when a
 * client genuinely has to react to it within seconds, when the payload is useful without a second
 * read, and when the event does not fire at a rate that makes a stream the wrong medium. Everything
 * else stays available through the read APIs and through webhooks.
 *
 * The catalogue itself is declared by the packages that own the events: a domain declares the events
 * it publishes at bootstrap, and the subscription consumer registers for exactly those names. That
 * keeps one list of event names in the platform — the one the producers write.
 */

/**
 * Events the platform deliberately does not stream.
 *
 * Both are high-volume, reorderable facts: a stream that fires on every cart keystroke or every price
 * write is a load generator rather than an integration. They remain available through the read APIs
 * and through webhooks.
 */
export const NON_SUBSCRIBABLE_EVENT_NAMES: readonly string[] = ['commerce_cart.updated', 'price.updated'];

/**
 * The shape of an event name: `<aggregate>.<action>`, lower case, dot separated.
 *
 * The leading segment is the aggregate that owns the change, written in snake_case when it is more
 * than one word; the trailing segments are kebab-case actions. The pattern is asserted rather than
 * assumed because the event name is a wire contract: a name that does not fit it cannot be selected
 * by a prefix pattern, and a subscriber would never receive it.
 */
export const SUBSCRIPTION_EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_-]*)+$/;

/**
 * Whether a string is shaped like an event name.
 *
 * @param name The candidate.
 * @returns True when it is a well-formed event name.
 */
export function isEventNameShaped(name: string): boolean {
	return typeof name === 'string' && SUBSCRIPTION_EVENT_NAME_PATTERN.test(name);
}

/**
 * Whether a selection is a prefix pattern rather than an exact name.
 *
 * @param selection The selection.
 * @returns True for `*` or `<segment>.*`.
 */
export function isPrefixSelection(selection: string): boolean {
	return selection === '*' || selection.endsWith('.*');
}

/**
 * Whether an event name matches one selection.
 *
 * `order.*` matches any event whose name has **exactly one** more segment after `order.`, so it
 * selects `order.placed` and not `order.quote.sent`. The rule is deliberate: a pattern that reached
 * arbitrarily deep would make `order.*` mean "everything the order domain will ever emit", and a
 * client could not reason about the volume it was signing up for.
 *
 * @param selection An exact event name, or a prefix pattern.
 * @param eventName The event name to test.
 * @returns True when the selection covers the event.
 */
export function matchesEventSelection(selection: string, eventName: string): boolean {
	if (!selection || !eventName) {
		return false;
	}

	if (selection === '*') {
		return true;
	}

	if (!selection.endsWith('.*')) {
		return selection === eventName;
	}

	const prefix = selection.slice(0, -1);
	if (!eventName.startsWith(prefix)) {
		return false;
	}

	return !eventName.slice(prefix.length).includes('.');
}

/**
 * Raised when a name cannot be declared or selected.
 */
export class SubscriptionCatalogueError extends Error {
	readonly code = 'SUBSCRIPTION_UNKNOWN_EVENT';

	constructor(message: string) {
		super(message);
		this.name = 'SubscriptionCatalogueError';
	}
}

/**
 * The events this installation streams.
 */
export class SubscriptionCatalogue {
	private readonly events = new Set<string>();

	/**
	 * Declares the events a package publishes.
	 *
	 * @param names The event names.
	 * @throws SubscriptionCatalogueError when a name is malformed or is deliberately not streamed.
	 */
	declare(...names: readonly string[]): void {
		for (const name of names) {
			if (!isEventNameShaped(name)) {
				throw new SubscriptionCatalogueError(
					`"${name}" is not a valid event name. An event name is "<aggregate>.<action>" in lower case, ` +
						'for example "order.placed".'
				);
			}

			if (NON_SUBSCRIBABLE_EVENT_NAMES.includes(name)) {
				throw new SubscriptionCatalogueError(
					`"${name}" is not offered as a subscription: it fires at a rate that makes a stream the wrong ` +
						'medium. It remains available through the read API and through webhooks.'
				);
			}

			this.events.add(name);
		}
	}

	/**
	 * Every streamed event name.
	 */
	names(): readonly string[] {
		return Array.from(this.events).sort();
	}

	/**
	 * How many events are streamed.
	 */
	get size(): number {
		return this.events.size;
	}

	/**
	 * Whether an event is streamed.
	 *
	 * @param name The event name.
	 * @returns True when it is in the catalogue.
	 */
	has(name: string): boolean {
		return this.events.has(name);
	}

	/**
	 * Turns a client's selection into the concrete event names it covers.
	 *
	 * A selection that matches nothing is refused rather than accepted and left silent: a typo that
	 * produces a quiet connection is indistinguishable from a system where nothing is happening.
	 *
	 * @param selections Exact names or prefix patterns.
	 * @returns The matching catalogue names, deduplicated and ordered.
	 */
	resolve(selections: readonly string[]): readonly string[] {
		const matched = new Set<string>();

		for (const selection of selections) {
			for (const name of this.events) {
				if (matchesEventSelection(selection, name)) {
					matched.add(name);
				}
			}
		}

		return Array.from(matched).sort();
	}
}
