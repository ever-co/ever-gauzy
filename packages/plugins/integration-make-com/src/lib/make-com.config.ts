/**
 * Make authentication server URL - as per documentation, OAuth endpoints use
 * the Make authentication server URL instead of zone servers
 */
export const MAKE_BASE_URL = process.env['GAUZY_MAKE_BASE_URL'] ?? 'https://auth.make.com';

/** Make post install URl */
export const GAUZY_MAKE_POST_INSTALL_URL = process.env['GAUZY_MAKE_POST_INSTALL_URL'] ?? 'http://localhost:4200/#/pages/integrations/make';

/** Make redirect URL */
export const GAUZY_MAKE_REDIRECT_URL = process.env['GAUZY_MAKE_REDIRECT_URL'] ?? `${process.env['API_BASE_URL']}/api/integration/make/oauth/callback`;
/**
 * Default scopes for Make.com OAuth
 */
export const MAKE_DEFAULT_SCOPES = 'offline_access';
