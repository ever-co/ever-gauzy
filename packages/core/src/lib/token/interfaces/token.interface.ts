import { IBaseEntityModel, IPagination, IUser } from '@gauzy/contracts';

export enum TokenStatus {
	ACTIVE = 'ACTIVE',
	REVOKED = 'REVOKED',
	EXPIRED = 'EXPIRED',
	ROTATED = 'ROTATED'
}

// Token Configuration
export interface ITokenConfig {
	tokenType: string;
	expiration?: number; // null means no expiration
	threshold?: number; // null means no inactivity check
	allowRotation: boolean;
	allowMultipleSessions: boolean;
	maxUsageCount?: number;
}

// Token Data Transfer Objects
export interface ICreateTokenDto {
	userId: IUser['id'];
	tokenType: string;
	metadata?: Record<string, any>;
	expiresAt?: Date;
}

export interface IRotateTokenDto {
	rawOldToken?: string;
	userId: IUser['id'];
	tokenType: string;
	metadata?: Record<string, any>;
}

export interface IRevokeTokenDto {
	rawToken?: string;
	revokedById?: string;
	reason?: string;
}

export interface IValidateTokenDto {
	rawToken?: string;
	tokenType: string;
	checkInactivity?: boolean;
}

export interface ITokenPayload {
	userId: IUser['id'];
	tokenType: string;
	tokenId: string;
	metadata?: Record<string, any>;
}

export interface IGeneratedToken {
	token: string; // The actual JWT
	tokenId: IToken['id'];
	expiresAt: Date | null;
	createdAt: Date;
}

export interface IValidatedToken {
	isValid: boolean;
	token?: ITokenPayload;
	reason?: string;
}

export interface IToken extends IBaseEntityModel {
	tokenHash: string;
	tokenType: string;
	user: IUser;
	userId: IUser['id'];
	status: TokenStatus;
	expiresAt: Date | null;
	lastUsedAt: Date | null;
	usageCount: number;
	rotatedFromTokenId: string | null;
	rotatedToTokenId: string | null;
	rotatedFromToken: IToken | null;
	rotatedToToken: IToken | null;
	revokedAt: Date | null;
	revokedReason: string | null;
	revokedBy: IUser | null;
	revokedById: IUser['id'] | null;
	metadata: Record<string, any> | string | null;
	version: number;

	/**
	 * Determines if the token is currently active based on its status
	 * @return true if token is active, false otherwise
	 */
	isActivated(): boolean;
	/**
	 * Determines if the token can be rotated based on its status and configuration
	 * @return true if token can be rotated, false otherwise
	 */
	canRotate(): boolean;

	/**
	 * Determines if the token can be revoked based on its status
	 * @return true if token can be revoked, false otherwise
	 */
	canRevoke(): boolean;
	/**
	 * Determines if the token is expired based on current time and expiresAt
	 * @return true if token is expired, false otherwise
	 */
	isExpired(): boolean;
	/**
	 * Determines if the token is inactive based on last used timestamp and threshold
	 * @param threshold Inactivity threshold in milliseconds
	 * @return true if token is inactive, false otherwise
	 */
	isInactive(threshold: number): boolean;
}

export type ITokenQueryResult = IPagination<IToken>;

export interface ITokenFilters {
	userId?: IUser['id'];
	tokenType?: string;
	status?: TokenStatus;
	createdAfter?: Date;
	createdBefore?: Date;
}
