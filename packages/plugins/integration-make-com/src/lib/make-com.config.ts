/**
 * Make.com OAuth Configuration
 *
 * As per documentation, OAuth endpoints use the Make authentication server URL
 * instead of zone servers.
 */
const { CLIENT_BASE_URL, API_BASE_URL } = process.env;

/** Make authentication server URL */
export const MAKE_BASE_URL = process.env.GAUZY_MAKE_BASE_URL ?? 'https://www.make.com';

/** Make post-install URL */
export const MAKE_POST_INSTALL_URL = process.env.GAUZY_MAKE_POST_INSTALL_URL ??
    (CLIENT_BASE_URL ?
        `${CLIENT_BASE_URL}/#/pages/integrations/make` :
        'http://localhost:4200/#/pages/integrations/make'
    );

/** Make OAuth redirect URL */
export const MAKE_REDIRECT_URL = process.env.GAUZY_MAKE_REDIRECT_URL ??
    (API_BASE_URL ?
        `${API_BASE_URL}/api/integration/make-com/oauth/callback` :
        'http://localhost:3000/api/integration/make-com/oauth/callback'
    );

/** Default scopes for Make.com OAuth - Updated to match Make.com documentation */
export const MAKE_DEFAULT_SCOPES =
    [
        'organizations:read',
        'organizations:write',
        'udts:read',
        'udts:write',
        'scenarios:read',
        'scenarios:write',
        'templates:read',
        'templates:write',
        'connections:read',
        'connections:write',
        'datastores:read',
        'datastores:write',
        'teams:read',
        'teams:write',
        'keys:read',
        'keys:write',
        'notifications:read',
        'notifications:write',
        'sdk-apps:read',
        'sdk-apps:write',
        'user:read',
        'user:write',
        'hooks:read',
        'hooks:write',
        'devices:read',
        'devices:write',
        'organization-variables:read',
        'organization-variables:write',
        'team-variables:read',
        'team-variables:write',
        'scenarios:run',
        'functions:read',
        'functions:write',
        'custom-property-structures:read',
        'custom-property-structures:write',
        'openid'
    ];
