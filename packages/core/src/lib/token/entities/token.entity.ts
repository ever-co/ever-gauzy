import { IUser } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Index, JoinColumn, RelationId, VersionColumn } from 'typeorm';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne
} from '../../core/decorators/entity';
import { BaseEntity, User } from '../../core/entities/internal';
import { IToken, ITokenConfig, ITokenHealthReport, TokenStatus } from '../interfaces';

@Index(['tokenHash'], { unique: true })
@Index(['tokenHash', 'status'])
@Index(['userId', 'tokenType', 'status'])
@Index(['expiresAt'])
@MultiORMEntity('tokens')
export class Token extends BaseEntity implements IToken {
	@ApiProperty({
		type: String,
		maxLength: 255,
		description: 'Hashed token value for secure storage and lookup',
		example: 'a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0'
	})
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: false })
	tokenHash: string;

	@ApiProperty({
		type: String,
		maxLength: 50,
		description: 'Type of token (e.g., access, refresh, reset_password, email_verification)',
		example: 'access_token',
		enum: ['access_token', 'refresh_token', 'reset_password', 'email_verification', 'api_key']
	})
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 50, nullable: false })
	tokenType: string;

	@ApiProperty({
		enum: TokenStatus,
		enumName: 'TokenStatus',
		description: 'Current status of the token',
		example: TokenStatus.ACTIVE,
		default: TokenStatus.ACTIVE
	})
	@IsEnum(TokenStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: TokenStatus, default: TokenStatus.ACTIVE })
	status: TokenStatus;

	@ApiPropertyOptional({
		type: Date,
		description: 'Timestamp when the token expires. Null means no expiration.',
		example: '2025-02-16T23:59:59.999Z',
		nullable: true
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	@MultiORMColumn({ nullable: true })
	expiresAt: Date | null;

	@ApiPropertyOptional({
		type: Date,
		description: 'Timestamp of the last time this token was used for authentication or authorization',
		example: '2025-02-16T14:30:00.000Z',
		nullable: true
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	@MultiORMColumn({ nullable: true })
	lastUsedAt: Date | null;

	@ApiProperty({
		type: Number,
		description: 'Number of times this token has been used',
		example: 42,
		default: 0,
		minimum: 0
	})
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	usageCount: number;

	@ApiPropertyOptional({
		type: String,
		format: 'uuid',
		description: 'UUID of the token that was rotated to create this token (for token rotation tracking)',
		example: '550e8400-e29b-41d4-a716-446655440000',
		nullable: true
	})
	@IsOptional()
	@IsUUID('4', { message: 'rotatedFromTokenId must be a valid UUID v4' })
	@RelationId((token: Token) => token.rotatedFromToken)
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ nullable: true, relationId: true })
	rotatedFromTokenId: string | null;

	@ApiPropertyOptional({
		type: () => Token,
		description: 'Reference to the previous token in the rotation chain',
		nullable: true
	})
	@MultiORMManyToOne(() => Token, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	rotatedFromToken: IToken | null;

	@ApiPropertyOptional({
		type: String,
		format: 'uuid',
		description: 'UUID of the token that replaced this token (for token rotation tracking)',
		example: '660e8400-e29b-41d4-a716-446655440001',
		nullable: true
	})
	@IsOptional()
	@IsUUID('4', { message: 'rotatedToTokenId must be a valid UUID v4' })
	@RelationId((token: Token) => token.rotatedToToken)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	rotatedToTokenId: string | null;

	@ApiPropertyOptional({
		type: () => Token,
		description: 'Reference to the next token in the rotation chain',
		nullable: true
	})
	@MultiORMManyToOne(() => Token, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	rotatedToToken: IToken | null;

	@ApiPropertyOptional({
		type: Date,
		description: 'Timestamp when the token was revoked. Null if token is not revoked.',
		example: '2025-02-16T10:15:30.000Z',
		nullable: true
	})
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	@MultiORMColumn({ nullable: true })
	revokedAt: Date | null;

	@ApiPropertyOptional({
		type: String,
		maxLength: 255,
		description: 'Reason for token revocation (e.g., "User logout", "Security breach", "Token rotation")',
		example: 'User requested password reset',
		nullable: true
	})
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	revokedReason: string | null;

	@ApiPropertyOptional({
		type: String,
		format: 'uuid',
		description: 'UUID of the user who revoked this token',
		example: '770e8400-e29b-41d4-a716-446655440002',
		nullable: true
	})
	@IsOptional()
	@IsUUID('4', { message: 'revokedById must be a valid UUID v4' })
	@RelationId((token: Token) => token.revokedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	revokedById: IUser['id'] | null;

	@ApiPropertyOptional({
		type: () => User,
		description: 'User who revoked this token',
		nullable: true
	})
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	revokedBy: IUser | null;

	@ApiPropertyOptional({
		type: Object,
		description: 'Additional metadata stored as JSON (e.g., device info, IP address, user agent, mac)',
		example: {
			clientId: 'abc123',
			deviceType: 'mobile',
			userAgent: 'Mozilla/5.0...',
			location: 'New York, US'
		},
		nullable: true
	})
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata: Record<string, any> | null;

	@ApiProperty({
		type: Number,
		description: 'Version number for optimistic locking (automatically incremented on updates)',
		example: 1,
		readOnly: true
	})
	@VersionColumn()
	version: number;

	@ApiProperty({
		type: String,
		format: 'uuid',
		description: 'UUID of the user who owns this token',
		example: '880e8400-e29b-41d4-a716-446655440003'
	})
	@IsUUID('4', { message: 'userId must be a valid UUID v4' })
	@RelationId((token: Token) => token.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	userId: string;

	@ApiProperty({
		type: () => User,
		description: 'User who owns this token'
	})
	@MultiORMManyToOne(() => User, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user: IUser;

	// ---------------------------------------------------------------------------
	// Status predicates
	// ---------------------------------------------------------------------------

	/**
	 * Determines if the token is currently active based on its status.
	 * @returns true if status is ACTIVE, false otherwise.
	 */
	public isActivated(): boolean {
		return this.status === TokenStatus.ACTIVE;
	}

	/**
	 * Determines if the token is in a terminal state (REVOKED, EXPIRED, or ROTATED)
	 * and therefore can never be used again.
	 * @returns true if the token is in a terminal state.
	 */
	public isTerminal(): boolean {
		return (
			this.status === TokenStatus.REVOKED ||
			this.status === TokenStatus.EXPIRED ||
			this.status === TokenStatus.ROTATED
		);
	}

	/**
	 * Determines whether this token has been superseded by a newer one via rotation.
	 * @returns true if status is ROTATED.
	 */
	public isRotated(): boolean {
		return this.status === TokenStatus.ROTATED;
	}

	/**
	 * Determines whether the token has been explicitly revoked.
	 * @returns true if status is REVOKED.
	 */
	public isRevoked(): boolean {
		return this.status === TokenStatus.REVOKED;
	}

	/**
	 * Checks if the token has expired based on the expiresAt timestamp.
	 * @returns true if the token is expired, false if not expired or no expiration set.
	 */
	public isExpired(): boolean {
		if (!this.expiresAt) return false;
		return new Date() > this.expiresAt;
	}

	/**
	 * Determines if the token has been inactive for longer than the specified threshold.
	 * @param threshold Time in milliseconds to consider a token inactive.
	 * @returns true if the token has been inactive longer than threshold, false otherwise.
	 */
	public isInactive(threshold: number): boolean {
		if (!this.lastUsedAt) return false;
		return Date.now() - this.lastUsedAt.getTime() > threshold;
	}

	/**
	 * Determines whether the token has reached or exceeded its maximum allowed usage count.
	 * @param maxUsageCount Maximum number of times this token may be used.
	 * @returns true if the usage limit has been reached.
	 */
	public isAtUsageLimit(maxUsageCount: number): boolean {
		return this.usageCount >= maxUsageCount;
	}

	/**
	 * Returns true only when the token is active, not expired, and within its usage limit.
	 * Use this as a single gate before trusting a presented token.
	 * @param config Partial token configuration used for limit checks.
	 * @returns true if the token is fully valid for use right now.
	 */
	public isUsable(config: Pick<ITokenConfig, 'maxUsageCount' | 'threshold'>): boolean {
		if (!this.isActivated()) return false;
		if (this.isExpired()) return false;
		if (config.maxUsageCount != null && this.isAtUsageLimit(config.maxUsageCount)) return false;
		if (config.threshold != null && this.isInactive(config.threshold)) return false;
		return true;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle transitions
	// ---------------------------------------------------------------------------

	/**
	 * Determines if this token can be rotated to a new token.
	 * A token can be rotated only if it's active and not expired.
	 * @returns true if token can be rotated, false otherwise.
	 */
	public canRotate(): boolean {
		return this.isActivated() && !this.isExpired();
	}

	/**
	 * Determines if this token can be revoked.
	 * A token can be revoked only if it's active, not expired, and not already revoked.
	 * @returns true if token can be revoked, false otherwise.
	 */
	public canRevoke(): boolean {
		return this.canRotate() && this.revokedAt === null;
	}

	/**
	 * Determines whether the token's expiry date can be extended.
	 * Only active, non-terminal tokens with an existing expiry date can be extended.
	 * @returns true if the expiry may be pushed forward.
	 */
	public canExtend(): boolean {
		return this.isActivated() && !this.isTerminal() && this.expiresAt !== null;
	}

	// ---------------------------------------------------------------------------
	// Lineage & traceability
	// ---------------------------------------------------------------------------

	/**
	 * Returns true when this token was produced by rotating another token.
	 * @returns true if the token has a parent in the rotation chain.
	 */
	public hasParent(): boolean {
		return this.rotatedFromTokenId !== null;
	}

	/**
	 * Returns true when this token has already been rotated into a successor.
	 * @returns true if the token has a child in the rotation chain.
	 */
	public hasSuccessor(): boolean {
		return this.rotatedToTokenId !== null;
	}

	/**
	 * Returns true when this token is the very first in its rotation lineage.
	 * @returns true if this is a root token.
	 */
	public isRootToken(): boolean {
		return this.rotatedFromTokenId === null;
	}

	// ---------------------------------------------------------------------------
	// Temporal helpers
	// ---------------------------------------------------------------------------

	/**
	 * Calculates the remaining lifetime of the token in milliseconds.
	 * @returns Milliseconds until expiry, 0 if already expired, or null if the token never expires.
	 */
	public getRemainingTime(): number | null {
		if (!this.expiresAt) return null;
		return Math.max(0, this.expiresAt.getTime() - Date.now());
	}

	/**
	 * Calculates how many milliseconds have elapsed since the token was last used.
	 * @returns Elapsed milliseconds since last use, or null if the token has never been used.
	 */
	public getInactivityTime(): number | null {
		if (!this.lastUsedAt) return null;
		return Date.now() - this.lastUsedAt.getTime();
	}

	/**
	 * Calculates how many milliseconds have elapsed since the token was created.
	 * @returns Token age in milliseconds.
	 */
	public getAgeTime(): number {
		return Date.now() - this.createdAt.getTime();
	}

	// ---------------------------------------------------------------------------
	// Metadata helpers
	// ---------------------------------------------------------------------------

	/**
	 * Retrieves a typed value from the token's metadata by key.
	 * @param key The metadata field name.
	 * @returns The value cast to T, or undefined if the key is absent.
	 */
	public getMetadataValue<T = unknown>(key: string): T | undefined {
		if (!this.metadata) return undefined;
		return (key in this.metadata ? this.metadata[key] : undefined) as T | undefined;
	}

	/**
	 * Returns true when the token carries a non-null, non-empty metadata object.
	 * @returns true if metadata is present.
	 */
	public hasMetadata(): boolean {
		return this.metadata !== null && Object.keys(this.metadata).length > 0;
	}

	// ---------------------------------------------------------------------------
	// Diagnostics
	// ---------------------------------------------------------------------------

	/**
	 * Produces a human-readable summary of the token's current state suitable for
	 * logging and debugging. Never includes the raw token hash.
	 * @returns A plain-object snapshot of the token's observable state.
	 */
	public toDebugInfo(): Record<string, unknown> {
		return {
			tokenId: this.id,
			tokenType: this.tokenType,
			userId: this.userId,
			status: this.status,
			usageCount: this.usageCount,
			expiresAt: this.expiresAt?.toISOString() ?? null,
			lastUsedAt: this.lastUsedAt?.toISOString() ?? null,
			revokedAt: this.revokedAt?.toISOString() ?? null,
			revokedReason: this.revokedReason,
			rotatedFromTokenId: this.rotatedFromTokenId,
			rotatedToTokenId: this.rotatedToTokenId,
			isRootToken: this.isRootToken(),
			remainingMs: this.getRemainingTime(),
			ageMs: this.getAgeTime(),
			version: this.version,
			createdAt: this.createdAt?.toISOString() ?? null,
			updatedAt: this.updatedAt?.toISOString() ?? null
		};
	}

	/**
	 * Runs a full health check against the given configuration and returns a
	 * structured report of the token's validity and any issues detected.
	 * @param config Token configuration used for limit and threshold checks.
	 * @returns A structured health report.
	 */
	public getHealthReport(config: Pick<ITokenConfig, 'maxUsageCount' | 'threshold'>): ITokenHealthReport {
		const expired = this.isExpired();
		const inactive = config.threshold != null ? this.isInactive(config.threshold) : false;
		const atLimit = config.maxUsageCount != null ? this.isAtUsageLimit(config.maxUsageCount) : false;
		const issues: string[] = [];

		if (!this.isActivated()) {
			issues.push(`Token is not active (status: ${this.status})`);
		}
		if (expired) {
			issues.push(`Token expired at ${this.expiresAt!.toISOString()}`);
		}
		if (inactive) {
			issues.push(
				`Token has been inactive for ${this.getInactivityTime()} ms (threshold: ${config.threshold} ms)`
			);
		}
		if (atLimit) {
			issues.push(`Token has reached usage limit of ${config.maxUsageCount} (current: ${this.usageCount})`);
		}

		return {
			tokenId: this.id,
			isActive: this.isActivated(),
			isExpired: expired,
			isInactive: inactive,
			canRotate: this.canRotate(),
			canRevoke: this.canRevoke(),
			isAtUsageLimit: atLimit,
			issues
		};
	}
}
