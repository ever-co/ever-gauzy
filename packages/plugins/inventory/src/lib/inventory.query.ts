/**
 * Reads a boolean query parameter the way this package's REST list routes mean it: only `true` is true.
 *
 * **A query parameter is a string, and a non-empty string is truthy.** The list routes declare `withDeleted`
 * on their `*QueryDTO` as a boolean with a `@Transform` that parses it, but no validation pipe runs on those
 * routes — nothing mounts one on the handlers and the application registers no global pipe — so the DTO's
 * transform never executes and the handler receives the raw value the query-string parser produced. A client
 * whose "show retired" toggle is off sends `?withDeleted=false`, the handler read the string `'false'` as a
 * truthy flag, and the page came back with every soft-deleted row and a `total` that counted them.
 *
 * Parsing here rather than relying on a pipe keeps the meaning the same whichever arrives: the raw string
 * from a route without a pipe, or the boolean a pipe would transform it into. `'true'` in any case and the
 * boolean `true` lift the soft-delete filter; `'false'`, an absent value, an empty one, a repeated parameter
 * and anything unreadable leave the read exactly as it was, which is the same rule `GET /stock-levels`
 * already applies to the same flag.
 *
 * @param value The parameter as the handler received it.
 * @returns Whether the caller asked for the flag.
 */
export function isQueryFlagSet(value: unknown): boolean {
	if (typeof value === 'boolean') {
		return value;
	}

	return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}
