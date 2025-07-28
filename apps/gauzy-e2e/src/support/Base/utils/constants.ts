/**
 * Patterns for API requests that should not block test execution
 * These are typically background, analytics, or monitoring requests
 * that don't affect core functionality
 */
export const NON_CRITICAL_REQUESTS = [
	// Monitoring & Health checks
	// /\/api\/health/,
	// /\/api\/heartbeat/,
	// /\/api\/status/,
	// Add patterns as needed...
] as const;

/**
 * Default timeout for waiting on API requests to complete (in ms)
 */
export const API_WAIT_TIMEOUT = 30000;

/**
 * Optional delay after requests complete to let UI settle (in ms)
 */
export const UI_SETTLE_DELAY = 100;
