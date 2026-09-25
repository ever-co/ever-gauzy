import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId, Tree, TreeChildren, TreeParent } from 'typeorm';
import {
	IsBoolean,
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
import { IWarehouseBin, IWarehouseZone, WarehouseBinType } from '../warehouse.types';
import { WarehouseZone } from '../warehouse-zone/warehouse-zone.entity';
import { MikroOrmWarehouseBinRepository } from './repository/mikro-orm-warehouse-bin.repository';

/**
 * One addressable storage position inside a zone: an aisle, a rack, a level, a pallet position, a
 * floor area.
 *
 * Bins form a tree, and the tree is a closure table, so "everything under rack B" is one indexed join
 * rather than a recursive query. The position's coordinates — `aisle`, `rack`, `level`, `position` —
 * are columns rather than a parsed path because they are what a person reads out and what the sorted
 * pick path orders by when the tree alone does not decide the walk.
 *
 * `capacityUnits`, `maxWeight` and `maxVolume` are planning limits. Put-away *warns* on them rather
 * than enforcing them, because a real warehouse overfills a bin and the record has to be able to say
 * so; a bin that may not be picked from at all is a different fact and is expressed with
 * `isPickable`.
 *
 * Each of the three limits states the unit it is expressed in — `capacityUnitId`, `maxWeightUnitId`
 * and `maxVolumeUnitId`. Without them the same physical limit could be entered as `1` by an operator
 * thinking in pallets and read as `1` by a request thinking in pieces, and both readers would be
 * right about a different question. A null unit stays what the column always meant: a count nobody
 * has yet declared the unit of.
 */
@MultiORMEntity('warehouse_bin', { mikroOrmRepository: () => MikroOrmWarehouseBinRepository })
@Tree('closure-table')
export class WarehouseBin extends TenantOrganizationBaseEntity implements IWarehouseBin {
	/**
	 * Denormalised from the zone so the pick query never has to join twice to reach the location.
	 * Immutable, like the zone: physical shelving that moves is a new bin, not an edited one.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: WarehouseBin) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	warehouseId?: ID;

	/**
	 * The label printed on the pick list. Unique inside its location, and immutable once a pick list
	 * has printed it — a picker walking to a document that names a code the building no longer uses is
	 * how a shipment ends up wrong.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	code: string;

	/** The barcode scanned at put-away and at picking, unique per organization when it is set. */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64, nullable: true })
	barcode?: string;

	/**
	 * The kind of position this is. The type says what the handling unit is — a whole pallet, a
	 * small-batch container, a floor stack — and therefore which capacity check applies to it.
	 */
	@ApiProperty({ type: () => String, enum: WarehouseBinType, default: WarehouseBinType.SHELF })
	@IsOptional()
	@IsEnum(WarehouseBinType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: WarehouseBinType.SHELF })
	type: WarehouseBinType;

	/**
	 * Whether stock may be picked out of this position. A rack that exists only to hold the levels
	 * under it is not pickable while its levels are.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: 'boolean', default: true })
	isPickable: boolean;

	/**
	 * Out of service. The allocator skips it, the stock already in it stays where it is, and the count
	 * job reports the difference — blocking is how a bin is taken out of rotation without pretending
	 * the units in it are gone.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: 'boolean', default: false })
	isBlocked: boolean;

	/** Maximum units the bin holds; absent means unlimited, which is a real configuration. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "500.000000".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 20, scale: 6, nullable: true })
	capacityUnits?: DecimalString;

	/**
	 * The unit `capacityUnits` is counted in.
	 *
	 * A capacity is a quantity in a stated unit and never a bare number: a bin whose handling unit is a
	 * pallet and a request expressed in pieces cannot be compared without one, and the comparison is
	 * what the put-away allocator and the low-stock tie-break make their decisions on. A null unit is
	 * an **uninterpreted count** — the behaviour every bin had before the column existed — and a bin
	 * that declares a capacity without one is reported by the capacity job rather than guessed at,
	 * because guessing would silently redefine every capacity an operator has already entered.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	capacityUnitId?: ID;

	/** Weight ceiling in `maxWeightUnitId`. A planning limit, warned on rather than enforced. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "1200.0000".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 12, scale: 4, nullable: true })
	maxWeight?: DecimalString;

	/**
	 * The mass unit `maxWeight` is expressed in; null means the organization's configured default mass
	 * unit. Four decimals is a statement about storage and the unit is a statement about meaning.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	maxWeightUnitId?: ID;

	/** Volume ceiling, in `maxVolumeUnitId`. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "3.5000".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 12, scale: 4, nullable: true })
	maxVolume?: DecimalString;

	/**
	 * The volume unit `maxVolume` is expressed in; null means the organization's configured default
	 * volume unit.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	maxVolumeUnitId?: ID;

	/** Physical coordinate, used for the sorted pick path when the tree alone is not enough. */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ length: 32, nullable: true })
	aisle?: string;

	/** Physical coordinate, as above. */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ length: 32, nullable: true })
	rack?: string;

	/** Physical coordinate, as above. */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ length: 32, nullable: true })
	level?: string;

	/** Physical coordinate, as above. */
	@ApiPropertyOptional({ type: () => String, maxLength: 32 })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ length: 32, nullable: true })
	position?: string;

	/** Tie-break inside the parent, which is what keeps the walk stable between two bins of one rack. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder: number;

	/** Optimistic-lock counter: re-parenting, blocking and re-coding all bump it. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Tenant extras: display colours, handling instructions, the aisle map's own labels. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The area the position sits in. Nullable, because a bin outlives the zone it was filed under. */
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
	@RelationId((it: WarehouseBin) => it.zone)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	zoneId?: ID;

	/** The location the position belongs to. Immutable, like the zone. */
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

	/**
	 * The bin this position hangs under; null for a root, which is an aisle or a whole floor area.
	 *
	 * The parent is expressed with the tree decorators so the ORM knows this entity is a closure tree;
	 * `parentId` below is the column itself, and the service maintains the closure rows for every
	 * re-parent so the move is atomic with the write.
	 */
	@ApiPropertyOptional({ type: () => WarehouseBin })
	@IsOptional()
	@TreeParent({ onDelete: 'SET NULL' })
	@JoinColumn({ name: 'parentId' })
	parent?: WarehouseBin;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: WarehouseBin) => it.parent)
	@ColumnIndex()
	// A persisted column on both ORMs, not a relation id: the parent is TypeORM's tree relation only, and
	// `relationId: true` would map this `persist: false` on MikroORM with no relation behind it, so the
	// parent was dropped on every MikroORM write and read back empty.
	@MultiORMColumn({ nullable: true })
	parentId?: ID;

	/** The positions directly under this one. */
	@ApiPropertyOptional({ type: () => WarehouseBin, isArray: true })
	@IsOptional()
	@TreeChildren()
	children?: WarehouseBin[];
}
