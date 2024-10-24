/**
 * Retrieves the value of a cookie by its name for the current domain and its subdomains.
 *
 * @param {string} name - The name of the cookie to retrieve.
 * @return {string | null} - The value of the cookie if found, or null if not found.
 */
export function getCookie(name: string): string | null {
	const value = `; ${document.cookie}`; // Get all cookies as a string and add a leading semicolon
	const parts = value.split(`; ${name}=`); // Split the string by the desired cookie name

	// If the cookie is found, split to isolate its value and return it
	if (parts.length === 2) {
		const cookie = parts.pop()?.split(';').shift() || null; // Get the cookie value

		// Check if the cookie is set for the current domain or its subdomains
		if (isCookieForValidDomain(cookie)) {
			return cookie; // Return the cookie value if it's for a valid domain
		}
	}

	// Return null if the cookie is not found
	return null;
}

/**
 * Checks if the cookie is set for the current domain, its subdomains, or localhost.
 *
 * @param {string} cookie - The value of the cookie to check.
 * @return {boolean} - True if the cookie is considered valid, otherwise false.
 */
function isCookieForValidDomain(cookie: string | null): boolean {
	// Check if the cookie is not null
	if (cookie === null) {
		return false; // Not valid if cookie does not exist
	}

	// Get the current hostname
	const hostname = window.location.hostname; // e.g., "demo.gauzy.co" or "gauzy.co"

	// Define the base domain
	const mainDomain = 'gauzy.co';

	// Check if the hostname is localhost or a subdomain of gauzy.co
	const isLocalhost = hostname === 'localhost';
	const isSubdomain = hostname.endsWith(`.${mainDomain}`) || hostname === mainDomain;

	return isLocalhost || isSubdomain; // Return true if valid, false otherwise
}
