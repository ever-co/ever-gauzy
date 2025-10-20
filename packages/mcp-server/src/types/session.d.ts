/**
 * Session type extensions for Express session
 */

import 'express-session';
import type { AuthenticatedUser } from '@gauzy/auth';

declare module 'express-session' {
	interface SessionData {
		user?: AuthenticatedUser;
		isAuthenticated?: boolean;
		returnUrl?: string;
	}
}
