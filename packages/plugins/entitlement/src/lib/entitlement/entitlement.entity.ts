import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	OrganizationContact,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { EntitlementKind, EntitlementStatus } from '../entitlement.enums';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { MikroOrmEntitlementRepository } from './repository/mikro-orm-entitlement.repository';

/**
 * The right a purchase granted, and the only row a validation call has to believe.
 *
 * Everything else in this package hangs off this row: an activation occupies one of its seats, a key
 * is a credential issued against it, and the check answers from its state, its term and its
 * counters. It is therefore written once, by the grant path, and afterwards only ever changes state
 * — a right is never edited into a different right, and a withdrawn one is never revived, so what a
 * customer was entitled to at any instant stays answerable.
 *
 * Note what is *not* here. There is no `isPerpetual` flag: a null `endsAt` is the perpetual case, and
 * a boolean that must agree with a date would be a second source of truth for one fact. There is no
 * `usedSeats` counter: the seats in use are the live activation rows, counted, which is what keeps
 * the number from drifting. And there is no conditions column: the conditions attached to a right are
 * `rule` rows evaluated by the platform rule engine, exactly as they are for every other conditional
 * capability.
 */
@MultiORMEntity('entitlement', { mikroOrmRepository: () => MikroOrmEntitlementRepository })
export class Entitlement extends TenantOrganizationBaseEntity {
	/**
	 * The party the right was granted to.
	 *
	 * A relation rather than a bare identifier, because the party is a kernel entity this package may
	 * map; every other reference below points at another capability's table and is therefore carried
	 * as an identifier with a foreign key, never as a second mapping of that table.
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@IsOptional()
	@MultiORMManyToOne(() => OrganizationContact, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	customer?: OrganizationContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Entitlement) => it.customer)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	customerId?: ID;

	/** The order that granted the right. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/** The line that granted it; with `orderId` this is the full provenance of the right. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	orderLineId?: ID;

	/** The subscription that renews it, when a billing cycle rather than a one-off order keeps it alive. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	subscriptionId?: ID;

	/** The catalogue item the right is over, by identifier. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	productId?: ID;

	/** The variant the right is over, when it is over one. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	variantId?: ID;

	/** Human-readable number, unique inside the organization, so a customer can quote one right. */
	@ApiProperty({ type: () => String, maxLength: 32 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ length: 32 })
	number: string;

	/** What the purchase granted, which decides what `quantity` counts. */
	@ApiProperty({ type: () => String, enum: EntitlementKind, default: EntitlementKind.LICENCE })
	@IsEnum(EntitlementKind)
	@MultiORMColumn({ type: 'varchar', length: 16, default: EntitlementKind.LICENCE })
	kind: EntitlementKind;

	/**
	 * How many of the thing the right carries: seats for `SEAT`, allowed uses for `USAGE`, and `1`
	 * for the single right of a `LICENCE` or a `TERM`. `0` means unlimited.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 1 })
	quantity: number;

	/** The instant the right becomes exercisable. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	startsAt: Date;

	/** The instant it stops being exercisable. Null is the perpetual case — a licence bought outright. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/** Days after `endsAt` during which the right stays in force while a renewal is chased. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	gracePeriodDays: number;

	/** Maximum simultaneous activations, when that is tighter than `quantity`. Null adds no limit. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', nullable: true })
	activationLimit?: number;

	/**
	 * Live activations, as a cache re-derived from `entitlement_activation` by the usage audit.
	 *
	 * It exists so that the activation ceiling is one row read rather than a count on the hot path;
	 * the seats in use are never stored, because a stored count is the one that drifts.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	activationCount: number;

	/** Where the right is in its life. */
	@ApiProperty({ type: () => String, enum: EntitlementStatus, default: EntitlementStatus.PENDING })
	@IsEnum(EntitlementStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: EntitlementStatus.PENDING })
	status: EntitlementStatus;

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

	/** Why: a platform reason such as `REFUNDED`, or an operator's own note. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	revokedReason?: string;

	/** `PAYMENT_FAILED` when dunning suspended the right, or an operator's own note. Cleared on resume. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	suspendedReason?: string;

	/** Tenant extras: the licence tier, the feature flags the right carries, the dunning watermark. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** The devices, instances and named seats occupying the right's slots. */
	@ApiPropertyOptional({ type: () => EntitlementActivation, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => EntitlementActivation, (it) => it.entitlement, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	activations?: EntitlementActivation[];

	/** The credentials issued against the right. */
	@ApiPropertyOptional({ type: () => EntitlementKey, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => EntitlementKey, (it) => it.entitlement, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	keys?: EntitlementKey[];
}
