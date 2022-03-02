import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	Index
} from 'typeorm';
import { FileStorageProviderEnum, IScreenshot, ITimeSlot } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import {
	TenantOrganizationBaseEntity,
	TimeSlot
} from './../../core/entities/internal';

@Entity('screenshot')
export class Screenshot
	extends TenantOrganizationBaseEntity
	implements IScreenshot {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@Column()
	file: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ default: null, nullable: true })
	thumb?: string;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsNumber()
	@IsOptional()
	@Column({ default: null, nullable: true })
	recordedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@Column({
		select: false,
		type: 'simple-enum',
		nullable: true,
		enum: FileStorageProviderEnum
	})
	storageProvider?: FileStorageProviderEnum;

	fullUrl?: string;
	thumbUrl?: string;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * TimeSlot
	 */
	@ApiProperty({ type: () => TimeSlot })
	@ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.screenshots, {
		onDelete: 'CASCADE'
	})
	timeSlot?: ITimeSlot;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Screenshot) => it.timeSlot)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly timeSlotId?: string;
}
