/**
 * Zapier base API URL
 */
export const ZAPIER_BASE_URL = 'https://zapier.com';

/**
 * Zapier API URL
 */
export const ZAPIER_API_URL = 'https://api.zapier.com';

/**
 * Zapier token expiration time (in seconds)
 * 10 hours = 36000 seconds
 * Default to shorter expiration in production for security
 */
export const ZAPIER_TOKEN_EXPIRATION_TIME = process.env["NODE_ENV"] === 'production' ? 7200 : 36000;

/** URL for initiating OAuth authorization flow with Gauzy */
export const ZAPIER_AUTHORIZATION_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/oauth/authorize`;

/** URL for OAuth callback after user authorization */
export const ZAPIER_CALLBACK_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/oauth/callback`;

/** URL for obtaining OAuth access tokens from Gauzy */
export const ZAPIER_TOKEN_URL = `${process.env['API_BASE_URL']}/api/integration/zapier/token`;

/** URL for redirecting users after OAuth authorization */
export const ZAPIER_REDIRECT_URI = 'https://zapier.com/dashboard/auth/oauth/return/App221848CLIAPI/';
