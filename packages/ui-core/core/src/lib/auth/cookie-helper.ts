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
		if (isCookieForValidDomain(cookie)) {
			return decodeURIComponent(cookie); // Return the cookie value if it's for a valid domain
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
	const hostname = window.location.hostname; // e.g., "demo.gauzy.co" or "app.gauzy.co"

	// Check for development environments
	if (DOMAIN_CONFIG.development.includes(hostname as 'localhost' | '127.0.0.1')) {
		return true; // Allow cookies for localhost and 127.0.0.1
	}

	// Get environment-specific domains
	const validDomains = [...DOMAIN_CONFIG.production, ...DOMAIN_CONFIG.demo, ...DOMAIN_CONFIG.staging];

	// More robust domain validation
	return validDomains.some((domain: string) => {
		// Convert hostname and domain to lowercase for case-insensitive comparison
		const normalizedHostname = hostname.toLowerCase();
		const normalizedDomain = domain.toLowerCase();

		// Check for exact match
		if (normalizedHostname === normalizedDomain) {
			return true;
		}

		// Check if the hostname ends with the domain and ensure proper boundaries
		if (normalizedHostname.endsWith(`.${normalizedDomain}`)) {
			// Ensure there are no additional dots to prevent attacks
			const subdomain = normalizedHostname.slice(0, -normalizedDomain.length - 1);
			return !subdomain.includes('.');
		}

		// Prevent direct domain spoofing by checking if it matches the exact domain
		if (normalizedHostname === `www.${normalizedDomain}`) {
			return true;
		}

		return false; // Invalid if none of the checks pass
	});
}

/**
 * Sets a cookie with the specified name, value, and options.
 *
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {Object} options - Additional options for the cookie.
 */
export function setCookie(name: string, value: string, options: { [key: string]: any } = {}) {
	if (!name || typeof value === 'undefined') {
		return; // Ensure valid inputs
	}

	// Prepare cookie options with defaults
	const cookieOptions = {
		path: '/',
		SameSite: 'Lax',
		Secure: window.location.protocol === 'https:',
		...options
	};

	// Remove domain option for localhost or 127.0.0.1
	const hostname = window.location.hostname;
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		delete cookieOptions['domain'];
	} else {
		cookieOptions['domain'] = cookieOptions['domain'] || '.gauzy.co';
	}

	// Build the cookie string
	const cookieString =
		`${encodeURIComponent(name)}=${encodeURIComponent(value)}; ` +
		Object.entries(cookieOptions)
			.map(([key, val]) => `${key}=${val}`)
			.join('; ');

	// Set the cookie
	document.cookie = cookieString;
}

/**
 * Deletes a cookie by setting its expiration date to a time in the past.
 *
 * @param {string} name - The name of the cookie to delete.
 * @param {Object} options - Additional options for the cookie.
 */
export function deleteCookie(name: string, options: { [key: string]: any } = {}) {
	if (!name) {
		return; // Invalid name, exit function
	}

	// Prepare cookie options with defaults
	const cookieOptions = {
		path: '/',
		SameSite: 'Lax',
		Secure: window.location.protocol === 'https:',
		...options
	};

	// Remove domain option for localhost or 127.0.0.1
	const hostname = window.location.hostname;
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		delete cookieOptions['domain'];
	} else {
		cookieOptions['domain'] = cookieOptions['domain'] || '.gauzy.co';
	}

	// Build the cookie string for deletion
	const cookieString =
		`${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ` +
		Object.entries(cookieOptions)
			.map(([key, val]) => `${key}=${val}`)
			.join('; ');

	// Set the cookie to delete it
	document.cookie = cookieString;
}
