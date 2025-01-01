/**
 * Ensures the URL has either "http://" or "https://" prefix.
 *
 * @param url - The URL to check and add the prefix if missing.
 * @param prefix - The protocol to add ("http" or "https"). Defaults to "https".
 * @returns The URL with the specified protocol prefix.
 *
 * @example
 * ```typescript
 * ensureHttpPrefix("example.com"); // Output: "https://example.com"
 * ensureHttpPrefix("example.com", "http"); // Output: "http://example.com"
 * ensureHttpPrefix("https://example.com"); // Output: "https://example.com"
 * ```
 */
export const ensureHttpPrefix = (url: string, prefix: 'http' | 'https' = 'https'): string => {
	if (!url) return url;
	return url.startsWith('http://') || url.startsWith('https://') ? url : `${prefix}://${url}`;
};
