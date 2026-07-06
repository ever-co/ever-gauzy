/**
 * ESM interop for the CommonJS-compiled API.
 *
 * The Vercel AI SDK v7 family (`ai`, `@ai-sdk/*`, provider packages) is
 * ESM-only. This package compiles to CommonJS (like the rest of the Gauzy
 * backend), so a plain `import` would be emitted as `require()`.
 *
 * On the platform's required Node.js (>= 22.12), `require(esm)` works
 * natively as long as the module graph has no top-level await — so we try
 * that first. If it fails (older Node, or a TLA module), we fall back to a
 * true dynamic `import()`, built via the Function constructor so TypeScript
 * does not rewrite it to `require()`.
 *
 * Provider plugins (`@gauzy/plugin-ai-provider-*`) reuse this helper for
 * their own ESM-only provider packages.
 */

const cache = new Map<string, Promise<unknown>>();

/**
 * Import an ESM-only module from CommonJS code.
 *
 * @param specifier Module specifier, e.g. 'ai' or '@ai-sdk/anthropic'.
 */
export function importEsm<T = unknown>(specifier: string): Promise<T> {
	let loaded = cache.get(specifier);
	if (!loaded) {
		loaded = load(specifier);
		cache.set(specifier, loaded);
	}
	return loaded as Promise<T>;
}

/** Convenience accessor for the core AI SDK. */
export function loadAiSdk(): Promise<typeof import('ai')> {
	return importEsm<typeof import('ai')>('ai');
}

async function load(specifier: string): Promise<unknown> {
	try {
		// Node >= 22.12: require(esm) — synchronous and cache-friendly.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		return require(specifier);
	} catch (error: any) {
		if (error?.code === 'ERR_REQUIRE_ESM' || error?.code === 'ERR_REQUIRE_ASYNC_MODULE') {
			// Fallback: genuine dynamic import(), hidden from the TS compiler.
			const dynamicImport = new Function('specifier', 'return import(specifier);') as (
				specifier: string
			) => Promise<unknown>;
			return dynamicImport(specifier);
		}
		throw error;
	}
}
