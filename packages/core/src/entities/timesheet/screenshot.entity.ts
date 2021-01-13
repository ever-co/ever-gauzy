import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	AfterLoad
} from 'typeorm';
import { IScreenshot, ITimeSlot } from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { TimeSlot } from './time-slot.entity';
// import { FileStorage } from '../core/file-storage';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('screenshot')
export class Screenshot extends TenantOrganizationBase implements IScreenshot {
	@ApiProperty({ type: TimeSlot })
	@ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.screenshots, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((screenshot: Screenshot) => screenshot.timeSlot)
	@Column({ nullable: true })
	readonly timeSlotId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	file: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ default: null, nullable: true })
	thumb?: string;

	@ApiProperty({ type: 'timestamptz' })
	@IsNumber()
	@IsOptional()
	@Column({ default: null, nullable: true })
	recordedAt?: Date;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	fullUrl?: string;
	thumbUrl?: string;

	@AfterLoad()
	afterLoad?() {
		// this.fullUrl = new FileStorage().getProvider().url(this.file);
		// this.thumbUrl = new FileStorage().getProvider().url(this.thumb);
	}
}
