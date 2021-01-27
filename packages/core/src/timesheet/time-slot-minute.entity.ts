import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	Unique
} from 'typeorm';
import { ITimeSlotMinute } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';
import {
	TenantOrganizationBaseEntity,
	TimeSlot
} from '../core/entities/internal';

@Entity('time_slot_minute')
@Unique(['timeSlotId', 'datetime'])
export class TimeSlotMinute
	extends TenantOrganizationBaseEntity
	implements ITimeSlotMinute {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	timeSlot?: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: TimeSlotMinute) => activity.timeSlot)
	@Column()
	timeSlotId?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column()
	datetime?: Date;
}
