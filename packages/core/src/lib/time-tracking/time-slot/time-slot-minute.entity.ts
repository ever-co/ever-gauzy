import { RelationId, Unique, JoinColumn } from 'typeorm';
import { ID, ITimeSlot, ITimeSlotMinute } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString, IsUUID } from 'class-validator';
import { TenantOrganizationBaseEntity } from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';
import { TimeSlot } from './time-slot.entity';
import { MikroOrmTimeSlotMinuteRepository } from './repository/mikro-orm-time-slot-minute.repository';

@MultiORMEntity('time_slot_minute', { mikroOrmRepository: () => MikroOrmTimeSlotMinuteRepository })
@Unique(['timeSlotId', 'datetime'])
export class TimeSlotMinute extends TenantOrganizationBaseEntity implements ITimeSlotMinute {
	/**
	 * The number of keyboard interactions in the given time slot minute.
	 * Defaults to 0 if not provided.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	keyboard?: number;

	/**
	 * The number of mouse interactions in the given time slot minute.
	 * Defaults to 0 if not provided.
	 */
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	mouse?: number;

	/**
	 * The specific datetime for this time slot minute.
	 * It records the exact minute in which the activity was tracked.
	 */
	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@MultiORMColumn()
	datetime?: Date;

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
	@MultiORMManyToOne(() => TimeSlot, (it) => it.timeSlotMinutes, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	/**
	 * The ID of the related `TimeSlot` entity, stored as a UUID.
	 * This is a relation ID that helps link the minute to the corresponding `TimeSlot`.
	 */
	@ApiProperty({ type: () => String })
	@RelationId((it: TimeSlotMinute) => it.timeSlot)
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	timeSlotId?: ID;
}
