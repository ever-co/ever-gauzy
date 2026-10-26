/** ActivePieces Base URL */
export const ACTIVEPIECES_BASE_URL = process.env['ACTIVEPIECES_BASE_URL'] || 'https://cloud.activepieces.com';

/** ActivePieces API base URL */
export const ACTIVEPIECES_API_URL = `${ACTIVEPIECES_BASE_URL}/api/v1`;

/** ActivePieces connection endpoints */
export const ACTIVEPIECES_CONNECTIONS_URL = `${ACTIVEPIECES_API_URL}/app-connections`;

/**
 * ActivePieces MCP Server endpoints of the legacy API (`GET /v1/mcp-servers?projectId`, `GET|POST /v1/mcp-servers/:id`,
 * `POST /v1/mcp-servers/:id/rotate`), which Activepieces replaced with MCP 2.0 in November 2025. Used only with
 * `GAUZY_ACTIVEPIECES_MCP_API=legacy`, for an older self-hosted Activepieces.
 */
export const ACTIVEPIECES_MCP_SERVERS_URL = `${ACTIVEPIECES_API_URL}/mcp-servers`;

/**
 * The path, under a project (`/v1/projects/:projectId/<path>`), of the project's one MCP server in Activepieces MCP
 * 2.0: `GET` reads it, `POST` updates it (`{ disabledTools }`), `POST …/rotate` rotates its token. Every route accepts
 * only user tokens (`mcp-server-controller.ts`: `securityAccess.project([PrincipalType.USER], …)`), never an API key.
 */
export const ACTIVEPIECES_PROJECT_MCP_SERVER_PATH = 'mcp-server';

/** ActivePieces Piece name */
export const ACTIVEPIECES_PIECE_NAME = 'Ever-gauzy';

/** ActivePieces project endpoints (platform key: create, list by external id, update) */
export const ACTIVEPIECES_PROJECTS_URL = `${ACTIVEPIECES_API_URL}/projects`;

/** ActivePieces managed authentication: exchanges a token signed with the platform's signing key for a project token */
export const ACTIVEPIECES_MANAGED_AUTHN_URL = `${ACTIVEPIECES_API_URL}/managed-authn/external-token`;

/** Default prefix of the external id of a tenant's Activepieces project and user: `<prefix><tenantId>` */
export const ACTIVEPIECES_DEFAULT_EXTERNAL_ID_PREFIX = 'gauzy-tenant-';
