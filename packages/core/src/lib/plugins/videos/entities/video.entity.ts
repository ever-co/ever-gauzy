import { FileStorageProvider, FileStorageProviderEnum, ID, IEmployee, ITimeSlot, IVideo } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';
import {
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUrl,
	IsUUID,
	Length,
	Matches,
	Max,
	Min,
	ValidateIf
} from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../../core/decorators';
import { Employee, TenantOrganizationBaseEntity, TimeSlot } from '../../../core/entities/internal';
import { MikroOrmVideoRepository } from '../repositories/mikro-orm-video.repository';

@MultiORMEntity('videos', { mikroOrmRepository: () => MikroOrmVideoRepository })
export class Video extends TenantOrganizationBaseEntity implements IVideo {
	@ApiProperty({ type: () => String, description: 'Title of the video' })
	@IsNotEmpty({ message: 'Title is required' })
	@IsString({ message: 'Title must be a string' })
	@Length(3, 255, { message: 'Title must be between 3 and 255 characters' })
	@Matches(/^[\w\s-]+$/i, { message: 'Title can only contain letters, numbers, spaces, and hyphens' })
	@MultiORMColumn({ nullable: false })
	title: string;

	@ApiProperty({ type: () => String, description: 'Video file path or identifier' })
	@IsNotEmpty({ message: 'File is required' })
	@IsString({ message: 'File must be a string' })
	@Matches(/^[\w-]+\.(mp4)$/i, {
		message: 'File must be a valid video format mp4 and contain only letters, numbers, and hyphens'
	})
	@MultiORMColumn({ nullable: false })
	file: string;

	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Date when the video was recorded' })
	@IsOptional()
	@IsDateString({}, { message: 'Recorded date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.recordedAt <= new Date())
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	@ApiProperty({ type: () => Number, description: 'Duration of the video in seconds' })
	@IsOptional()
	@IsNumber({}, { message: 'Duration must be a number' })
	@Min(0, { message: 'Duration must be greater than or equal to 0' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true })
	duration?: number;

	@ApiProperty({ type: () => Number, description: 'Size of the video file in bytes' })
	@IsOptional()
	@IsNumber({}, { message: 'Size must be a number' })
	@Min(0, { message: 'Size must be greater than or equal to 0' })
	@Max(10737418240, { message: 'Size cannot exceed 10GB (10737418240 bytes)' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true, default: 0 })
	size?: number;

	@ApiProperty({ type: () => String, description: 'Full URL to access the video' })
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true },
		{
			message: 'Full URL must be a valid HTTPS or HTTP URL'
		}
	)
	@MultiORMColumn({ nullable: true })
	fullUrl?: string;

	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum, {
		message: `Storage provider must be one of: ${Object.values(FileStorageProviderEnum).join(', ')}`
	})
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: FileStorageProviderEnum })
	storageProvider?: FileStorageProvider;

	@ApiProperty({ type: () => String, description: 'Video description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@Length(0, 1000, { message: 'Description must not exceed 1000 characters' })
	@Matches(/^[\w\s.,!?-]*$/i, {
		message: 'Description can only contain letters, numbers, spaces, and basic punctuation'
	})
	@MultiORMColumn({ nullable: true })
	description?: string;

	@MultiORMManyToOne(() => TimeSlot, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeSlot?: ITimeSlot;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID('4', { message: 'TimeSlot ID must be a valid UUID v4' })
	@RelationId((it: Video) => it.timeSlot)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	timeSlotId?: ID;

	@ApiProperty({ type: () => String, description: 'Video resolution in format WIDTH:HEIGHT' })
	@IsOptional()
	@Matches(/^\d{3,4}:\d{3,4}$/, {
		message: 'Resolution must be in format WIDTH:HEIGHT (e.g., 1920:1080)'
	})
	@MultiORMColumn({ nullable: true, default: '1920:1080' })
	resolution?: string;

	@ApiProperty({ type: () => String, description: 'Video codec used' })
	@IsOptional()
	@IsString({ message: 'Codec must be a string' })
	@Matches(/^[a-zA-Z0-9_-]{2,20}$/, {
		message: 'Codec must be 2-20 characters long and contain only letters, numbers, underscores, and hyphens'
	})
	@MultiORMColumn({ nullable: true, default: 'libx264' })
	codec?: string;

	@ApiProperty({ type: () => Number, description: 'Video frame rate' })
	@IsOptional()
	@IsNumber({}, { message: 'Frame rate must be a number' })
	@Min(1, { message: 'Frame rate must be at least 1 fps' })
	@Max(240, { message: 'Frame rate cannot exceed 240 fps' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true, default: 15 })
	frameRate?: number;

	@MultiORMManyToOne(() => Employee, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	uploadedBy?: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID('4', { message: 'UploadedBy ID must be a valid UUID v4' })
	@RelationId((it: Video) => it.uploadedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	uploadedById?: ID;
}
