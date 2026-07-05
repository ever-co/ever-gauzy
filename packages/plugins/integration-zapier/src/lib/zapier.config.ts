/**
 * Zapier base API URL
 */
export const ZAPIER_BASE_URL = 'https://zapier.com';

/**
 * Zapier API URL
 */
export const ZAPIER_API_URL = 'https://api.zapier.com';

/**
 * Standard Zapier OAuth scopes for comprehensive integration
 * Based on: https://docs.zapier.com/powered-by-zapier/api-reference/authentication
 *
 * Scopes included:
 * - 'zap': Read access to the authenticated user's own Zaps
 * - 'zap:all': Read access to all Zaps the user can see (including shared)
 * - 'zap:account:all': Read access to all Zaps across the user's account
 * - 'zap:write': Write access to Zaps (create, update, delete Zaps)
 * - 'authentication': Access to authentication information (manage user auth)
 *
 * These scopes cover the Zapier Workflow API endpoints used by this plugin:
 * GET /v2/zaps, POST /v2/zaps, GET /v2/triggers, GET /v2/actions, and the
 * user authentication endpoints. The zap templates endpoint (/v1/zap-templates)
 * is public and does not consume any of these scopes.
 */
export const ZAPIER_OAUTH_SCOPES = 'zap zap:all zap:account:all zap:write authentication';

/**
 * Zapier token expiration time (in seconds)
 * 10 hours = 36000 seconds
 * Default to shorter expiration in production for security
 */
export const ZAPIER_TOKEN_EXPIRATION_TIME = process.env['NODE_ENV'] === 'production' ? 7200 : 36000;

/** URL for initiating OAuth authorization flow with Gauzy */
export const ZAPIER_AUTHORIZATION_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/oauth/authorize`;

/** URL for OAuth callback after user authorization */
export const ZAPIER_CALLBACK_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/oauth/callback`;

/** URL for obtaining OAuth access tokens from Gauzy */
export const ZAPIER_TOKEN_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/oauth/token`;

/** URL for redirecting users after OAuth authorization */
export const ZAPIER_REDIRECT_URI = 'https://zapier.com/dashboard/auth/oauth/return/App221848CLIAPI/';
