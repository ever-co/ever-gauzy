import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { ID, IUser, IWarehouse } from '@gauzy/contracts';
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
import { IPickList, IPickListLine, PickListStatus } from '../warehouse.types';
import { PickListLine } from '../pick-list-line/pick-list-line.entity';
import { PickWave } from '../pick-wave/pick-wave.entity';
import { WarehouseZone } from '../warehouse-zone/warehouse-zone.entity';
import { MikroOrmPickListRepository } from './repository/mikro-orm-pick-list.repository';

/**
 * One list of work for one picker: the lines to collect, in the order the pick path visits their bins.
 *
 * A list is generated from the shipment side — from the fulfilment lines that are due to leave — which
 * is why one order may produce several lists (a partial shipment, or a zone-split pick) and one list
 * may cover several orders (a batch wave). Generation is idempotent per shipment and zone, so a re-run
 * of the generator cannot double the work.
 *
 * `lineCount`, `pickedCount` and `shortCount` are caches of the lines. A list whose lines were closed
 * short still reaches `PICKED`: the shortfall belongs to the lines, and a list that folded the
 * shortfall into its own status would make "may this shipment be packed?" a question with two answers.
 */
@MultiORMEntity('pick_list', { mikroOrmRepository: () => MikroOrmPickListRepository })
export class PickList extends TenantOrganizationBaseEntity implements IPickList {
	/** The location the work happens in. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	warehouseId?: ID;

	/**
	 * The shipment this list serves; absent on a replenishment or transfer list, which serves no order.
	 *
	 * Declared as a plain relation id: the shipment belongs to the fulfilment domain, and this plugin
	 * reads it through the platform service layer rather than by mapping another domain's entity.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	fulfillmentId?: ID;

	/** The order, denormalised for the picker's screen and for reporting. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	orderId?: ID;

	/** The allocated list number, unique inside the location. */
	@ApiProperty({ type: () => String, maxLength: 32 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ length: 32 })
	number: string;

	/** Where the list is in its lifecycle. It moves forward only. */
	@ApiProperty({ type: () => String, enum: PickListStatus, default: PickListStatus.PENDING })
	@IsOptional()
	@IsEnum(PickListStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: PickListStatus.PENDING })
	status: PickListStatus;

	/** Higher wins when one picker holds several lists. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/** Cache of the lines on the list, re-derived from them. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	lineCount: number;

	/** Cache of the lines that reached `PICKED`, whether by a plain pick or by a substitution. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	pickedCount: number;

	/** Cache of the lines that were closed short. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	shortCount: number;

	/** When the picker started walking the list. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	/** When the last line reached an outcome. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;

	/** Picker-facing instruction: which tote, which trolley, what to do about a broken seal. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/** Optimistic-lock counter; every transition takes the version it read and bumps it. */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Tenant extras: the bin sequence walked, the substitutions and short picks the operator saw. */
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
	 * The wave the list was dispatched in. Absent on a list dispatched on its own, which is how a
	 * location that assigns work but does not batch still uses the picking surface.
	 */
	@ApiPropertyOptional({ type: () => PickWave })
	@IsOptional()
	@MultiORMManyToOne(() => PickWave, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	wave?: PickWave;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickList) => it.wave)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	waveId?: ID;

	/** The location the work happens in. */
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

	/** The area the list was split by, when it was split. */
	@ApiPropertyOptional({ type: () => WarehouseZone })
	@IsOptional()
	@MultiORMManyToOne(() => WarehouseZone, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	zone?: WarehouseZone;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickList) => it.zone)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	zoneId?: ID;

	/**
	 * The picker who owns the list. Assigning one freezes the route and the bin order, so the printed
	 * document and the device agree.
	 */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Column the relation is stored in; named explicitly so the database column is `assignedToUserId`. */
		joinColumn: 'assignedToUserId'
	})
	@JoinColumn({ name: 'assignedToUserId' })
	assignee?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickList) => it.assignee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	assignedToUserId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** The lines to collect, in the order the pick path visits them. */
	@ApiPropertyOptional({ type: () => PickListLine, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => PickListLine, (it) => it.pickList, { cascade: true })
	lines?: IPickListLine[];
}
