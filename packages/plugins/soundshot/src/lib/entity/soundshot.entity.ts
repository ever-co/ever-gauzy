import { FileStorageProviderEnum, ID, IEmployee, ITimeSlot, IUser } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	TimeSlot,
	User
} from '@gauzy/core';
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
import { ISoundshot } from '../models/soundshot.model';
import { MikroOrmSoundshotRepository } from '../repositories/mikro-orm-soundshot.repository';

const WEBM_FILE_REGEX = /\.(webm)$/;
const WEBM_FILE_MESSAGE = 'File must be a valid soundshot format webm';

@MultiORMEntity('soundshots', { mikroOrmRepository: () => MikroOrmSoundshotRepository })
export class Soundshot extends TenantOrganizationBaseEntity implements ISoundshot {
	/**
	 * Name of the soundshot.
	 * This is a required field with a maximum length of 255 characters.
	 */
	@IsNotEmpty({ message: 'Name is required' })
	@IsString({ message: 'Name must be a string' })
	@Length(3, 255, { message: 'Name must be between 3 and 255 characters' })
	@ApiProperty({ type: () => String, description: 'Name of the soundshot' })
	@MultiORMColumn()
	name: string;

	/**
	 * Soundshot file path or identifier.
	 * Must be a valid audio file with a valid name format.
	 */
	@IsNotEmpty({ message: 'File is required' })
	@IsString({ message: 'File must be a string' })
	@Matches(WEBM_FILE_REGEX, { message: WEBM_FILE_MESSAGE })
	@ApiPropertyOptional({ type: () => String, description: 'Soundshot file path or identifier' })
	@MultiORMColumn()
	fileKey: string;

	/**
	 * Storage provider used for storing the soundshot file.
	 * Optional and must match one of the predefined storage providers.
	 */
	@IsOptional()
	@IsEnum(FileStorageProviderEnum)
	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String, enum: FileStorageProviderEnum })
	@ColumnIndex()
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: FileStorageProviderEnum })
	storageProvider: FileStorageProviderEnum;

	/**
	 * Date when the soundshot was recorded.
	 * This is optional and must be a valid past ISO 8601 date string.
	 */
	@IsOptional()
	@ValidateIf((o) => !!o.recordedAt)
	@Transform(
		({ value }) => {
			const date = new Date(value);
			if (isNaN(date.getTime())) {
				throw new Error('Recorded date is invalid');
			}
			if (date.getTime() > Date.now()) {
				throw new Error('Recorded date cannot be in the future');
			}
			return date.toISOString();
		},
		{ toClassOnly: true }
	)
	@IsDateString({}, { message: 'Recorded date must be a valid ISO 8601 date string' })
	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Date when the soundshot was recorded' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	/**
	 * Full URL to access the soundshot.
	 * Optional and must be a valid HTTP or HTTPS URL.
	 */
	@IsOptional()
	@IsUrl(
		{ protocols: ['http', 'https'], require_protocol: true },
		{ message: 'Full URL must be a valid HTTPS or HTTP URL' }
	)
	@ApiPropertyOptional({ type: () => String, description: 'Full URL to access the soundshot' })
	@MultiORMColumn({ nullable: true })
	fullUrl?: string;

	/**
	 * Size of the soundshot file in bytes.
	 * Optional with a maximum size limit of 100MB (104857600 bytes).
	 */
	@IsOptional()
	@IsNumber({}, { message: 'Size must be a number' })
	@Min(0, { message: 'Size must be greater than or equal to 0' })
	@Max(104857600, { message: 'Size cannot exceed 100MB.' })
	@Transform(({ value }) => Number.parseFloat(value), { toClassOnly: true })
	@ApiPropertyOptional({ type: () => Number, description: 'Size of the soundshot file in bytes' })
	@MultiORMColumn({ nullable: true })
	size?: number;

	/**
	 * Number of audio channels in the soundshot file.
	 */
	@IsOptional()
	@IsNumber({}, { message: 'Number of audio channels in the soundshot file (e.g., 1 for mono, 2 for stereo).' })
	@Transform(({ value }) => Number.parseInt(value), { toClassOnly: true })
	@ApiPropertyOptional({ type: () => Number, description: 'Sound channels of the soundshot file' })
	@MultiORMColumn({ nullable: true })
	channels?: number;

	/**
	 * Rate of the soundshot file.
	 * Sample rate of the soundshot file in Hz (e.g., 44100, 48000).
	 */
	@IsOptional()
	@IsNumber({}, { message: 'Rate must be a number' })
	@Transform(({ value }) => Number.parseInt(value), { toClassOnly: true })
	@ApiPropertyOptional({ type: () => Number, description: 'Sound rate of the soundshot file' })
	@MultiORMColumn({ nullable: true })
	rate?: number;

	/**
	 * Duration of the soundshot file in seconds.
	 */
	@IsOptional()
	@IsNumber({}, { message: 'Duration must be a number' })
	@Min(0, { message: 'Duration must be greater than or equal to 0' })
	@Transform(({ value }) => Number.parseFloat(value), { toClassOnly: true })
	@ApiPropertyOptional({ type: () => Number, description: 'Duration of the soundshot file in seconds' })
	@MultiORMColumn({ nullable: true, type: 'float' })
	duration?: number;

	/*
|--------------------------------------------------------------------------
| @ManyToOne
|--------------------------------------------------------------------------
*/

	/**
	 * Represents the associated TimeSlot for the soundshot.
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
	@IsOptional()
	@IsUUID('4', { message: 'TimeSlot ID must be a valid UUID v4' }) // Validates the ID is a proper UUID v4.
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated TimeSlot' })
	@RelationId((soundshot: Soundshot) => soundshot.timeSlot) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the timeSlotId column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	timeSlotId?: ID;

	/**
	 * Represents the Employee who uploaded the soundshot.
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
	 * Represents the ID of the Employee who uploaded the soundshot.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@IsOptional()
	@IsUUID('4', { message: 'Employee ID must be a valid UUID v4' })
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated Employee' })
	@RelationId((soundshot: Soundshot) => soundshot.uploadedBy) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the uploadedById column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	uploadedById?: ID;

	/**
	 * Represents the User who uploaded the soundshot.
	 * This is an optional many-to-one relationship with cascading delete.
	 */
	@MultiORMManyToOne(() => User, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn() // Indicates this is the owning side of the relationship and specifies the join column.
	user?: IUser;

	/**
	 * Represents the ID of the User who uploaded the soundshot.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@IsOptional()
	@IsUUID('4', { message: 'User ID must be a valid UUID v4' })
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated User' })
	@RelationId((soundshot: Soundshot) => soundshot.user) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the userId column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	userId?: ID;
}
