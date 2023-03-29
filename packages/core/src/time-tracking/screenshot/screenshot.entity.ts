import { Entity, Column, RelationId, ManyToOne, Index, JoinColumn } from 'typeorm';
import { FileStorageProviderEnum, IScreenshot, ITimeSlot } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsUUID, IsNotEmpty, IsEnum } from 'class-validator';
import { Exclude } from 'class-transformer';
import { TenantOrganizationBaseEntity, TimeSlot } from './../../core/entities/internal';

@Entity('screenshot')
export class Screenshot extends TenantOrganizationBaseEntity implements IScreenshot {
	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Column()
	file: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	thumb?: string;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	recordedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	deletedAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@Index()
	@Column({
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
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Screenshot) => it.timeSlot)
	@Index()
	@Column({ nullable: true })
	timeSlotId?: ITimeSlot['id'];
}
