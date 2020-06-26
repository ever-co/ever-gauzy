import { Entity, Column, RelationId, ManyToOne, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
import { Activity as IActivity, ActivityType } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsNumber,
	IsDateString
} from 'class-validator';
import { TimeSlot } from './time-slot.entity';

@Entity('activity')
export class Activity extends Base implements IActivity {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	timeSlot: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((activity: Activity) => activity.timeSlot)
	@Column()
	readonly timeSlotId: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ default: 0 })
	title: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ default: 0 })
	data?: string;

	@ApiProperty({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: String, enum: ActivityType })
	@IsEnum(ActivityType)
	@IsOptional()
	@Column({ nullable: true })
	type?: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;
}
