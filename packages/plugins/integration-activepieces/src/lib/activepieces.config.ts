/** ActivePieces Base URL */
export const ACTIVEPIECES_BASE_URL = process.env['ACTIVEPIECES_BASE_URL'] || 'https://cloud.activepieces.com';

/** ActivePieces API base URL */
export const ACTIVEPIECES_API_URL = `${ACTIVEPIECES_BASE_URL}/api/v1`;

/** ActivePieces OAuth endpoints */
export const ACTIVEPIECES_OAUTH_AUTHORIZE_URL = `${ACTIVEPIECES_BASE_URL}/oauth/authorize`;
export const ACTIVEPIECES_OAUTH_TOKEN_URL = `${ACTIVEPIECES_BASE_URL}/oauth/token`;

/** ActivePieces connection endpoints */
export const ACTIVEPIECES_CONNECTIONS_URL = `${ACTIVEPIECES_API_URL}/app-connections`;

/** ActivePieces Piece name */
export const ACTIVEPIECES_PIECE_NAME = 'Ever-gauzy';

/** OAuth scopes for ActivePieces */
export const ACTIVEPIECES_SCOPES = ['read', 'write'].join(' ');

/** OAuth response type */
export const OAUTH_RESPONSE_TYPE = 'code';

/** OAuth grant types */
export const OAUTH_GRANT_TYPE = {
	AUTHORIZATION_CODE: 'authorization_code',
	REFRESH_TOKEN: 'refresh_token'
} as const;
