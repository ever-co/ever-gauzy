/**
 * Builds a query parameters string from an object of query parameters.
 *
 * @param queryParams - An object containing query parameters.
 * @returns A string representation of the query parameters.
 *
 * @example
 * ```typescript
 * const params = {
 *   search: "query",
 *   page: "1",
 *   sort: ["name", "date"],
 *   active: true,
 * };
 *
 * const queryString = buildQueryString(params);
 * // Output: "search=query&page=1&sort=name&sort=date&active=true"
 * ```
 */
export function buildQueryString(queryParams: { [key: string]: string | string[] | boolean }): string {
	return Object.entries(queryParams)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				// Handle array values by joining them with '&'
				return value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
			} else if (typeof value === 'boolean') {
				// Convert boolean to string explicitly (true/false)
				return `${encodeURIComponent(key)}=${value}`;
			} else {
				// Handle string or other types
				return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
			}
		})
		.join('&');
}
