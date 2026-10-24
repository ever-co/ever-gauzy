/** ActivePieces Base URL */
export const ACTIVEPIECES_BASE_URL = process.env['ACTIVEPIECES_BASE_URL'] || 'https://cloud.activepieces.com';

/** ActivePieces API base URL */
export const ACTIVEPIECES_API_URL = `${ACTIVEPIECES_BASE_URL}/api/v1`;

/** ActivePieces connection endpoints */
export const ACTIVEPIECES_CONNECTIONS_URL = `${ACTIVEPIECES_API_URL}/app-connections`;

/** ActivePieces MCP Server endpoints */
export const ACTIVEPIECES_MCP_SERVERS_URL = `${ACTIVEPIECES_API_URL}/mcp-servers`;

/** ActivePieces Piece name */
export const ACTIVEPIECES_PIECE_NAME = 'Ever-gauzy';

/** ActivePieces project endpoints (platform key: create, list by external id, update) */
export const ACTIVEPIECES_PROJECTS_URL = `${ACTIVEPIECES_API_URL}/projects`;

/** ActivePieces managed authentication: exchanges a token signed with the platform's signing key for a project token */
export const ACTIVEPIECES_MANAGED_AUTHN_URL = `${ACTIVEPIECES_API_URL}/managed-authn/external-token`;

/** Default prefix of the external id of a tenant's Activepieces project and user: `<prefix><tenantId>` */
export const ACTIVEPIECES_DEFAULT_EXTERNAL_ID_PREFIX = 'gauzy-tenant-';
