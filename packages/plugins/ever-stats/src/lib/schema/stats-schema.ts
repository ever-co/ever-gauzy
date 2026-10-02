import * as VENDORED_SCHEMA from './ever.stats.v1.schema.json';

/**
 * The vendored `ever.stats.v1` schema as an object. A bundler may wrap a JSON import in a module
 * object with a `default` member; plain CommonJS returns the document itself.
 */
export const STATS_SCHEMA: { readonly [key: string]: unknown } = Object.freeze(
	((VENDORED_SCHEMA as unknown as { default?: unknown }).default ?? VENDORED_SCHEMA) as { readonly [key: string]: unknown }
);
