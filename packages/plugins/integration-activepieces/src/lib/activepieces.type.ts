import { IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';

/**
 * ActivePieces OAuth token response interface
 */
export interface IActivepiecesOAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * ActivePieces OAuth token data with additional metadata
 */
export interface IActivepiecesTokenData extends IActivepiecesOAuthTokens {
  scope?: string;
  expires_at?: string;
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
  IS_ENABLED = 'is_enabled',
  WEBHOOK_URL = 'webhook_url',
  API_URL = 'api_url',
  CLIENT_ID = 'client_id',
  CLIENT_SECRET = 'client_secret'
}

/**
 * ActivePieces OAuth credentials interface
 */
export interface IActivepiecesOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * ActivePieces grant types
 */
export type ActivepiecesGrantType = 'authorization_code' | 'refresh_token';

/**
 * ActivePieces user information stored during OAuth flow
 */
export interface IActivepiecesUserInfo {
  userId: string;
  tenantId: string;
  organizationId: string;
  createdAt: Date;
}

/**
 * ActivePieces integration creation input
 */
export interface ICreateActivepiecesIntegrationInput extends IBasePerTenantAndOrganizationEntityModel {
  client_id: string;
  client_secret: string;
  code: string;
  grant_type: ActivepiecesGrantType;
}

/**
 * ActivePieces token request body
 */
export interface IActivepiecesTokenRequest {
  code: string;
  client_id: string;
  client_secret: string;
  grant_type: ActivepiecesGrantType;
}

/**
 * ActivePieces webhook creation input
 */
export interface IActivepiecesCreateWebhookInput {
  targetUrl: string;
  events: string[];
  name?: string;
  active?: boolean;
}

/**
 * ActivePieces webhook subscription creation input
 */
export interface IActivepiecesWebhookSubscriptionCreate {
  targetUrl: string;
  events: string;
  integrationId: ID;
  tenantId: ID;
  organizationId: ID;
}

/**
 * ActivePieces webhook data structure
 */
export interface IActivepiecesWebhookData {
  tenantId: string;
  organizationId: string;
  eventType: string;
  data: any;
  timestamp?: string;
}

/**
 * ActivePieces API response wrapper
 */
export interface IActivepiecesApiResponse<T> {
  data: T;
  meta?: {
    cursor?: string;
    limit?: number;
    total?: number;
  };
}

/**
 * ActivePieces error response
 */
export interface IActivepiecesErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
