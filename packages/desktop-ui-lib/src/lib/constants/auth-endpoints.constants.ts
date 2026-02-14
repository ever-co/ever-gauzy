/**
 * Authentication endpoint patterns.
 *
 * These endpoints should be excluded from automatic token refresh logic
 * to prevent infinite loops when authentication fails.
 *
 * Any endpoint that returns 401 as part of normal authentication flow
 * should be included here.
 */
export const AUTH_ENDPOINTS = [
	'/auth/login',
	'/auth/refresh-token',
	'/auth/register',
	'/auth/request-password',
	'/auth/reset-password',
	'/auth/authenticated',
	'/auth/logout',
	'/auth/signin.email.password',
	'/auth/signin.email',
	'/auth/signin.email/confirm',
	'/auth/signin.workspace',
	'/auth/email/verify'
];
