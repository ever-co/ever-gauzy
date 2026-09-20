import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FulfillmentDirection, FulfillmentStatusDetail, ID, IFulfillment } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	VersionedColumn
} from '@gauzy/core';
import { FulfillmentLine } from '../fulfillment-line/fulfillment-line.entity';
import { MikroOrmFulfillmentRepository } from './repository/mikro-orm-fulfillment.repository';

/**
 * One shipment against an order, with its own lifecycle.
 *
 * The fulfilment's lifecycle is **independent of the order's**: an order stays `PROCESSING` while
 * several fulfilments come and go, and a delivered fulfilment is never cancelled — a return is created
 * instead, as a fulfilment whose `direction` is `RETURN`. That is why the status moves forward only and
 * why `CANCELED` is reachable only from `PENDING` or `SHIPPED`.
 *
 * A fulfilment is also the point at which stock actually moves: creating one consumes the matching
 * reservations and writes the sale movements in the same transaction, and cancelling one re-creates
 * them. The stock ledger itself belongs to the inventory package; this table records what shipped.
 */
@MultiORMEntity('fulfillment', { mikroOrmRepository: () => MikroOrmFulfillmentRepository })
export class Fulfillment extends TenantOrganizationBaseEntity implements IFulfillment {
	/** The order this shipment is against. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** Outbound to the customer, or a return back to a warehouse. */
	@ApiProperty({ type: () => String, enum: FulfillmentDirection })
	@IsEnum(FulfillmentDirection)
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', enum: FulfillmentDirection, default: FulfillmentDirection.OUTBOUND })
	direction: FulfillmentDirection;

	/** The location the goods left from. Re-allocatable until the shipment is dispatched. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	warehouseId?: ID;

	/**
	 * The seller that shipped this, when one seller's goods are on it.
	 *
	 * One seller per shipment: a fulfilment that covered two sellers' lines would make the carrier label,
	 * the shipping revenue and the seller-scoped reads disagree about whose goods moved. Held as an id
	 * rather than as a relation because `seller` belongs to the marketplace package; the constraint onto
	 * it is added by that package's set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	sellerId?: ID;

	/** The carrier or fulfilment provider key. It names a registered strategy, not an integration row. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	providerId?: string;

	/** Where the shipment is in its own lifecycle. */
	@ApiProperty({ type: () => String, enum: FulfillmentStatusDetail })
	@IsEnum(FulfillmentStatusDetail)
	@ColumnIndex()
	@MultiORMColumn({
		type: 'simple-enum',
		enum: FulfillmentStatusDetail,
		default: FulfillmentStatusDetail.PENDING
	})
	status: FulfillmentStatusDetail;

	/** The tracking number the carrier issued. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	trackingNumber?: string;

	/** Where the buyer can follow the shipment. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 1024 })
	trackingUrl?: string;

	/** The carrier's name. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	carrier?: string;

	/** The service level the shipment was sent at. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	service?: string;

	/** The label the carrier returned. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 1024 })
	labelUrl?: string;

	/** The label payload: the document reference and its dimensions. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	labelData?: Record<string, unknown>;

	/** When the shipment was handed to the carrier. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	shippedAt?: Date;

	/** When the carrier reported delivery. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	deliveredAt?: Date;

	/** When the shipment was cancelled. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** False for a digital delivery, such as a licence key. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShipping: boolean;

	/** Suppresses the customer notification for this shipment. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	noNotification: boolean;

	/** A note about the shipment. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	note?: string;

	/**
	 * Optimistic lock: every transition takes an entity tag and bumps this counter.
	 *
	 * Declared with `@VersionedColumn()` rather than as a plain column because this row is the one a
	 * caller reads and writes back — two people working the same shipment off one screen would
	 * otherwise silently overwrite each other, and the second write would erase the first without
	 * anyone being told. The decorator states the same definition both ORMs receive, and the increment
	 * is applied by `commitVersionedUpdate` in the same statement that checks it, never by a service
	 * after a read: a counter bumped in application code is exactly the read-then-write window the
	 * conditional update exists to close.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@VersionedColumn()
	version: number;

	/** Open-ended payload for the carrier's own identifiers. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** What is in the shipment. */
	@MultiORMOneToMany(() => FulfillmentLine, (it) => it.fulfillment, { onDelete: 'CASCADE' })
	lines?: FulfillmentLine[];
}
