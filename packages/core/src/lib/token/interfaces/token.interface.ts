import { IBaseEntityModel, IPagination, IUser } from '@gauzy/contracts';

export enum TokenStatus {
	ACTIVE = 'ACTIVE',
	REVOKED = 'REVOKED',
	EXPIRED = 'EXPIRED',
	ROTATED = 'ROTATED'
}

// ---------------------------------------------------------------------------
// Token Configuration
// ---------------------------------------------------------------------------

export interface ITokenConfig {
	tokenType: string;
	expiration?: number; // undefined means no expiration (ms)
	threshold?: number; // undefined means no inactivity check (ms)
	allowRotation: boolean;
	allowMultipleSessions: boolean;
	maxUsageCount?: number;
}

// ---------------------------------------------------------------------------
// Data Transfer Objects
// ---------------------------------------------------------------------------

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

export interface IBulkRevokeTokenDto {
	userId: IUser['id'];
	tokenType?: string; // revoke all types when omitted
	reason?: string;
	revokedById?: string;
}

export interface IExtendTokenDto {
	rawToken: string;
	userId: IUser['id'];
	additionalMs: number; // milliseconds to add to current expiry
}

export interface ITransferTokenDto {
	rawToken: string;
	fromUserId: IUser['id'];
	toUserId: IUser['id'];
	reason?: string;
}

// ---------------------------------------------------------------------------
// Payload & Result shapes
// ---------------------------------------------------------------------------

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

export interface ITokenUsageSummary {
	tokenId: IToken['id'];
	userId: IUser['id'];
	tokenType: string;
	usageCount: number;
	lastUsedAt: Date | null;
	createdAt: Date;
	expiresAt: Date | null;
	/** Remaining lifetime in milliseconds; null when the token never expires. */
	remainingTime: number | null;
}

export interface ITokenRotationChain {
	/** The first token ever issued in this lineage. */
	root: IToken;
	/** All tokens in the chain ordered from oldest to newest. */
	chain: IToken[];
	/** The currently active token in the chain, if any. */
	current: IToken | null;
	depth: number;
}

export interface ITokenHealthReport {
	tokenId: IToken['id'];
	isActive: boolean;
	isExpired: boolean;
	isInactive: boolean;
	canRotate: boolean;
	canRevoke: boolean;
	isAtUsageLimit: boolean;
	/** Summary of any issues found; empty array means the token is healthy. */
	issues: string[];
}

// ---------------------------------------------------------------------------
// Core Token entity
// ---------------------------------------------------------------------------

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
	metadata: Record<string, any> | null;
	version: number;

	// -----------------------------------------------------------------------
	// Status predicates
	// -----------------------------------------------------------------------

	/**
	 * Determines if the token is currently active based on its status.
	 * @returns true if status is ACTIVE, false otherwise.
	 */
	isActivated(): boolean;

	/**
	 * Determines if the token is in a terminal state (REVOKED, EXPIRED, or ROTATED)
	 * and therefore can never be used again.
	 * @returns true if the token is in a terminal state.
	 */
	isTerminal(): boolean;

	/**
	 * Determines whether this token has been superseded by a newer one via rotation.
	 * @returns true if status is ROTATED.
	 */
	isRotated(): boolean;

	/**
	 * Determines whether the token has been explicitly revoked.
	 * @returns true if status is REVOKED.
	 */
	isRevoked(): boolean;

	/**
	 * Determines if the token is expired based on current time and expiresAt.
	 * @returns true if token is expired, false otherwise.
	 */
	isExpired(): boolean;

	/**
	 * Determines if the token is inactive based on last used timestamp and threshold.
	 * @param threshold Inactivity threshold in milliseconds.
	 * @returns true if token is inactive, false otherwise.
	 */
	isInactive(threshold: number): boolean;

	/**
	 * Determines whether the token has reached or exceeded its maximum allowed usage count.
	 * @param maxUsageCount Maximum number of times this token may be used.
	 * @returns true if the usage limit has been reached.
	 */
	isAtUsageLimit(maxUsageCount: number): boolean;

	/**
	 * Returns true only when the token is active, not expired, and within its
	 * usage limit. Use this as a single gate before trusting a presented token.
	 * @param config Partial token configuration used for limit checks.
	 * @returns true if the token is fully valid for use right now.
	 */
	isUsable(config: Pick<ITokenConfig, 'maxUsageCount' | 'threshold'>): boolean;

	// -----------------------------------------------------------------------
	// Lifecycle transitions
	// -----------------------------------------------------------------------

	/**
	 * Determines if the token can be rotated based on its status and configuration.
	 * @returns true if token can be rotated, false otherwise.
	 */
	canRotate(): boolean;

	/**
	 * Determines if the token can be revoked based on its status.
	 * @returns true if token can be revoked, false otherwise.
	 */
	canRevoke(): boolean;

	/**
	 * Determines whether the token's expiry date can be extended.
	 * Tokens that have no expiry, are already terminal, or whose type does not
	 * permit extension should return false.
	 * @returns true if the expiry may be pushed forward.
	 */
	canExtend(): boolean;

	// -----------------------------------------------------------------------
	// Lineage & traceability
	// -----------------------------------------------------------------------

	/**
	 * Returns true when this token was produced by rotating another token,
	 * i.e. rotatedFromTokenId is non-null.
	 * @returns true if the token has a parent in the rotation chain.
	 */
	hasParent(): boolean;

	/**
	 * Returns true when this token has already been rotated into a successor,
	 * i.e. rotatedToTokenId is non-null.
	 * @returns true if the token has a child in the rotation chain.
	 */
	hasSuccessor(): boolean;

	/**
	 * Returns true when this token is the very first in its rotation lineage
	 * (rotatedFromTokenId is null).
	 * @returns true if this is a root token.
	 */
	isRootToken(): boolean;

	// -----------------------------------------------------------------------
	// Temporal helpers
	// -----------------------------------------------------------------------

	/**
	 * Calculates the remaining lifetime of the token in milliseconds.
	 * @returns Milliseconds until expiry, 0 if already expired, or null if the
	 *          token never expires.
	 */
	getRemainingTime(): number | null;

	/**
	 * Calculates how many milliseconds have elapsed since the token was last used.
	 * @returns Elapsed milliseconds since last use, or null if the token has
	 *          never been used.
	 */
	getInactivityTime(): number | null;

	/**
	 * Calculates how many milliseconds have elapsed since the token was created.
	 * @returns Token age in milliseconds.
	 */
	getAgeTime(): number;

	// -----------------------------------------------------------------------
	// Metadata helpers
	// -----------------------------------------------------------------------

	/**
	 * Retrieves a typed value from the token's metadata by key.
	 * @param key The metadata field name.
	 * @returns The value cast to T, or undefined if the key is absent.
	 */
	getMetadataValue<T = unknown>(key: string): T | undefined;

	/**
	 * Returns true when the token carries a non-null, non-empty metadata object.
	 * @returns true if metadata is present.
	 */
	hasMetadata(): boolean;

	// -----------------------------------------------------------------------
	// Diagnostics
	// -----------------------------------------------------------------------

	/**
	 * Produces a human-readable summary of the token's current state, suitable
	 * for logging and debugging (must never include the raw token hash).
	 * @returns A plain-object snapshot of the token's observable state.
	 */
	toDebugInfo(): Record<string, unknown>;

	/**
	 * Runs a full health check against the given configuration and returns a
	 * structured report of the token's validity and any issues detected.
	 * @param config Token configuration used for limit and threshold checks.
	 * @returns A structured health report.
	 */
	getHealthReport(config: Pick<ITokenConfig, 'maxUsageCount' | 'threshold'>): ITokenHealthReport;
}

// ---------------------------------------------------------------------------
// Query & filter types
// ---------------------------------------------------------------------------

export type ITokenQueryResult = IPagination<IToken>;

export interface ITokenFilters {
	userId?: IUser['id'];
	tokenType?: string;
	status?: TokenStatus;
	createdAfter?: Date;
	createdBefore?: Date;
	/** Include only tokens whose lastUsedAt is before this date. */
	lastUsedBefore?: Date;
	/** Include only tokens whose lastUsedAt is after this date. */
	lastUsedAfter?: Date;
	/** Include only tokens expiring before this date. */
	expiresBeforeDate?: Date;
	/** Include only non-expiring tokens. */
	neverExpires?: boolean;
	/** Include only tokens whose usageCount is at or above this value. */
	minUsageCount?: number;
	/** Include only tokens that are part of a rotation chain. */
	hasParent?: boolean;
}
