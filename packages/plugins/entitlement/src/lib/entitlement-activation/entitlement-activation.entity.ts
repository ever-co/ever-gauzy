import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { EntitlementActivationStatus } from '../entitlement.enums';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { MikroOrmEntitlementActivationRepository } from './repository/mikro-orm-entitlement-activation.repository';

/**
 * One device, instance or named user occupying a slot of an entitlement.
 *
 * An activation is the scarce resource an activation limit counts, and it is what a support agent
 * revokes when a customer replaces a machine. It is a row rather than a counter on the entitlement
 * for that reason: "who held a seat, and until when" has to survive the release, and a revoked
 * activation is immutable — re-activating the same device is a **new** row, which is exactly why the
 * unique constraint over the live rows is partial on `status = 'ACTIVE'`.
 */
@MultiORMEntity('entitlement_activation', {
	mikroOrmRepository: () => MikroOrmEntitlementActivationRepository
})
export class EntitlementActivation extends TenantOrganizationBaseEntity {
	/**
	 * The right this activation occupies a slot of.
	 */
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
	@RelationId((it: EntitlementActivation) => it.entitlement)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	entitlementId: ID;

	/**
	 * The key that was used, when activation went through a licence key.
	 *
	 * Kept as a relation because the key is this package's own row and the audit question — "which
	 * credential opened this slot" — is asked of the pair. Revoking the key nulls this column rather
	 * than deleting the activation, so the history of who held a slot survives the credential.
	 */
	@ApiPropertyOptional({ type: () => EntitlementKey })
	@IsOptional()
	@MultiORMManyToOne(() => EntitlementKey, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	entitlementKey?: EntitlementKey;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: EntitlementActivation) => it.entitlementKey)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	entitlementKeyId?: ID;

	/**
	 * Stable device or instance identifier reported by the client.
	 *
	 * This is the identity the limit is counted over, which is why it is a column and not a blob in
	 * `metadata`: a seat check that had to parse a document would not be enforceable by an index.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ length: 255 })
	deviceId: string;

	/** Human-readable name shown to support ("Ana's laptop"). */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	deviceName?: string;

	/** Hash of the hardware or instance fingerprint, used to detect a re-installed device claiming a new identifier. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	fingerprint?: string;

	/** The named seat this activation occupies (a user e-mail, a hostname) when the right is seat-based. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	seatReference?: string;

	/**
	 * The buyer who performed the activation, when it came from a logged-in customer rather than from
	 * a licence key. Carried as an identifier with a foreign key: the party is the kernel's row.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	activatedByCustomerId?: ID;

	/** What the activation is doing with its slot. */
	@ApiProperty({ type: () => String, enum: EntitlementActivationStatus, default: EntitlementActivationStatus.ACTIVE })
	@IsEnum(EntitlementActivationStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EntitlementActivationStatus.ACTIVE })
	status: EntitlementActivationStatus;

	/** When the slot was taken. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	activatedAt: Date;

	/** Refreshed by validation calls, at most once per configured interval; the dormancy release reads it. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	lastSeenAt?: Date;

	/** A clean release by the holder. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	deactivatedAt?: Date;

	/** A release imposed by support or by a policy. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	revokedAt?: Date;

	/** The operator who imposed the release. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	revokedByUserId?: ID;

	/** Why the slot was taken away, which the licence audit reports beside the release. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	revocationReason?: string;

	/** Address of the validation call that created the activation. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64, nullable: true })
	ipAddress?: string;

	/** Client identification, retained for support. */
	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	@MultiORMColumn({ length: 512, nullable: true })
	userAgent?: string;

	/** Tenant extras: product version, operating system, locale. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
