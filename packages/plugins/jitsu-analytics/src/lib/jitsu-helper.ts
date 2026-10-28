import { environment } from '@gauzy/config';
import { AnalyticsInterface, JitsuOptions, jitsuAnalytics } from '@jitsu/js';
import fetch from 'node-fetch';
import { JitsuModuleOptions } from './jitsu.types';
import { readCountEnv } from './jitsu-event-queue';

/**
 * Parses the options for Jitsu Analytics.
 * @param options The input options object.
 * @returns A record containing parsed Jitsu module options.
 */
/** Whether the server-wide Jitsu destination (JITSU_SERVER_URL + JITSU_SERVER_WRITE_KEY) is configured. */
export const isJitsuServerConfigured = (): boolean => !!(environment.jitsu?.serverHost && environment.jitsu?.serverWriteKey);

export const parseOptions = (options: JitsuModuleOptions): JitsuModuleOptions => ({
	// If the 'isGlobal' property is defined in the input options, use its value; otherwise, default to true.
	isGlobal: options.isGlobal ?? true,

	// Parse the configuration using the 'parseConfig' function and assign the result to the 'config' property.
	config: parseConfig(options.config) //
});

/**
 * Parse the configuration for Jitsu Analytics.
 * @param config The input configuration object.
 * @returns A record containing Jitsu configuration properties.
 */
export const parseConfig = (config: JitsuOptions): Record<string, any> => ({
	host: config.host || environment.jitsu.serverHost || '', // Use serverHost from environment or empty string as default
	writeKey: config.writeKey || environment.jitsu.serverWriteKey || '', // Use serverWriteKey from environment or empty string as default
	debug: config.debug || false, // Use debug from input config or false as default
	echoEvents: config.echoEvents || false // Use echoEvents from input config or false as default
});

/**
 * Create a Jitsu Analytics instance.
 * @param opts The JitsuOptions object for configuration.
 * @returns An instance of Jitsu Analytics.
 */
/**
 * How many events one Jitsu client instance sends before it is replaced by a fresh one.
 *
 * `@jitsu/js` runs on the `analytics` core, whose `track` (and `page`) reducer keeps EVERY event it ever saw:
 * it deep-copies the event (JSON.stringify + JSON.parse) and stores `history.concat(event)` in its state. In a
 * browser tab that history dies with the page; in the API it lived as long as the process, and the global
 * entity subscriber tracks every insert, update and delete of every entity. The heap therefore grew with every
 * write since the pod started, every write copied the whole history array (O(n) per write, O(n²) in total),
 * and the growing heap meant ever longer garbage-collection pauses — which stop every request — until the
 * container's memory limit killed the pod. A fresh instance every `JITSU_CLIENT_RECYCLE_EVENTS` events (default
 * 500) bounds both; the anonymous id is carried over, so the events stay attributed as before. 0 disables it.
 */
export const DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS = 500;

export function jitsuClientRecycleEvents(env: NodeJS.ProcessEnv = process.env): number {
	return readCountEnv('JITSU_CLIENT_RECYCLE_EVENTS', DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS, env);
}

/** The calls that add to the analytics core's state. */
const STATEFUL_CALLS = new Set(['track', 'page', 'identify', 'group']);

/**
 * Wrap a Jitsu client factory so that the client behind the returned interface is replaced after `every`
 * stateful calls. Every other property is read from the current client.
 */
export function recyclingJitsu(factory: () => AnalyticsInterface, every: number): AnalyticsInterface {
	let current = factory();
	if (!current || !every) {
		return current;
	}
	let calls = 0;

	const renew = () => {
		const previous = current;
		const next = factory();
		if (!next) return;
		try {
			const anonymousId = (previous as any)?.user?.()?.anonymousId;
			if (anonymousId && typeof (next as any).setAnonymousId === 'function') {
				(next as any).setAnonymousId(anonymousId);
			}
		} catch {
			// The anonymous id is a convenience; a new one is acceptable.
		}
		current = next;
	};

	return new Proxy({} as AnalyticsInterface, {
		get(_target, property) {
			const value = (current as any)[property];
			if (typeof value !== 'function') {
				return value;
			}
			if (typeof property === 'string' && STATEFUL_CALLS.has(property)) {
				return (...args: unknown[]) => {
					const client = current;
					if (++calls >= every) {
						calls = 0;
						renew();
					}
					return (client as any)[property](...args);
				};
			}
			return value.bind(current);
		}
	});
}

export const createJitsu = (opts: JitsuOptions): AnalyticsInterface => {
	// Parse the configuration options
	const config = parseConfig(opts);

	if (!config.host || !config.writeKey) {
		return;
	}

	config.fetch = fetch; // Assign the 'fetch' function to 'fetch'

	// Create and return a Jitsu Analytics instance with the parsed configuration properties, replaced after a
	// bounded number of events (see DEFAULT_JITSU_CLIENT_RECYCLE_EVENTS).
	return recyclingJitsu(() => jitsuAnalytics({ ...config }), jitsuClientRecycleEvents());
};
