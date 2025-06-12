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
 * ActivePieces connection value for OAuth2
 */
export interface IActivepiecesOAuth2ConnectionValue {
	type: ActivepiecesConnectionType.OAUTH2;
	client_id: string;
	client_secret: string;
	data: Record<string, string | number>;
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
 * ActivePieces connection response
 */
export enum ActivepiecesConnectionStatus {
	ACTIVE = 'ACTIVE',
	ERROR = 'ERROR'
}

export interface IActivepiecesConnection {
	id: string;
	externalId: string;
	displayName: string;
	pieceName: string;
	projectId: string;
	type: ActivepiecesConnectionType;
	status: ActivepiecesConnectionStatus;
	created: string;
	updated: string;
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
	IS_ENABLED = 'is_enabled'
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
