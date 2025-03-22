/** Base URL for Zapier's REST API endpoints */
export const ZAPIER_API_URL = 'https://api.zapier.com/v1';

/** URL for initiating OAuth authorization flow with Gauzy */
export const ZAPIER_AUTHORIZATION_URL = '{{process.env.API_BASE_URL}}/api/integration/zapier/oauth/authorize';

/** URL for obtaining OAuth access tokens from Gauzy */
export const ZAPIER_TOKEN_URL = '{{process.env.API_BASE_URL}}/api/integration/zapier/token/:integrationId';

/** URL for redirecting users after OAuth authorization */
export const ZAPIER_REDIRECT_URI = 'https://zapier.com/dashboard/auth/oauth/return/App221848CLIAPI/'
