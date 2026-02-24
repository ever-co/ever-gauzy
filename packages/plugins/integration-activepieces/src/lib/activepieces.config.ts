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
