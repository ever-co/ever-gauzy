import { environment } from '../environments/environment';
import { randomBytes, createHash } from 'node:crypto';

/**
 * Generate a cryptographically secure nonce for CSP
 */
export function generateCSPNonce(): string {
	return randomBytes(16).toString('base64');
}

/**
 * Get Content Security Policy header with nonces
 * @param scriptNonce - Nonce for script-src directive
 * @param styleNonce - Nonce for style-src directive
 */
function getCSPHeader(scriptNonce?: string, styleNonce?: string): string {
	const csp = [
		"default-src 'self'",
		`script-src 'self'${scriptNonce ? ` 'nonce-${scriptNonce}'` : ''}`, // Use nonce instead of unsafe-inline
		`style-src 'self'${styleNonce ? ` 'nonce-${styleNonce}'` : ''}`, // Use nonce instead of unsafe-inline
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"connect-src 'self' https:",
		"media-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	];

	return csp.join('; ');
}

/**
 * Get security headers for HTTP responses
 * @param options - Options for customizing security headers
 */
export function getSecurityHeaders(options?: { scriptNonce?: string; styleNonce?: string }): Record<string, string> {
	return {
		// Prevent MIME type sniffing
		'X-Content-Type-Options': 'nosniff',

		// Enable XSS protection
		'X-XSS-Protection': '1; mode=block',

		// Control framing
		'X-Frame-Options': 'DENY',

		// Referrer policy
		'Referrer-Policy': 'strict-origin-when-cross-origin',

		// Content Security Policy with nonces
		'Content-Security-Policy': getCSPHeader(options?.scriptNonce, options?.styleNonce),

		// Strict Transport Security (HTTPS only)
		...(environment.production
			? {
					'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
			  }
			: {}),

		// Permissions policy
		'Permissions-Policy':
			'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=(), ambient-light-sensor=(), accelerometer=(), autoplay=()'
	};
}

/**
 * Generate CSP header with specific script and style hashes
 * @param scriptHashes - Array of SHA-256 hashes for inline scripts
 * @param styleHashes - Array of SHA-256 hashes for inline styles
 */
export function getCSPHeaderWithHashes(scriptHashes?: string[], styleHashes?: string[]): string {
	const scriptSources = ["'self'"];
	const styleSources = ["'self'"];

	// Add script hashes if provided
	if (scriptHashes && scriptHashes.length > 0) {
		scriptSources.push(...scriptHashes.map((hash) => `'sha256-${hash}'`));
	}

	// Add style hashes if provided
	if (styleHashes && styleHashes.length > 0) {
		styleSources.push(...styleHashes.map((hash) => `'sha256-${hash}'`));
	}

	const csp = [
		"default-src 'self'",
		`script-src ${scriptSources.join(' ')}`,
		`style-src ${styleSources.join(' ')}`,
		"img-src 'self' data: https:",
		"font-src 'self' data:",
		"connect-src 'self' https:",
		"media-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	];

	return csp.join('; ');
}

/**
 * Generate SHA-256 hash for inline content (for CSP hashes)
 * @param content - The inline script or style content
 */
export function generateCSPHash(content: string): string {
	return createHash('sha256').update(content, 'utf8').digest('base64');
}

/**
 * CSP nonce manager for request-scoped nonces
 */
export class CSPNonceManager {
	private scriptNonce: string | undefined;
	private styleNonce: string | undefined;

	constructor() {
		this.regenerateNonces();
	}

	/**
	 * Regenerate nonces (should be called for each request)
	 */
	regenerateNonces(): void {
		this.scriptNonce = generateCSPNonce();
		this.styleNonce = generateCSPNonce();
	}

	/**
	 * Get the current script nonce
	 */
	getScriptNonce(): string {
		return this.scriptNonce || '';
	}

	/**
	 * Get the current style nonce
	 */
	getStyleNonce(): string {
		return this.styleNonce || '';
	}

	/**
	 * Get security headers with current nonces
	 */
	getSecurityHeaders(): Record<string, string> {
		return getSecurityHeaders({
			scriptNonce: this.scriptNonce,
			styleNonce: this.styleNonce
		});
	}

	/**
	 * Get CSP-compliant script tag with nonce
	 * @param content - Script content
	 */
	getScriptTag(content: string): string {
		return `<script nonce="${this.scriptNonce}">${content}</script>`;
	}

	/**
	 * Get CSP-compliant style tag with nonce
	 * @param content - Style content
	 */
	getStyleTag(content: string): string {
		return `<style nonce="${this.styleNonce}">${content}</style>`;
	}
}

/**
 * Input validation patterns for security
 */
export function getValidationPatterns() {
	return {
		// UUID pattern
		uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,

		// Email pattern (basic)
		email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

		// Safe string (alphanumeric, spaces, basic punctuation)
		safeString: /^[a-zA-Z0-9\s\-._@]+$/,

		// Number pattern
		number: /^-?\d+(\.\d+)?$/,

		// Boolean pattern
		boolean: /^(true|false)$/i,

		// ISO date pattern
		isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,

		// URL pattern (basic)
		url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
	};
}

/**
 * Rate limiting configuration
 */
export function getRateLimits() {
	return {
		// Authentication endpoints
		auth: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 5, // 5 attempts per window
			message: 'Too many authentication attempts'
		},

		// General API endpoints
		api: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100, // 100 requests per window
			message: 'Too many API requests'
		},

		// Sensitive operations
		sensitive: {
			windowMs: 60 * 60 * 1000, // 1 hour
			max: 10, // 10 operations per hour
			message: 'Too many sensitive operations'
		}
	};
}

/**
 * Security rules for different environments
 */
export function getEnvironmentRules() {
	const baseRules = {
		requireHttps: false,
		enableDebugLogs: false,
		allowDevTools: false,
		enableSourceMaps: false,
		maxRequestSize: '10mb',
		sessionTimeout: 30 * 60 * 1000, // 30 minutes
		tokenExpiry: 60 * 60 * 1000, // 1 hour
		refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000 // 7 days
	};

	if (environment.production) {
		return {
			...baseRules,
			requireHttps: true,
			enableDebugLogs: false,
			allowDevTools: false,
			enableSourceMaps: false,
			maxRequestSize: '5mb',
			sessionTimeout: 15 * 60 * 1000, // 15 minutes in production
			tokenExpiry: 30 * 60 * 1000, // 30 minutes in production
			refreshTokenExpiry: 24 * 60 * 60 * 1000 // 1 day in production
		};
	} else {
		return {
			...baseRules,
			enableDebugLogs: true,
			allowDevTools: true,
			enableSourceMaps: true
		};
	}
}

/**
 * Sanitize input to prevent injection attacks
 */
export function sanitizeInput(input: any): any {
	if (typeof input === 'string') {
		// For HTML contexts, escape rather than remove
		return input
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#x27;')
			.replace(/\//g, '&#x2F;')
			.trim();
	}

	if (Array.isArray(input)) {
		return input.map((item) => sanitizeInput(item));
	}

	if (typeof input === 'object' && input !== null) {
		const sanitized: any = {};
		for (const [key, value] of Object.entries(input)) {
			sanitized[key] = sanitizeInput(value);
		}
		return sanitized;
	}

	return input;
}

/**
 * Validate that a string is safe for use
 */
export function isValidInput(input: string, pattern?: RegExp): boolean {
	if (!input || typeof input !== 'string') {
		return false;
	}

	// Check for common injection patterns
	const dangerousPatterns = [
		/<script/i,
		/javascript:/i,
		/vbscript:/i,
		/onload=/i,
		/onerror=/i,
		/eval\(/i,
		/document\./i,
		/window\./i
	];

	if (dangerousPatterns.some((pattern) => pattern.test(input))) {
		return false;
	}

	// Check against provided pattern
	if (pattern && !pattern.test(input)) {
		return false;
	}

	return true;
}

/**
 * Generate a secure random string
 */
export function generateSecureRandomString(length = 32): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = randomBytes(length);
	return Array.from(bytes)
		.map((byte) => chars[byte % chars.length])
		.join('');
}

/**
 * Check if a request is from a trusted source
 */
export function isTrustedSource(userAgent?: string, origin?: string): boolean {
	// In production, implement proper origin validation
	if (environment.production) {
		// Add your trusted origins here
		const trustedOrigins = [environment.baseUrl, 'https://apidemo.gauzy.co', 'https://apistage.gauzy.co', 'https://api.gauzy.co', 'https://app.gauzy.co', 'https://stage.gauzy.co', 'https://demo.gauzy.co'];

		if (origin && !trustedOrigins.includes(origin)) {
			return false;
		}
	}

	// Basic user agent validation
	if (userAgent) {
		const suspiciousPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];

		if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
			return false;
		}
	}

	return true;
}

// Export the security configuration as an object for backward compatibility
export const securityConfig = {
	getSecurityHeaders,
	getValidationPatterns,
	getRateLimits,
	getEnvironmentRules,
	sanitizeInput,
	isValidInput,
	generateSecureRandomString,
	isTrustedSource,
	generateCSPNonce,
	generateCSPHash,
	getCSPHeaderWithHashes,
	CSPNonceManager
};
