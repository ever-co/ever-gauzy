import { isMySQL, isPostgres } from '@gauzy/config';
import { IUser } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Index, JoinColumn, RelationId, VersionColumn } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { BaseEntity, User } from '../../core/entities/internal';
import { IToken, TokenStatus } from '../interfaces';

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
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
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
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	user: IUser;

	/**
	 * Determines if the token is currently active based on its status
	 * @return true if token is active, false otherwise
	 */
	public isActivated(): boolean {
		return this.status === TokenStatus.ACTIVE;
	}

	/**
	 * Determines if this token can be revoked.
	 * 	A token can be revoked only if it's active and not already revoked or expired.
	 */
	public canRevoke(): boolean {
		return this.canRotate() && this.revokedAt === null;
	}

	/**
	 * Determines if this token can be rotated to a new token.
	 * A token can be rotated only if it's active and not expired.
	 *
	 * @returns {boolean} True if the token can be rotated, false otherwise
	 */
	public canRotate(): boolean {
		return this.isActivated() && this.isExpired() === false;
	}

	/**
	 * Checks if the token has expired based on the expiresAt timestamp.
	 *
	 * @returns {boolean} True if the token is expired, false if not expired or no expiration set
	 */
	public isExpired(): boolean {
		if (!this.expiresAt) return false;
		return new Date() > this.expiresAt;
	}

	/**
	 * Determines if the token has been inactive for longer than the specified threshold.
	 *
	 * @param {number} threshold - Time in milliseconds to consider a token inactive
	 * @returns {boolean} True if the token has been inactive longer than threshold, false otherwise
	 */
	public isInactive(threshold: number): boolean {
		if (!this.lastUsedAt) return false;
		const now = Date.now();
		const lastUsed = this.lastUsedAt.getTime();
		return now - lastUsed > threshold;
	}
}
