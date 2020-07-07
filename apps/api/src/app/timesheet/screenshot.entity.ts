import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	AfterLoad
} from 'typeorm';
import { Base } from '../core/entities/base';
import { Screenshot as IScreenshot } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { TimeSlot } from './time-slot.entity';
import { environment } from '@env-api/environment';

@Entity('screenshot')
export class Screenshot extends Base implements IScreenshot {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	timeSlot: TimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((screenshot: Screenshot) => screenshot.timeSlot)
	@Column()
	readonly timeSlotId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	fullUrl: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ default: null, nullable: true })
	thumbUrl?: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsNumber()
	@IsOptional()
	@Column({ default: null, nullable: true })
	recordedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	@AfterLoad()
	afterLoad?() {
		this.fullUrl = this.fullUrl;
		this.thumbUrl = this.thumbUrl;
	}
}
