/**
 * Session type extensions for Express session
 *
 * Note: Using a simplified user type here to avoid importing from @gauzy/auth
 * which can cause circular dependency issues during build.
 */

import 'express-session';

/**
 * Simplified authenticated user interface for session storage
 */
interface SessionUser {
	id: string;
	email?: string;
	name?: string;
	tenantId?: string;
	organizationId?: string;
	[key: string]: unknown;
}

declare module 'express-session' {
	interface SessionData {
		user?: SessionUser;
		isAuthenticated?: boolean;
		returnUrl?: string;
	}
}
