import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn } from 'typeorm';
import {
	IsDate,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumberString,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min
} from 'class-validator';
import { DecimalString, ID, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { CarrierManifestStatus, ICarrierManifest } from '../warehouse.types';
import { MikroOrmCarrierManifestRepository } from './repository/mikro-orm-carrier-manifest.repository';

/**
 * The manifest is the document a carrier accepts: the parcels handed over at one dock, at one time,
 * with one scan. It is what makes "did the carrier receive it?" answerable and what a claim is filed
 * against — the custody boundary, where everything before it was our responsibility and everything
 * after it is theirs.
 *
 * Membership is **derived while the manifest is a draft and frozen at close**. A draft resolves its
 * members as every shipment at the location with the matching carrier and service, shipped inside the
 * manifest's window and not yet claimed by another manifest; closing writes the manifest id onto each
 * of those shipments in one transaction, which is what stops a parcel appearing on two manifests.
 *
 * That is also why this table carries no member table and no column on the fulfilment side beyond the
 * metadata key: a manifest covers shipments, a shipment may contain several packages, and the
 * shipment is the row that knows who took it.
 */
@MultiORMEntity('carrier_manifest', { mikroOrmRepository: () => MikroOrmCarrierManifestRepository })
export class CarrierManifest extends TenantOrganizationBaseEntity implements ICarrierManifest {
	/** The location the parcels were handed over at. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	warehouseId?: ID;

	/** The carrier code, exactly as it is written on the shipment records it groups. */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	carrier: string;

	/** The service level, when the manifest covers one; absent means every service of that carrier. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64, nullable: true })
	service?: string;

	/** The allocated manifest number, unique inside the location. */
	@ApiProperty({ type: () => String, maxLength: 32 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ length: 32 })
	number: string;

	/** Where the manifest is in its lifecycle. `HANDED_OVER` is terminal and is never cancelled. */
	@ApiProperty({ type: () => String, enum: CarrierManifestStatus, default: CarrierManifestStatus.DRAFT })
	@IsOptional()
	@IsEnum(CarrierManifestStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: CarrierManifestStatus.DRAFT })
	status: CarrierManifestStatus;

	/** The dispatch day the manifest covers. */
	@ApiProperty({ type: () => Date })
	@IsOptional()
	@IsDate()
	@ColumnIndex()
	@MultiORMColumn({ type: 'date' })
	manifestDate: Date;

	/** Start of the window a draft collects shipments from. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	windowFrom?: Date;

	/** End of that window, exclusive. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	windowTo?: Date;

	/** Cache of the member shipments, frozen at close and re-derived by the reconciliation job. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	shipmentCount: number;

	/** Cache of the packages inside those shipments, frozen at close. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	packageCount: number;

	/** Sum of the members' packed weights, frozen at close. */
	@ApiProperty({ type: () => String, default: '0.0000' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 12, scale: 4, default: 0 })
	totalWeight: DecimalString;

	/** When membership was frozen. No parcel may be added after this. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	closedAt?: Date;

	/** When the carrier accepted the parcels at the dock. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	handedOverAt?: Date;

	/** When the manifest was withdrawn, before hand-over only. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	/** The rendered manifest document, when a caller asked the platform to render one. */
	@ApiPropertyOptional({ type: () => String, maxLength: 1024 })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ length: 1024, nullable: true })
	documentUrl?: string;

	/** The same document as data: the payload is always available as JSON. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	documentData?: Record<string, unknown>;

	/** An operator note kept beside the hand-over. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/** Optimistic-lock counter; closing, handing over and cancelling take the version they read. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/**
	 * Tenant extras. The keys this domain writes are `carrierAccount`, `memberFulfillmentIds[]`,
	 * `scanCount`, `reconciliation[]` and `handedOverByUserId`; a parcel the carrier scanned that is not
	 * on the manifest is recorded in `reconciliation[]` and reported, never appended silently.
	 *
	 * `memberFulfillmentIds[]` is written by the close and is the frozen membership itself: the record
	 * every later read of a closed manifest answers with, so a parcel shipped inside the same window
	 * after the close is not reported as one of the parcels that were handed over.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The location the parcels left from. */
	@ApiPropertyOptional({ type: () => Warehouse })
	@IsOptional()
	@MultiORMManyToOne(() => Warehouse, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	warehouse?: IWarehouse;
}
