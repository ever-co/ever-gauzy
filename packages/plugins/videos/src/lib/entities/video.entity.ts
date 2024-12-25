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
import { FileStorageProvider, FileStorageProviderEnum, ID, IEmployee, ITimeSlot } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '@gauzy/core';
import { Employee, TenantOrganizationBaseEntity, TimeSlot } from '@gauzy/core';
import { IVideo, VideoCodecEnum, VideoResolutionEnum } from '../video.model';
import { MikroOrmVideoRepository } from '../repositories/mikro-orm-video.repository';

@MultiORMEntity('video', { mikroOrmRepository: () => MikroOrmVideoRepository })
export class Video extends TenantOrganizationBaseEntity implements IVideo {
	/**
	 * Title of the video.
	 * This is a required field with a maximum length of 255 characters.
	 */
	@ApiProperty({ type: () => String, description: 'Title of the video' })
	@IsNotEmpty({ message: 'Title is required' })
	@IsString({ message: 'Title must be a string' })
	@Length(3, 255, { message: 'Title must be between 3 and 255 characters' })
	@Matches(/^[\p{L}\p{N}\s-]+$/u, { message: 'Title can contain letters, numbers, spaces, and hyphens from any language' })
	@MultiORMColumn()
	title: string;

	/**
	 * Video file path or identifier.
	 * Must be a valid MP4 file with a valid name format.
	 */
	@ApiProperty({ type: () => String, description: 'Video file path or identifier' })
	@IsNotEmpty({ message: 'File is required' })
	@IsString({ message: 'File must be a string' })
	@Matches(/^[\w-]+\.(mp4)$/i, {
		message: 'File must be a valid MP4 format and contain only letters, numbers, and hyphens'
	})
	@MultiORMColumn()
	file: string;

	/**
	 * Date when the video was recorded.
	 * This is optional and must be a valid past ISO 8601 date string.
	 */
	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Date when the video was recorded' })
	@IsOptional()
	@IsDateString({}, { message: 'Recorded date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.recordedAt && o.recordedAt <= new Date())
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	/**
	 * Duration of the video in seconds.
	 * This is optional and must be a positive number.
	 */
	@ApiProperty({ type: () => Number, description: 'Duration of the video in seconds' })
	@IsOptional()
	@IsNumber({}, { message: 'Duration must be a number' })
	@Min(0, { message: 'Duration must be greater than or equal to 0' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true })
	duration?: number;

	/**
	 * Size of the video file in bytes.
	 * Optional with a maximum size limit of 10GB (10737418240 bytes).
	 */
	@ApiProperty({ type: () => Number, description: 'Size of the video file in bytes' })
	@IsOptional()
	@IsNumber({}, { message: 'Size must be a number' })
	@Min(0, { message: 'Size must be greater than or equal to 0' })
	@Max(10737418240, { message: 'Size cannot exceed 10GB (10737418240 bytes)' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true })
	size?: number;

	/**
	 * Full URL to access the video.
	 * Optional and must be a valid HTTP or HTTPS URL.
	 */
	@ApiProperty({ type: () => String, description: 'Full URL to access the video' })
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true },
		{ message: 'Full URL must be a valid HTTPS or HTTP URL' }
	)
	@MultiORMColumn({ nullable: true })
	fullUrl?: string | null;

	/**
	 * Description of the video.
	 * Optional with a maximum length of 1000 characters.
	 */
	@ApiProperty({ type: () => String, description: 'Video description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@Length(0, 1000, { message: 'Description must not exceed 1000 characters' })
	@Matches(/^[\w\s.,!?-]*$/i, {
		message: 'Description can only contain letters, numbers, spaces, and basic punctuation'
	})
	@MultiORMColumn({ nullable: true })
	description?: string;

	/**
	 * Storage provider used for storing the video file.
	 * Optional and must match one of the predefined storage providers.
	 */
	@ApiPropertyOptional({ type: () => String, enum: FileStorageProviderEnum })
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@ColumnIndex()
	@MultiORMColumn({ type: 'text', nullable: true, enum: FileStorageProviderEnum })
	storageProvider?: FileStorageProvider;

	/**
	 * Video resolution in the format WIDTH:HEIGHT.
	 * Optional and restricted to standard resolutions defined in VideoResolutionEnum.
	 */
	@ApiPropertyOptional({
		type: () => String,
		enum: VideoResolutionEnum,
		description: 'Video resolution in format WIDTH:HEIGHT (e.g., 1920:1080, 3840:2160)'
	})
	@IsOptional()
	@IsEnum(VideoResolutionEnum)
	@MultiORMColumn({
		type: 'text',
		nullable: true,
		default: VideoResolutionEnum.FullHD
	})
	resolution?: VideoResolutionEnum;

	/**
	 * Video codec used for encoding.
	 * Optional and restricted to standard codecs defined in VideoCodecEnum.
	 */
	@ApiPropertyOptional({
		type: () => String,
		enum: VideoCodecEnum,
		description: 'Video codec used for encoding (e.g., libx264, libx265, vp9)'
	})
	@IsOptional()
	@IsEnum(VideoCodecEnum)
	@MultiORMColumn({
		type: 'text',
		nullable: true,
		default: VideoCodecEnum.libx264
	})
	codec?: VideoCodecEnum;

	/**
	 * Video frame rate in frames per second.
	 * Optional with a range from 1 to 240 fps.
	 */
	@ApiProperty({ type: () => Number, description: 'Video frame rate' })
	@IsOptional()
	@IsNumber({}, { message: 'Frame rate must be a number' })
	@Min(1, { message: 'Frame rate must be at least 1 fps' })
	@Max(240, { message: 'Frame rate cannot exceed 240 fps' })
	@Transform(({ value }) => parseFloat(value), { toClassOnly: true })
	@MultiORMColumn({ nullable: true, default: 15 })
	frameRate?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Represents the associated TimeSlot for the video.
	 * This is an optional many-to-one relationship with cascading delete.
	 */
	@MultiORMManyToOne(() => TimeSlot, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn() // Indicates this is the owning side of the relationship and specifies the join column.
	timeSlot?: ITimeSlot;

	/**
	 * Represents the ID of the associated TimeSlot.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated TimeSlot' })
	@IsOptional()
	@IsUUID('4', { message: 'TimeSlot ID must be a valid UUID v4' }) // Validates the ID is a proper UUID v4.
	@RelationId((video: Video) => video.timeSlot) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the timeSlotId column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	timeSlotId?: ID;

	/**
	 * Represents the Employee who uploaded the video.
	 * This is an optional many-to-one relationship with cascading delete.
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn() // Indicates this is the owning side of the relationship and specifies the join column.
	uploadedBy?: IEmployee;

	/**
	 * Represents the ID of the Employee who uploaded the video.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@RelationId((video: Video) => video.uploadedBy) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the uploadedById column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	uploadedById?: ID;
}
