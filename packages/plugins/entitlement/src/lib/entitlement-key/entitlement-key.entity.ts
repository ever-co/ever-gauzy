import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import {
	ColumnIndex,
	IsSecret,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { EntitlementKeyStatus, LicenceKeyFormat } from '../entitlement.enums';
import { Entitlement } from '../entitlement/entitlement.entity';
import { MikroOrmEntitlementKeyRepository } from './repository/mikro-orm-entitlement-key.repository';

/**
 * An issued licence key: the string a customer types into the product.
 *
 * The row is what makes a database dump worthless to a thief. The key itself is never stored: the
 * lookup column is its SHA-256 digest, computed once at issuance, and `keyCiphertext` holds the
 * encrypted form **only** when the operator asked to be able to re-display it. The plaintext leaves
 * the service exactly once, in the response to the issuance call, and never appears in a log, an
 * export or an event payload.
 *
 * A key may be revoked individually without revoking the right behind it, because the right and the
 * credential are different things: revoking a key releases the activations that reference it and
 * re-derives the counters, and the entitlement keeps whatever it granted.
 */
@MultiORMEntity('entitlement_key', { mikroOrmRepository: () => MikroOrmEntitlementKeyRepository })
export class EntitlementKey extends TenantOrganizationBaseEntity {
	/** The right this credential is issued against. */
	@ApiProperty({ type: () => Entitlement })
	@IsNotEmpty()
	@MultiORMManyToOne(() => Entitlement, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	entitlement: Entitlement;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EntitlementKey) => it.entitlement)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	entitlementId: ID;

	/**
	 * SHA-256 of the key, hex encoded.
	 *
	 * This is the lookup column, and the key is the identity, so the digest is unique inside the
	 * organization. Validation therefore never scans and never decrypts: one indexed probe finds the
	 * key, and decryption happens only when an operator asks to see it.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64 })
	keyHash: string;

	/**
	 * The key encrypted at rest, so support can re-display it to its holder.
	 *
	 * Marked secret so that no serializer or log line can carry it, and null for a key issued
	 * write-only — which is then unrecoverable by design, and recovered by re-issuing it.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	@IsSecret()
	@MultiORMColumn({ length: 512, nullable: true })
	keyCiphertext?: string;

	/** The leading characters in clear, so an agent can identify a key a customer reads out. */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ length: 16, nullable: true })
	keyPrefix?: string;

	/** Which generator produced it, recorded so that a future format change cannot invalidate the old keys. */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64, default: LicenceKeyFormat.UUID })
	format: string;

	/** What the credential may still be used for. */
	@ApiProperty({ type: () => String, enum: EntitlementKeyStatus, default: EntitlementKeyStatus.ISSUED })
	@IsEnum(EntitlementKeyStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EntitlementKeyStatus.ISSUED })
	status: EntitlementKeyStatus;

	/** When the key was handed to its holder. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	assignedAt?: Date;

	/** The recipient of the key, when it was delivered to someone. */
	@ApiPropertyOptional({ type: () => String, maxLength: 320 })
	@IsOptional()
	@IsEmail()
	@MaxLength(320)
	@MultiORMColumn({ length: 320, nullable: true })
	assignedToEmail?: string;

	/** The party the key is assigned to, carried as an identifier with a foreign key into the party kernel. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	assignedToCustomerId?: ID;

	/** Per-key override of the entitlement's activation limit; null inherits the entitlement's. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	activationLimit?: number;

	/** Live activations of this key, as a cache the usage audit re-derives from the activation rows. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	activationCount: number;

	/** The key's own expiry, which may be earlier than the entitlement's. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/** When it was withdrawn. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	revokedAt?: Date;

	/** The operator who withdrew it. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	revokedByUserId?: ID;

	/**
	 * Tenant extras.
	 *
	 * `replacedKeyId` and `replacedByKeyId` are written here when a key is re-issued, so the pair
	 * stays linked and "what happened to the key the customer was given" has one answer forever — a
	 * key is never re-assigned to a second holder.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
