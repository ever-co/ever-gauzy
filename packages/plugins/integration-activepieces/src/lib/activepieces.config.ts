/** ActivePieces API base URL */
export const ACTIVEPIECES_API_URL = 'https://cloud.activepieces.com/api/v1';

/** ActivePieces OAuth endpoints */
export const ACTIVEPIECES_OAUTH_AUTHORIZE_URL = 'https://cloud.activepieces.com/oauth/authorize';
export const ACTIVEPIECES_OAUTH_TOKEN_URL = 'https://cloud.activepieces.com/oauth/token';

/** ActivePieces connection endpoints */
export const ACTIVEPIECES_CONNECTIONS_URL = `${ACTIVEPIECES_API_URL}/app-connections`;

/** OAuth scopes for ActivePieces */
export const ACTIVEPIECES_SCOPES = 'read write';

/** OAuth response type */
export const OAUTH_RESPONSE_TYPE = 'code';

/** OAuth grant types */
export const OAUTH_GRANT_TYPE = {
	AUTHORIZATION_CODE: 'authorization_code',
	REFRESH_TOKEN: 'refresh_token'
} as const;
