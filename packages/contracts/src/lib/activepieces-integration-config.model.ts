import { IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';

/**
 * ActivePieces OAuth token response interface
 * @property expires_in - Token lifetime in seconds from issuance
 * @property refresh_token - Optional refresh token for renewing access
 */
export interface IActivepiecesOAuthTokens {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_in: number;
	scope?: string;
}

/**
 * ActivePieces connection types according to their API
 */
export enum ActivepiecesConnectionType {
	SECRET_TEXT = 'SECRET_TEXT',
	OAUTH2 = 'OAUTH2',
	CLOUD_OAUTH2 = 'CLOUD_OAUTH2',
	PLATFORM_OAUTH2 = 'PLATFORM_OAUTH2',
	BASIC_AUTH = 'BASIC_AUTH',
	CUSTOM_AUTH = 'CUSTOM_AUTH'
}

/**
 * ActivePieces connection scope
 */
export enum ActivepiecesConnectionScope {
	PROJECT = 'PROJECT'
}

/**
 * ActivePieces connection value for OAuth2
 */
export interface IActivepiecesOAuth2ConnectionValue {
	type: ActivepiecesConnectionType.OAUTH2;
	client_id: string;
	client_secret: string;
	data: Record<string, string | number | boolean>;
}

/**
 * ActivePieces connection value for SECRET_TEXT
 */
export interface IActivepiecesSecretTextConnectionValue {
	type: ActivepiecesConnectionType.SECRET_TEXT;
	secret_text: string;
}

/**
 * ActivePieces connection creation request
 */
export interface IActivepiecesConnectionRequest {
	externalId: string;
	displayName: string;
	pieceName: string;
	projectId: string;
	metadata?: Record<string, string | number | boolean>;
	type: ActivepiecesConnectionType;
	value: IActivepiecesOAuth2ConnectionValue | IActivepiecesSecretTextConnectionValue;
}

/**
 * ActivePieces connection status
 */
export enum ActivepiecesConnectionStatus {
	ACTIVE = 'ACTIVE',
	ERROR = 'ERROR'
}

/**
 * ActivePieces user/owner interface
 */
export interface IActivepiecesUser {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	trackEvents: boolean;
	newsLetter: boolean;
	created: string;
	updated: string;
}

/**
 * ActivePieces connection response (complete schema)
 */
export interface IActivepiecesConnection {
	id: string;
	created: string;
	updated: string;
	externalId: string;
	displayName: string;
	type: ActivepiecesConnectionType;
	pieceName: string;
	projectIds: string[];
	platformId: string | null;
	scope: ActivepiecesConnectionScope;
	status: ActivepiecesConnectionStatus;
	ownerId: string | null;
	owner: IActivepiecesUser | null;
	metadata: Record<string, unknown> | null;
	flowIds: string[] | null;
	integrationId: string;
}

/**
 * ActivePieces setting names for database storage
 */
export enum ActivepiecesSettingName {
	API_KEY = 'api_key',
	ACCESS_TOKEN = 'access_token',
	REFRESH_TOKEN = 'refresh_token',
	TOKEN_TYPE = 'token_type',
	EXPIRES_IN = 'expires_in',
	EXPIRES_AT = 'expires_at',
	CONNECTION_ID = 'connection_id',
	PROJECT_ID = 'project_id',
	IS_ENABLED = 'is_enabled',
	CLIENT_ID = 'client_id',
	CLIENT_SECRET = 'client_secret',
	CALLBACK_URL = 'callback_url',
	POST_INSTALL_URL = 'post_install_url',
	STATE_SECRET = 'state_secret',
	/**
	 * How the tenant reaches Activepieces: one of {@link ActivepiecesConnectionMode}. Absent means `auto`.
	 * Server-managed, like every Activepieces setting: set through `POST /integration/activepieces/connection-mode`.
	 */
	CONNECTION_MODE = 'connection_mode',
	/**
	 * The Activepieces project the server pinned the tenant to (project-token and platform-project modes). A record of
	 * what the server resolved, never read from a client: the project is found again by its external id.
	 */
	MANAGED_PROJECT_ID = 'managed_project_id'
}

/**
 * How a tenant's requests reach Activepieces.
 *
 * Activepieces API keys belong to a whole platform (every project on it): there is no project-scoped API key. A tenant
 * request therefore never acts under the installation's key without a project pinned by the server.
 */
export enum ActivepiecesConnectionMode {
	/** The first available of: the tenant's own key, a project token, the installation key with a pinned project. */
	AUTO = 'auto',
	/** The tenant's own Activepieces API key (its own platform), saved through `POST /integration/activepieces/setup`. */
	TENANT_API_KEY = 'tenant_api_key',
	/**
	 * A project-scoped token (7 days) the server obtains for the tenant's own project with the installation's signing
	 * key (Activepieces managed authentication). Activepieces itself confines the token to that project.
	 */
	PROJECT_TOKEN = 'project_token',
	/**
	 * The installation's platform key, with the tenant's own project pinned by the server on every call, and every
	 * resource read, changed or removed by id checked to belong to that project first.
	 */
	PLATFORM_PROJECT = 'platform_project'
}

/**
 * The tenant's Activepieces connection, as `GET /integration/activepieces/connection-mode` answers it. Never a secret.
 */
export interface IActivepiecesConnectionModeStatus {
	/** The mode the tenant chose (`auto` when it chose none). */
	requestedMode: ActivepiecesConnectionMode;
	/** The mode its requests use now, or `null` when none is available. */
	resolvedMode: Exclude<ActivepiecesConnectionMode, ActivepiecesConnectionMode.AUTO> | null;
	/** The modes the tenant may choose on this installation. */
	availableModes: ActivepiecesConnectionMode[];
	/** Whether the tenant saved an Activepieces API key of its own. */
	hasOwnApiKey: boolean;
	/** The Activepieces project the server pinned the tenant to, when known. */
	projectId: string | null;
}

/**
 * What the installation operator configured for Activepieces (`GET /integration/activepieces/platform/status`).
 * Booleans only: never a key.
 */
export interface IActivepiecesPlatformStatus {
	platformKeyConfigured: boolean;
	projectTokensConfigured: boolean;
	tenantProjectsEnabled: boolean;
	projectExternalIdPrefix: string;
	baseUrl: string;
}

/**
 * ActivePieces OAuth credentials interface
 */
export interface IActivepiecesOAuthCredentials {
	clientId: string;
	clientSecret: string;
}

/**
 * ActivePieces integration creation input
 */
export interface ICreateActivepiecesIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
	accessToken: string;
	/**
	 * The Activepieces project. Required with the tenant's own key; in the project-token and platform-project modes the
	 * server pins the tenant's own project, and a different one named here is refused.
	 */
	projectId?: string;
	connectionName?: string;
}

/**
 * ActivePieces project information
 */
export interface IActivepiecesProject {
	id: string;
	displayName: string;
	ownerId: string;
	created: string;
	updated: string;
	/** The id the platform's owner gave the project (`gauzy-tenant-<tenantId>` for a Gauzy tenant's project). */
	externalId?: string | null;
	platformId?: string;
}

/**
 * ActivePieces API response wrapper
 */
export interface IActivepiecesApiResponse<T> {
	data: T;
	status: number;
	headers?: Record<string, string>;
}

/**
 * ActivePieces error response
 */
export interface IActivepiecesErrorResponse {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

/**
 * Generic ActivePieces list response with pagination
 */
export interface IActivepiecesListResponse<T> {
	data: T[];
	next: string | null;
	previous: string | null;
}

/**
 * ActivePieces list connections response
 */
export interface IActivepiecesConnectionsListResponse extends IActivepiecesListResponse<IActivepiecesConnection> {}

/**
 * ActivePieces list connections query params
 */
export interface IActivepiecesConnectionsListParams {
	projectId: string;
	cursor?: string;
	scope?: ActivepiecesConnectionScope;
	pieceName?: string;
	displayName?: string;
	status?: ActivepiecesConnectionStatus;
	limit?: number;
}

/**
 * ActivePieces MCP Server Tool Piece Metadata
 */
export interface IActivepiecesMcpToolPieceMetadata {
	pieceName: string;
	pieceVersion: string;
	actionNames: string[];
	logoUrl: string;
	connectionExternalId: string;
}

/**
 * ActivePieces MCP Server Tool
 */
export interface IActivepiecesMcpTool {
	id: string;
	created: string;
	updated: string;
	type: string;
	mcpId: string;
	pieceMetadata: IActivepiecesMcpToolPieceMetadata;
	flowId: string;
	flow: Record<string, unknown>;
}

/**
 * ActivePieces MCP Server
 *
 * Activepieces MCP 2.0 (November 2025) keeps one MCP server per project (`/v1/projects/:projectId/mcp-server`), with
 * no name, agent or tool list of its own: it serves the project's flows (`flows`) except the tools disabled for it
 * (`disabledTools`, and the platform's `platformDisabledTools`). `name`, `agentId` and `tools` are those of the
 * servers the legacy `/v1/mcp-servers` routes answered (`GAUZY_ACTIVEPIECES_MCP_API=legacy`).
 */
export interface IActivepiecesMcpServer {
	id: string;
	created: string;
	updated: string;
	projectId: string;
	token: string;
	/** Legacy servers only. */
	name?: string;
	/** Legacy servers only. */
	agentId?: string;
	/** Legacy servers only. */
	tools?: IActivepiecesMcpTool[];
	/** MCP 2.0: the platform of the server. */
	platformId?: string | null;
	/** MCP 2.0: `PROJECT` for a project's server. */
	type?: string;
	/** MCP 2.0: the tools disabled on the project's server. */
	disabledTools?: string[] | null;
	/** MCP 2.0: the flows the server exposes as tools. */
	flows?: Record<string, unknown>[];
	/** MCP 2.0: the tools the platform disables on every server. */
	platformDisabledTools?: string[];
}

/**
 * ActivePieces MCP Server (Public) - excludes sensitive token field
 */
export type IActivepiecesMcpServerPublic = Omit<IActivepiecesMcpServer, 'token'>;

/**
 * ActivePieces MCP Server list response
 */
export interface IActivepiecesMcpServersListResponse extends IActivepiecesListResponse<IActivepiecesMcpServer> {}

/**
 * ActivePieces MCP Server list response (Public) - excludes sensitive token fields
 */
export interface IActivepiecesMcpServersListResponsePublic extends IActivepiecesListResponse<IActivepiecesMcpServerPublic> {}

/**
 * ActivePieces MCP Server list query params
 *
 * Under MCP 2.0 a project has one server: the list answers it alone, and `limit`, `cursor` and `name` (legacy
 * filters) do not apply.
 */
export interface IActivepiecesMcpServersListParams {
	projectId: string;
	limit?: number;
	cursor?: string;
	name?: string;
}

/**
 * ActivePieces MCP Server update request
 */
export interface IActivepiecesMcpServerUpdateRequest {
	/** Legacy servers only. */
	name?: string;
	/** Legacy servers only. */
	tools?: IActivepiecesMcpTool[];
	/** MCP 2.0: the tools to disable on the project's server (the list replaces the stored one). */
	disabledTools?: string[];
}

/**
 * ActivePieces OAuth token exchange request
 */
export interface IActivepiecesTokenExchangeRequest {
	code: string;
	client_id: string;
	client_secret: string;
	redirect_uri?: string;
	grant_type: 'authorization_code';
}
