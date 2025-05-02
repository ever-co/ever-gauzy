import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId, Unique, JoinColumn } from 'typeorm';
import { ID, ITimeSlot, ITimeSlotMinute, JsonData } from '@gauzy/contracts';
import { isMySQL, isPostgres } from '@gauzy/config';
import { IsNumber, IsDateString, IsUUID, IsOptional, IsObject } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../../core/decorators/entity';
import { TimeSlot } from '../time-slot.entity';
import { MikroOrmTimeSlotMinuteRepository } from './repositories/mikro-orm-time-slot-minute.repository';

@MultiORMEntity('time_slot_minute', { mikroOrmRepository: () => MikroOrmTimeSlotMinuteRepository })
@Unique(['timeSlotId', 'datetime'])
export class TimeSlotMinute extends TenantOrganizationBaseEntity implements ITimeSlotMinute {
	/**
	 * The number of keyboard interactions in the given time slot minute.
	 * Defaults to 0 if not provided.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Number of keyboard interactions in the given time slot minute.',
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
		description: 'Number of mouse interactions in the given time slot minute.',
		example: 42,
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	mouse?: number;

	/**
	 * Number of movements (e.g., mouse or device movements) detected within one minute.
	 * Used to track activity levels during time tracking sessions.
	 */
	@ApiPropertyOptional({
		type: Number,
		description: 'Number of movements detected in 1 minute',
		example: 42,
		default: 0
	})
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	location?: number;

	/**
	 * The specific datetime for this time slot minute.
	 * It records the exact minute in which the activity was tracked.
	 */
	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@MultiORMColumn()
	datetime!: Date;

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

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne Relationship
	|--------------------------------------------------------------------------
	*/
	/**
	 * The reference to the `TimeSlot` entity to which this minute belongs.
	 * This establishes a many-to-one relationship with the `TimeSlot` entity.
	 * The deletion of a `TimeSlot` cascades down to its `TimeSlotMinute` records.
	 */
	@MultiORMManyToOne(() => TimeSlot, (timeSlot) => timeSlot.timeSlotMinutes, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot!: ITimeSlot;

	/**
	 * The ID of the related `TimeSlot` entity, stored as a UUID.
	 * This is a relation ID that helps link the minute to the corresponding `TimeSlot`.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeSlotMinute) => it.timeSlot)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	timeSlotId: ID;
}
