/**
 * Authentication endpoint patterns.
 *
 * These endpoints should be excluded from automatic token refresh logic
 * to prevent infinite loops when authentication fails.
 */
export const AUTH_ENDPOINTS = [
	'/auth/login',
	'/auth/refresh-token',
	'/auth/register',
	'/auth/request-password',
	'/auth/reset-password'
];
