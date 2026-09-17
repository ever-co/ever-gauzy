import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
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
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	Warehouse
} from '@gauzy/core';
import { IWarehouseBin, IWarehouseZone, WarehouseZoneType } from '../warehouse.types';
import { WarehouseBin } from '../warehouse-bin/warehouse-bin.entity';
import { MikroOrmWarehouseZoneRepository } from './repository/mikro-orm-warehouse-zone.repository';

/**
 * A named area of one stock location.
 *
 * Zones are what give the building a shape: a receiving area, a reserve area, the forward-pick face a
 * pick list is routed through, the packing bench, the staging lane and the dock a manifest is handed
 * over at. Two things read them. The pick path reads `priority`, because the order the zones are
 * visited in is the order the walk happens in, and put-away reads `isReceivable` / `isPickable` and
 * the temperature window, because not every area may hold every kind of goods.
 *
 * A zone that goes out of service is blocked rather than deleted, and blocking never moves the stock
 * inside it: the record has to be able to say "these units are here and nobody may touch them", which
 * is a different fact from "these units are gone".
 */
@MultiORMEntity('warehouse_zone', { mikroOrmRepository: () => MikroOrmWarehouseZoneRepository })
export class WarehouseZone extends TenantOrganizationBaseEntity implements IWarehouseZone {
	/**
	 * What the area is called on the floor.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ length: 255 })
	name: string;

	/**
	 * The tenant's own key for the area, unique inside the location. A bin code printed on a pick list
	 * is built from it, so it is the part of the address a person says out loud.
	 */
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ length: 64 })
	code: string;

	/**
	 * What the area is for. The value selects behaviour — allocation, pick-path generation, put-away
	 * and the returns triage each read it — rather than merely describing the area.
	 */
	@ApiProperty({ type: () => String, enum: WarehouseZoneType, default: WarehouseZoneType.STORAGE })
	@IsOptional()
	@IsEnum(WarehouseZoneType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: WarehouseZoneType.STORAGE })
	type: WarehouseZoneType;

	/**
	 * Visiting order in the pick path. Lower is visited first, and the service rewrites the sequence
	 * wholesale when an operator reorders the zones, so no two zones of one type share a position.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Whether the bins in this area may be picked from. A receiving or staging area holds units that
	 * are physically present and not yet available, which is why it is not pickable.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	isPickable: boolean;

	/** Whether the bins in this area may receive stock from a receipt or a transfer. */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isReceivable: boolean;

	/** Whether packed goods leave the location from this area. */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isShippable: boolean;

	/**
	 * Out of service for a stocktake, maintenance or a rebuild. The allocator treats the bins inside as
	 * unavailable, and the units already in them stay exactly where they are.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ type: 'boolean', default: false })
	isBlocked: boolean;

	/** Cold-chain lower bound in degrees Celsius, when the area is temperature controlled. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "2.00".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 6, scale: 2, nullable: true })
	minTemperature?: DecimalString;

	/** Cold-chain upper bound in degrees Celsius. */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, e.g. "8.00".' })
	@IsOptional()
	@IsNumberString()
	@MultiORMColumn({ type: 'decimal', precision: 6, scale: 2, nullable: true })
	maxTemperature?: DecimalString;

	/**
	 * Optimistic-lock counter. Every transition and every edit bumps it, so two operators editing the
	 * same area cannot silently overwrite each other.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Tenant extras: the dock, the equipment type, the labour standard for the area. */
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
	 * The stock location this area is part of.
	 *
	 * Immutable: a zone is part of one building, and moving it would silently re-address every
	 * historical pick that named one of its bins.
	 */
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: WarehouseZone) => it.warehouse)
	@ColumnIndex()
	@MultiORMColumn({ nullable: false, relationId: true })
	warehouseId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** The positions inside this area. */
	@ApiPropertyOptional({ type: () => WarehouseBin, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => WarehouseBin, (it) => it.zone)
	bins?: IWarehouseBin[];
}
