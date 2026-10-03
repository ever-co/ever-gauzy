/**
 * Lazy access to `jose`.
 *
 * `jose` ships as an ES module only. Loading it at the top of a module would make every process that
 * imports `@gauzy/auth` load it at boot, whether or not any provider plugin is enabled. Loading it on
 * first use keeps it out of processes that never verify a token, so an install without an OpenID
 * Connect provider loads nothing new. Node.js 22.12 and later can `require()` an ES module, which is
 * what the compiled `import()` below turns into.
 */
type JoseModule = typeof import('jose');

let joseModule: Promise<JoseModule> | null = null;

/**
 * Returns the `jose` module, loading it once.
 *
 * @returns The module namespace.
 */
export function loadJose(): Promise<JoseModule> {
	if (!joseModule) {
		joseModule = import('jose').catch((error: unknown) => {
			// Do not cache a failed load: the next call tries again.
			joseModule = null;
			throw error;
		});
	}
	return joseModule;
}
