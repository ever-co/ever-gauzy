/**
 * Security utilities for sanitizing sensitive information and preventing information disclosure
 */

/**
 * Sanitize error message to prevent information disclosure
 * Removes sensitive information like file paths, internal details, etc.
 */
export function sanitizeErrorMessage(error: unknown): string {
	if (!error) {
		return 'Unknown error occurred';
	}

	let message: string;
	if (error instanceof Error) {
		message = error.message;
	} else if (typeof error === 'string') {
		message = error;
	} else {
		message = 'Unknown error occurred';
	}

	// Remove sensitive patterns
	const sensitivePatterns = [
		// File paths
		/\/[a-zA-Z0-9._\-\/]+\.(ts|js|json|env)/g,
		// Email addresses
		/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
		// API keys and tokens (common patterns)
		/[a-zA-Z0-9]{32,}/g,
		// Database connection strings
		/mongodb:\/\/[^\s]+/g,
		/postgres:\/\/[^\s]+/g,
		/mysql:\/\/[^\s]+/g,
		// Internal server details
		/at [a-zA-Z0-9._\-\/]+:[0-9]+:[0-9]+/g,
		// Stack trace file paths
		/\([a-zA-Z0-9._\-\/]+:[0-9]+:[0-9]+\)/g
	];

	// Replace sensitive patterns with generic placeholders
	let sanitizedMessage = message;
	sensitivePatterns.forEach(pattern => {
		sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
	});

	// Limit message length to prevent information leakage
	if (sanitizedMessage.length > 200) {
		sanitizedMessage = `${sanitizedMessage.substring(0, 200)}...`;
	}

	return sanitizedMessage;
}

/**
 * Sanitize object for logging, removing sensitive fields
 */
export function sanitizeForLogging(obj: any): any {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}

	const sensitiveFields = [
		'password',
		'token',
		'accessToken',
		'refreshToken',
		'refresh_token',
		'apiKey',
		'api_key',
		'secret',
		'privateKey',
		'private_key',
		'credentials',
		'auth',
		'authorization'
	];

	const sanitized = { ...obj };

	// Recursively sanitize nested objects
	const sanitizeRecursive = (object: any): any => {
		if (Array.isArray(object)) {
			return object.map(item => sanitizeRecursive(item));
		}

		if (object && typeof object === 'object') {
			const result: any = {};
			for (const [key, value] of Object.entries(object)) {
				const lowerKey = key.toLowerCase();
				if (sensitiveFields.some(field => lowerKey.includes(field))) {
					result[key] = '[REDACTED]';
				} else if (typeof value === 'object' && value !== null) {
					result[key] = sanitizeRecursive(value);
				} else {
					result[key] = value;
				}
			}
			return result;
		}

		return object;
	};

	return sanitizeRecursive(sanitized);
}

/**
 * Check if an error is safe to log in production
 */
export function isSafeToLogError(error: unknown): boolean {
	if (!error) {
		return false;
	}

	const message = error instanceof Error ? error.message : String(error);

	// Don't log errors that might contain sensitive information
	const unsafePatterns = [
		/password/i,
		/token/i,
		/credential/i,
		/secret/i,
		/api[_-]?key/i,
		/authorization/i,
		/authentication/i
	];

	return !unsafePatterns.some(pattern => pattern.test(message));
}

/**
 * Create a safe error response for API endpoints
 */
export function createSafeErrorResponse(error: unknown, includeDetails = false): {
	error: string;
	details?: string;
} {
	const sanitizedMessage = sanitizeErrorMessage(error);

	const response: any = {
		error: sanitizedMessage
	};

	if (includeDetails && process.env.NODE_ENV !== 'production') {
		response.details = error instanceof Error ? error.stack : String(error);
	}

	return response;
}
