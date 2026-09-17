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
import { IPickList, IPickWave, PickWaveStatus, PickWaveStrategy } from '../warehouse.types';
import { PickList } from '../pick-list/pick-list.entity';
import { MikroOrmPickWaveRepository } from './repository/mikro-orm-pick-wave.repository';

/**
 * A batch of picking work released to the floor together.
 *
 * Batching is what turns a day of single-line shipments into a few passes down the aisle, and the
 * wave is also the unit an operator releases, assigns, watches and closes. It never spans locations:
 * a wave is a walk through one building.
 *
 * `orderCount` and `lineCount` are caches of what the wave's pick lists cover. They are re-derived
 * from those lists, never incremented blindly, because a counter that drifts is worse than no
 * counter — it is believed.
 */
@MultiORMEntity('pick_wave', { mikroOrmRepository: () => MikroOrmPickWaveRepository })
export class PickWave extends TenantOrganizationBaseEntity implements IPickWave {
	/** The location the work happens in. A wave never spans locations. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: false })
	warehouseId?: ID;

	/** The sales channel the wave was planned for; absent when it spans channels. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	channelId?: ID;

	/** The allocated wave number, unique inside the location. */
	@ApiProperty({ type: () => String, maxLength: 32 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(32)
	@ColumnIndex()
	@MultiORMColumn({ length: 32 })
	number: string;

	/** How the generator grouped the work: one shipment, a pickup window, a zone, or a cluster of bins. */
	@ApiProperty({ type: () => String, enum: PickWaveStrategy, default: PickWaveStrategy.BATCH })
	@IsOptional()
	@IsEnum(PickWaveStrategy)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PickWaveStrategy.BATCH })
	strategy: PickWaveStrategy;

	/** Where the wave is in its lifecycle. It moves forward only. */
	@ApiProperty({ type: () => String, enum: PickWaveStatus, default: PickWaveStatus.DRAFT })
	@IsOptional()
	@IsEnum(PickWaveStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: PickWaveStatus.DRAFT })
	status: PickWaveStatus;

	/** Higher wins when two waves compete for the same picker or the same area. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/** When the wave is meant to start, driven by the carrier cut-off of the shipments it covers. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	plannedAt?: Date;

	/** When the wave became work on the floor. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	releasedAt?: Date;

	/** When the first line of the wave was picked. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	/** When the last line of the wave was picked. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	completedAt?: Date;

	/** Cache of the distinct orders the wave covers, re-derived from its pick lists. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	orderCount: number;

	/** Cache of the lines the wave covers, re-derived from the pick list lines. */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	lineCount: number;

	/**
	 * Optimistic-lock counter. Picking is fast and several devices write the same wave, so every
	 * transition takes the version it read and bumps it.
	 */
	@ApiProperty({ type: () => Number, default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Tenant extras: the labour estimate, the tote count, the planner's criteria. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The location the wave is worked in. */
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
	 * The operator the wave is assigned to, when the whole wave belongs to one person.
	 *
	 * Declared as a plain relation id: the user belongs to the platform's identity model, which this
	 * plugin reads by id rather than by mapping a second copy of it.
	 */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Column the relation is stored in; named explicitly so the database column is `pickerUserId`. */
		joinColumn: 'pickerUserId'
	})
	@JoinColumn({ name: 'pickerUserId' })
	picker?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: PickWave) => it.picker)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pickerUserId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/** The lists the wave was split into. Cancelling the wave cancels them with it. */
	@ApiPropertyOptional({ type: () => PickList, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => PickList, (it) => it.wave, { cascade: true })
	pickLists?: IPickList[];
}
