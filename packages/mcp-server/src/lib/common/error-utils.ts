/**
 * Error sanitization utilities for MCP server
 *
 * These utilities are defined locally to avoid importing from @gauzy/auth,
 * which causes TypeScript compilation performance issues due to its complex
 * dependency chain in the monorepo.
 */

import { createHash } from 'node:crypto';

/**
 * A session id as it may appear in a log: a short hash of it, which tells sessions apart and gives nothing back.
 *
 * A session id is a bearer credential: whoever presents it (as a header, a cookie or `?sessionId=`) acts with that
 * session's Gauzy login. Logs are read and shipped by more people and systems than the sessions themselves, so they
 * must not carry it.
 *
 * @param sessionId The session id.
 * @returns `#` and the first 12 hex digits of its SHA-256, or `none`.
 */
export function sessionIdForLog(sessionId: string | null | undefined): string {
	if (!sessionId) {
		return 'none';
	}
	return `#${createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 12)}`;
}

/**
 * The reason the API gave for refusing a request, from the answer the HTTP client keeps on its error: the validation
 * sends a list, a guard one sentence. None for an answer without one (a proxy's page, a bare status).
 */
function apiReasonOf(error: unknown): string | undefined {
	const data = (error as { response?: { data?: unknown } } | undefined)?.response?.data;
	if (typeof data !== 'object' || data === null) {
		return undefined;
	}
	const message = (data as { message?: unknown }).message;
	if (Array.isArray(message)) {
		return message.map(String).join('; ');
	}
	if (typeof message === 'string' && message.length > 0) {
		return message;
	}
	return undefined;
}

/**
 * Sanitize an error message for safe logging/display
 * Removes sensitive information and normalizes error format
 */
export function sanitizeErrorMessage(error: unknown): string {
	if (error === null || error === undefined) {
		return 'Unknown error';
	}

	if (typeof error === 'string') {
		return sanitizeString(error);
	}

	if (error instanceof Error) {
		const reason = apiReasonOf(error);
		if (reason) {
			return sanitizeString(`${error.message}: ${reason}`);
		}
		return sanitizeString(error.message);
	}

	if (typeof error === 'object') {
		// Handle axios-like errors
		const errorObj = error as Record<string, unknown>;
		if (errorObj.message && typeof errorObj.message === 'string') {
			return sanitizeString(errorObj.message);
		}
		if (errorObj.response && typeof errorObj.response === 'object') {
			const response = errorObj.response as Record<string, unknown>;
			if (response.data && typeof response.data === 'object') {
				const data = response.data as Record<string, unknown>;
				if (data.message) {
					return sanitizeString(String(data.message));
				}
			}
		}
	}

	try {
		return sanitizeString(String(error));
	} catch {
		return 'Unknown error';
	}
}

/**
 * Sanitize error or data for logging
 * Removes sensitive fields and truncates long values
 */
export function sanitizeForLogging(data: unknown): string {
	if (data === null || data === undefined) {
		return 'null';
	}

	if (typeof data === 'string') {
		return sanitizeString(data);
	}

	if (data instanceof Error) {
		return JSON.stringify({
			name: data.name,
			message: sanitizeString(data.message),
			// The stack opens with the message: it is sanitized the same way
			stack: sanitizeStack(data.stack)
		});
	}

	if (typeof data === 'object') {
		try {
			// Remove sensitive fields
			const sanitized = sanitizeObject(data as Record<string, unknown>);
			return JSON.stringify(sanitized, null, 2);
		} catch {
			return '[Object - serialization failed]';
		}
	}

	return String(data);
}

/**
 * The first lines of a stack, sanitized
 */
function sanitizeStack(stack: string | undefined): string | undefined {
	if (!stack) {
		return stack;
	}
	const firstLines = stack.split('\n').slice(0, 5).join('\n');
	return sanitizeString(firstLines);
}

/**
 * Sanitize a string by removing potentially sensitive patterns
 */
function sanitizeString(str: string): string {
	// Truncate very long strings
	const maxLength = 1000;
	let result = str.length > maxLength ? str.substring(0, maxLength) + '...' : str;

	// Remove potential JWT tokens
	result = result.replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_TOKEN]');

	// Remove personal API tokens (GAUZY_API_TOKEN), whole or cut short
	result = result.replace(/gzp_[A-Za-z0-9_-]+/g, '[API_TOKEN]');

	// Remove potential passwords in URLs
	result = result.replace(/:\/\/[^:]+:[^@]+@/g, '://[CREDENTIALS]@');

	// Remove potential API keys
	result = result.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
		// Only replace if it looks like a key (all alphanumeric)
		if (/^[a-zA-Z0-9]+$/.test(match)) {
			return '[REDACTED_KEY]';
		}
		return match;
	});

	return result;
}

/**
 * Recursively sanitize an object for logging
 */
function sanitizeObject(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
	if (depth > 5) {
		return { _truncated: true };
	}

	const sensitiveKeys = [
		'password',
		'token',
		'accessToken',
		'refreshToken',
		'secret',
		'apiKey',
		'api_key',
		'authorization',
		'auth',
		'credentials',
		'privateKey',
		'private_key'
	];

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		const lowerKey = key.toLowerCase();

		// Check if this is a sensitive field
		if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive.toLowerCase()))) {
			result[key] = '[REDACTED]';
			continue;
		}

		if (value === null || value === undefined) {
			result[key] = value;
		} else if (typeof value === 'string') {
			result[key] = sanitizeString(value);
		} else if (typeof value === 'object' && !Array.isArray(value)) {
			result[key] = sanitizeObject(value as Record<string, unknown>, depth + 1);
		} else if (Array.isArray(value)) {
			result[key] = value.slice(0, 10).map((item) => {
				if (typeof item === 'object' && item !== null) {
					return sanitizeObject(item as Record<string, unknown>, depth + 1);
				}
				return typeof item === 'string' ? sanitizeString(item) : item;
			});
		} else {
			result[key] = value;
		}
	}

	return result;
}
