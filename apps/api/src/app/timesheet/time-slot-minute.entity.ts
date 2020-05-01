import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	Unique
} from 'typeorm';
import { Base } from '../core/entities/base';
import { ITimeSlotMinute } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';
import { TimeSlot } from './time-slot.entity';

@Entity('time_slot_minutes')
@Unique(['employeeId', 'startedAt'])
export class TimeSlotMinute extends Base implements ITimeSlotMinute {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true })
	@JoinColumn()
	timeSlot: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: TimeSlotMinute) => activity.timeSlot)
	@Column()
	readonly timeSlotId: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse: number;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column()
	datetime: Date;
}
