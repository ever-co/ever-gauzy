// Define allowed domains for each environment
const DOMAIN_CONFIG = {
	production: ['gauzy.co'],
	demo: ['demo.gauzy.co'],
	staging: ['staging.gauzy.co'],
	development: ['localhost', '127.0.0.1']
} as const;

/**
 * Retrieves the value of a cookie by its name for the current domain and its subdomains.
 *
 * @param {string} name - The name of the cookie to retrieve.
 * @return {string | null} - The value of the cookie if found, or null if not found.
 */
export function getCookie(name: string): string | null {
	if (!name || typeof name !== 'string') {
		return null;
	}

	// Sanitize the cookie name
	const sanitizedName = encodeURIComponent(name);
	const value = `; ${document.cookie}`; // Get all cookies as a string and add a leading semicolon
	const parts = value.split(`; ${sanitizedName}=`); // Split the string by the desired cookie name

	// If the cookie is found, split to isolate its value and return it
	if (parts.length === 2) {
		const cookie = parts.pop()?.split(';').shift() || null; // Get the cookie value

		// Validate if the cookie is set for the current domain or its subdomains
		if (isCookieForValidDomain(sanitizedName)) {
			return decodeURIComponent(cookie); // Return the cookie value if it's for a valid domain
		}
	}

	// Return null if the cookie is not found
	return null;
}

/**
 * Checks if the cookie is set for the current domain, its subdomains, or localhost.
 *
 * @param {string} cookie - The name of the cookie to check.
 * @return {boolean} - True if the cookie is considered valid, otherwise false.
 */
function isCookieForValidDomain(cookie: string | null): boolean {
	// Check if the cookie is not null
	if (cookie === null) {
		return false; // Not valid if cookie does not exist
	}

	// Get the current hostname
	const hostname = window.location.hostname; // e.g., "demo.gauzy.co" or "localhost"

	// Get environment-specific domains
	const validDomains = [
		...DOMAIN_CONFIG.production,
		...DOMAIN_CONFIG.demo,
		...DOMAIN_CONFIG.staging,
		...DOMAIN_CONFIG.development
	];

	// Check if the cookie's domain is valid
	return validDomains.some((domain) => {
		if (domain === hostname) return true;
		if (domain.startsWith('.')) return hostname.endsWith(domain);
		return hostname.endsWith(`.${domain}`) || hostname === domain;
	});
}
