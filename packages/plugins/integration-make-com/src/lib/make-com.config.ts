/**
 * Make.com OAuth Configuration
 *
 * As per documentation, OAuth endpoints use the Make authentication server URL
 * instead of zone servers.
 */
const { GAUZY_MAKE_POST_INSTALL_URL, GAUZY_MAKE_REDIRECT_URL, CLIENT_BASE_URL, API_BASE_URL } = process.env;

/** Make authentication server URL */
export const MAKE_BASE_URL = process.env.GAUZY_MAKE_BASE_URL ?? 'https://www.make.com';

/** Make post-install URL */
export const MAKE_POST_INSTALL_URL = GAUZY_MAKE_POST_INSTALL_URL ?? `${CLIENT_BASE_URL}/#/pages/integrations/make`;

/** Make OAuth redirect URL */
export const MAKE_REDIRECT_URL = GAUZY_MAKE_REDIRECT_URL ?? `${API_BASE_URL}/api/integration/make/oauth/callback`;

/** Default scopes for Make.com OAuth */
export const MAKE_DEFAULT_SCOPES = 'offline_access';
