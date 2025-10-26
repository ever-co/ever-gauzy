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
 * ActivePieces connection creation request
 */
export interface IActivepiecesConnectionRequest {
	externalId: string;
	displayName: string;
	pieceName: string;
	projectId: string;
	metadata?: Record<string, string | number | boolean>;
	type: ActivepiecesConnectionType;
	value: IActivepiecesOAuth2ConnectionValue;
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
	STATE_SECRET = 'state_secret'
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
	projectId: string;
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
 */
export interface IActivepiecesMcpServer {
	id: string;
	created: string;
	updated: string;
	name: string;
	projectId: string;
	token: string;
	agentId: string;
	tools: IActivepiecesMcpTool[];
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
	name?: string;
	tools?: IActivepiecesMcpTool[];
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
