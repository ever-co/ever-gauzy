import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	IsArray,
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
import { DecimalString, ID, IUser } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { IPackSlip, IPickList, IPickListLine, IWarehouseBin, IWarehouseZone, PickListLineStatus } from '../warehouse.types';
import { PackSlip } from '../pack-slip/pack-slip.entity';
import { PickList } from '../pick-list/pick-list.entity';
import { WarehouseBin } from '../warehouse-bin/warehouse-bin.entity';
import { WarehouseZone } from '../warehouse-zone/warehouse-zone.entity';
import { MikroOrmPickListLineRepository } from './repository/mikro-orm-pick-list-line.repository';

/**
 * One line to pick: what, how much, from which bin, and what actually happened.
 *
 * This is the row the picker's device writes and the row the whole quantity invariant is stated over:
 * `quantityPicked + quantityShort = quantityRequested` for every line that was not withdrawn. It is
 * also the point where the physical warehouse and the ledger meet, and they meet in one direction
 * only — **picking does not move stock**, because the level was already decremented when the shipment
 * consumed its reservations. The one exception is the short pick: a bin that held less than the list
 * asked for is a stock error, and the missing quantity is corrected through the inventory capability
 * in the same transaction as the line, so the ledger never keeps claiming goods the bin does not hold.
 *
 * A substitution is recorded here and priced by the order change that authorises it, never by this
 * table, so the money model stays in one place.
 */
@MultiORMEntity('pick_list_line', { mikroOrmRepository: () => MikroOrmPickListLineRepository })
export class PickListLine extends TenantOrganizationBaseEntity implements IPickListLine {
	/**
	 * The order line this pick satisfies, denormalised for reporting. Declared as a plain relation id:
	 * the order domain owns it, and this plugin reads it rather than mapping another domain's entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	orderLineId?: ID;

	/**
	 * The fulfilment line this pick satisfies; absent on a replenishment or transfer pick.
	 *
	 * Declared as a plain relation id, as above; the shipment capability is read through the port.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	fulfillmentLineId?: ID;

	/**
	 * The sellable unit expected in the bin. `RESTRICT` on delete: a variant that a pick named cannot
	 * be removed while the row that says where it was taken from still exists.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	variantId?: ID;

	/** What the list asks for. */
	@ApiProperty({ type: () => String, description: 'Exact decimal string, e.g. "2.000000".' })
	@IsNotEmpty()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6 })
	quantityRequested: DecimalString;

	/** What was actually collected. */
	@ApiProperty({ type: () => String, default: '0.000000' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	quantityPicked: DecimalString;

	/** The shortfall, set when the bin did not hold the requested quantity. */
	@ApiProperty({ type: () => String, default: '0.000000' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, default: 0 })
	quantityShort: DecimalString;

	/** What happened on the floor. */
	@ApiProperty({ type: () => String, enum: PickListLineStatus, default: PickListLineStatus.PENDING })
	@IsOptional()
	@IsEnum(PickListLineStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: PickListLineStatus.PENDING })
	status: PickListLineStatus;

	/** The variant actually taken, when it is not the one requested. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	substituteVariantId?: ID;

	/** How much of the substitute was taken. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "1.000000".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	substituteQuantity?: DecimalString;

	/** Why the substitute is acceptable: same size, next colour, the supplier's replacement part. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255, nullable: true })
	substitutionReason?: string;

	/** Position in the sorted pick path: zone priority, then the bin coordinates, then the sort order. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/** When the line was confirmed. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	pickedAt?: Date;

	/** The lot or batch scanned at picking, when the variant is lot-tracked. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ length: 64, nullable: true })
	lotNumber?: string;

	/** Expiry taken from the scanned lot. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ type: 'date', nullable: true })
	expiryDate?: Date;

	/** The serials scanned for a serial-tracked variant. */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@MultiORMColumn({ type: 'simple-array', nullable: true })
	serialNumbers?: string[];

	/** Free-text reason an operator types: what the shelf actually looked like. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/** Tenant extras: the scanned barcode, the alternate bins the device offered. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The list the line belongs to. `CASCADE` on delete: a line has no meaning without its list, and
	 * deleting one is refused while it has recorded outcomes rather than silently orphaning them.
	 */
	@ApiPropertyOptional({ type: () => PickList })
	@IsOptional()
	@MultiORMManyToOne(() => PickList, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: false,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	pickList?: IPickList;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickListLine) => it.pickList)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	pickListId?: ID;

	/**
	 * The bin the allocator chose, or the one the picker corrected it to. Absent while unassigned, and
	 * the foreign key is `SET NULL` so a bin that was removed leaves the history of *what* was picked
	 * intact while saying nothing about where.
	 */
	@ApiPropertyOptional({ type: () => WarehouseBin })
	@IsOptional()
	@MultiORMManyToOne(() => WarehouseBin, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	bin?: IWarehouseBin;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickListLine) => it.bin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	binId?: ID;

	/** The area the bin is in, denormalised so the sorted path needs no second join. */
	@ApiPropertyOptional({ type: () => WarehouseZone })
	@IsOptional()
	@MultiORMManyToOne(() => WarehouseZone, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	zone?: IWarehouseZone;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickListLine) => it.zone)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	zoneId?: ID;

	/** The slip the picked quantity went into, written when packing closes the loop. */
	@ApiPropertyOptional({ type: () => PackSlip })
	@IsOptional()
	@MultiORMManyToOne(() => PackSlip, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	packSlip?: IPackSlip;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickListLine) => it.packSlip)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	packSlipId?: ID;

	/** The operator who confirmed the line. */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Column the relation is stored in; named explicitly so the database column is `pickedByUserId`. */
		joinColumn: 'pickedByUserId'
	})
	@JoinColumn({ name: 'pickedByUserId' })
	pickedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickListLine) => it.pickedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pickedByUserId?: ID;
}
