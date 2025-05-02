import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId, JoinTable } from 'typeorm';
import { IsNumber, IsDateString, IsUUID, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import {
	ITimeSlot,
	ITimeSlotMinute,
	IActivity,
	IScreenshot,
	IEmployee,
	ITimeLog,
	ID,
	JsonData
} from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { Activity, Employee, Screenshot, TenantOrganizationBaseEntity, TimeLog } from './../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	VirtualMultiOrmColumn
} from './../../core/decorators/entity';
import { TimeSlotMinute } from './time-slot-minute/time-slot-minute.entity';
import { MikroOrmTimeSlotRepository } from './repository/mikro-orm-time-slot.repository';

@MultiORMEntity('time_slot', { mikroOrmRepository: () => MikroOrmTimeSlotRepository })
export class TimeSlot extends TenantOrganizationBaseEntity implements ITimeSlot {
	/**
	 * The number of seconds employee spent in the given time slot.
	 * Defaults to 0 if not provided.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'The number of seconds employee spent in the given time slot',
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ default: 0 })
	duration?: number;

	/**
	 * The number of keyboard interactions in the given time slot minute.
	 * Defaults to 0 if not provided.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Number of keyboard interactions in the given time slot.',
		example: 42,
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	keyboard?: number;

	/**
	 * The number of mouse interactions in the given time slot minute.
	 * Defaults to 0 if not provided.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Number of mouse interactions in the given time slot.',
		example: 42,
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	mouse?: number;

	/**
	 * Number of movements (e.g., mouse or device movements) detected within 10 minutes.
	 * Used to track activity levels during time tracking sessions.
	 */
	@ApiPropertyOptional({
		type: Number,
		description: 'Number of movements detected in 10 minutes',
		example: 42,
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	location?: number;

	/**
	 * The overall activity time of the time slot.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
	@MultiORMColumn({ default: 0 })
	overall?: number;

	/**
	 * The start time of the time slot.
	 */
	@ApiProperty({ type: () => 'timestamptz' })
	@IsNotEmpty()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn()
	startedAt: Date;

	/**
	 * Raw keyboard and mouse activity data (e.g., event logs or durations).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	kbMouseActivity?: JsonData;

	/**
	 * Raw location activity data (e.g., coordinates or movement patterns).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	locationActivity?: JsonData;

	/**
	 * Custom-defined activity data (e.g., domain-specific or extension usage).
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({
		type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text',
		nullable: true
	})
	customActivity?: JsonData;

	// The stopped time of the time slot.
	@VirtualMultiOrmColumn()
	stoppedAt?: Date;

	// The percentage of interactions in the given time slot.
	@VirtualMultiOrmColumn()
	percentage?: number;

	// The percentage of keyboard interactions in the given time slot.
	@VirtualMultiOrmColumn()
	keyboardPercentage?: number;

	// The percentage of mouse interactions in the given time slot.
	@VirtualMultiOrmColumn()
	mousePercentage?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The reference to the `Employee` entity to which this time slot belongs.
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.timeSlots, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	/**
	 * The ID of the related `Employee` entity, stored as a UUID.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeSlot) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * The reference to the `Screenshot` entity to which this time slot belongs.
	 */
	@MultiORMOneToMany(() => Screenshot, (it) => it.timeSlot, { cascade: true })
	screenshots?: IScreenshot[];

	/**
	 * The reference to the `Activity` entity to which this time slot belongs.
	 */
	@MultiORMOneToMany(() => Activity, (it) => it.timeSlot, { cascade: true })
	activities?: IActivity[];

	/**
	 * The reference to the `TimeSlotMinute` entity to which this time slot belongs.
	 */
	@MultiORMOneToMany(() => TimeSlotMinute, (it) => it.timeSlot, { cascade: true })
	timeSlotMinutes?: ITimeSlotMinute[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * The reference to the `TimeLog` entity to which this time slot belongs.
	 */
	@MultiORMManyToMany(() => TimeLog, (it) => it.timeSlots, {
		/**  Database cascade action on update. */
		onUpdate: 'CASCADE',
		/** Database cascade action on delete. */
		onDelete: 'CASCADE',
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'time_slot_time_logs',
		/** Column in pivot table referencing 'time_slot' primary key. */
		joinColumn: 'timeSlotId',
		/** Column in pivot table referencing 'time_logs' primary key. */
		inverseJoinColumn: 'timeLogId'
	})
	@JoinTable({ name: 'time_slot_time_logs' })
	timeLogs?: ITimeLog[];
}
