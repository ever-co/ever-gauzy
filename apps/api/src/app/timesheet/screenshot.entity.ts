import { Entity, Column, RelationId, ManyToOne, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
import { Screenshot as IScreenshot } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { TimeSlot } from './time-slot.entity';

@Entity('screenshot')
export class Screenshot extends Base implements IScreenshot {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true })
	@JoinColumn()
	timeSlot: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((screenshot: Screenshot) => screenshot.timeSlot)
	@Column()
	readonly timeSlotId: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	fullUrl: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ default: null, nullable: true })
	thumbUrl?: string;

	@ApiProperty({ type: Date })
	@IsNumber()
	@IsOptional()
	@Column({ default: null, nullable: true })
	recordedAt?: Date;
}
