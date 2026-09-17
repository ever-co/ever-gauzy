import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
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
import { DecimalString, ID, IUser, IWarehouse } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	User,
	Warehouse
} from '@gauzy/core';
import { IPackSlip, IPickList, IPickListLine, PackSlipStatus } from '../warehouse.types';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import { PickList } from '../pick-list/pick-list.entity';
import { MikroOrmPackSlipRepository } from './repository/mikro-orm-pack-slip.repository';

/**
 * The packing record: which picked lines went into which package, what the package weighs, and which
 * carrier label was produced.
 *
 * It closes the loop between picking and the shipment, and it is the weight of record — never
 * recomputed from the catalogue after the fact, because a re-weigh is a new packing event and not an
 * edit of a document a carrier has already been given. That is also why a `PACKED` slip is immutable:
 * a re-pack cancels it and creates a new one, so the first packing survives in the history.
 *
 * A slip carries **no manifest reference**. A manifest covers shipments, a shipment may contain
 * several packages, and the shipment is the row that knows which carrier took it — so the membership
 * link is `fulfillment.metadata.manifestId` and this table stays a record of packaging alone.
 */
@MultiORMEntity('pack_slip', { mikroOrmRepository: () => MikroOrmPackSlipRepository })
export class PackSlip extends TenantOrganizationBaseEntity implements IPackSlip {
	/** The location the packing happened at. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	warehouseId?: ID;

	/**
	 * The order the packed goods were sold on, denormalised for the packing bench's screen.
	 *
	 * Declared as a plain relation id: the order domain owns it, and this plugin reads it through the
	 * platform service layer rather than by mapping another domain's entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/** The shipment the package belongs to. Declared as a plain relation id, as above. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	fulfillmentId?: ID;

	/** The allocated slip number, unique inside the location. */
	@ApiProperty({ type: () => String, maxLength: 32 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ length: 32 })
	number: string;

	/** Where the slip is in its lifecycle: `OPEN`, then `PACKED` or `CANCELED`, and nothing between. */
	@ApiProperty({ type: () => String, enum: PackSlipStatus, default: PackSlipStatus.OPEN })
	@IsOptional()
	@IsEnum(PackSlipStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: PackSlipStatus.OPEN })
	status: PackSlipStatus;

	/** The shipping-provider key that will carry the package, as the shipping configuration names it. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64, nullable: true })
	carrierKey?: string;

	/** How many parcels the packing produced. At least one: a shipment always leaves in something. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	packageCount: number;

	/** Packed items plus packaging; this is what carrier rating reads. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "2.4500".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 12, scale: 4, nullable: true })
	totalWeight?: DecimalString;

	/** Total volume of the parcels, in the organization's volume unit. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "0.1200".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 12, scale: 4, nullable: true })
	totalVolume?: DecimalString;

	/**
	 * The carrier's tracking number, filled when the label is produced. Unique per carrier, which is
	 * what stops the same label being attached to two packages.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ColumnIndex()
	@MultiORMColumn({ length: 255, nullable: true })
	trackingNumber?: string;

	/** The stored label document, when the carrier integration produced one. */
	@ApiPropertyOptional({ type: () => String, maxLength: 1024 })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	@MultiORMColumn({ length: 1024, nullable: true })
	labelUrl?: string;

	/** When the parcels were sealed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	packedAt?: Date;

	/** An operator note: the parcel was re-taped, a promotional insert was added. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/** Optimistic-lock counter; packing and cancelling take the version they read and bump it. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Tenant extras: the package identifiers, the packaging materials, the bench that packed it. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The work that was packed, when packing follows a pick list. */
	@ApiPropertyOptional({ type: () => PickList })
	@IsOptional()
	@MultiORMManyToOne(() => PickList, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	pickList?: IPickList;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PackSlip) => it.pickList)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pickListId?: ID;

	/** The location the packing happened at. */
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

	/** The operator who sealed the parcels. */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Column the relation is stored in; named explicitly so the database column is `packedByUserId`. */
		joinColumn: 'packedByUserId'
	})
	@JoinColumn({ name: 'packedByUserId' })
	packedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PackSlip) => it.packedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	packedByUserId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** The picked lines that went into this slip. */
	@ApiPropertyOptional({ type: () => PickListLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => PickListLine, (it) => it.packSlip)
	lines?: IPickListLine[];
}
