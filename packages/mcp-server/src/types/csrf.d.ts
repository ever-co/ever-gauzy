/**
 * Type declarations for csrf-csrf library compatibility
 * The csrf-csrf package already provides the necessary type declarations
 *
 * Note: Types are defined inline to avoid import resolution issues during build.
 */

/**
 * CSRF token generator request utility
 */
export interface CsrfTokenGeneratorRequestUtil {
	(req?: unknown): string;
}

/**
 * Double CSRF configuration
 */
export interface DoubleCsrfConfig {
	getSecret: (req?: unknown) => string | string[];
	cookieName?: string;
	cookieOptions?: {
		httpOnly?: boolean;
		sameSite?: boolean | 'lax' | 'strict' | 'none';
		path?: string;
		secure?: boolean;
		signed?: boolean;
		maxAge?: number;
	};
	size?: number;
	ignoredMethods?: string[];
	getTokenFromRequest?: (req: unknown) => string | null;
}
