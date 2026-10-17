/**
 * Parse a request's query string once per request.
 *
 * Express 5 made `req.query` a getter with no memory: every read parses the URL and runs the query parser (`qs`
 * in "extended" mode, needed for the API's `where[organizationId]=…` syntax) again. A request's query is read by
 * Nest for each `@Query()` parameter, by the guards that look for a tenant or organization id, by the Sentry
 * request middleware and by any handler that reads `request.query` — so the same string was parsed several times
 * per request. The parsed object is now kept on the request and reused while `req.url` is unchanged (a router
 * that rewrites the URL gets a fresh parse). Assigning `req.query` works as before.
 */
export function memoizeRequestQuery(expressApp: { request?: object }): boolean {
	const requestPrototype = expressApp?.request;
	if (!requestPrototype) {
		return false;
	}
	// Express defines the getter on its own request prototype, which `app.request` inherits from.
	let descriptor: PropertyDescriptor | undefined;
	for (let proto = requestPrototype; proto && !descriptor; proto = Object.getPrototypeOf(proto)) {
		descriptor = Object.getOwnPropertyDescriptor(proto, 'query');
	}
	if (!descriptor?.get || descriptor.set) {
		return false;
	}
	const parse = descriptor.get;
	const MEMO = Symbol('parsed query');
	Object.defineProperty(requestPrototype, 'query', {
		configurable: true,
		enumerable: descriptor.enumerable,
		get(this: any) {
			const memo = this[MEMO];
			if (memo && memo.url === this.url) {
				return memo.query;
			}
			const query = parse.call(this);
			Object.defineProperty(this, MEMO, { value: { url: this.url, query }, writable: true, configurable: true });
			return query;
		},
		set(this: any, value: unknown) {
			Object.defineProperty(this, MEMO, {
				value: { url: this.url, query: value },
				writable: true,
				configurable: true
			});
		}
	});
	return true;
}
