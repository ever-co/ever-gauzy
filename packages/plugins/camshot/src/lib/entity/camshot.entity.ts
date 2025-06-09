import { ColumnIndex, Employee, MultiORMColumn, MultiORMManyToOne, TenantOrganizationBaseEntity, TimeSlot, User } from '@gauzy/core';
import { MultiORMEntity } from '@gauzy/core';
import { ICamshot } from '../models/camshot.model';
import { ITimeSlot, FileStorageProviderEnum, IUser, ID, IEmployee } from '@gauzy/contracts';
import { MikroOrmCamshotRepository } from '../repositories/mikro-orm-camshot.repository';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Transform } from 'class-transformer';
import { JoinColumn, RelationId } from 'typeorm';

const PNG_FILE_REGEX = /\.(png)$/;
const PNG_FILE_MESSAGE = 'File must be a valid camshot format png';

@MultiORMEntity('camshots', { mikroOrmRepository: () => MikroOrmCamshotRepository })
export class Camshot extends TenantOrganizationBaseEntity implements ICamshot {
	/**
	 * Title of the camshot.
	 * This is a required field with a maximum length of 255 characters.
	 */
	@IsNotEmpty({ message: 'Title is required' })
	@IsString({ message: 'Title must be a string' })
	@Length(3, 255, { message: 'Title must be between 3 and 255 characters' })
	@ApiProperty({ type: () => String, description: 'Title of the camshot' })
	@MultiORMColumn()
	title: string;

	/**
	 * Camshot file path or identifier.
	 * Must be a valid image file with a valid name format.
	 */
	@IsNotEmpty({ message: 'File is required' })
	@IsString({ message: 'File must be a string' })
	@Matches(PNG_FILE_REGEX, { message: PNG_FILE_MESSAGE })
	@ApiPropertyOptional({ type: () => String, description: 'Camshot file path or identifier' })
	@MultiORMColumn()
	fileKey: string;

	/**
	 * Camshot file path or identifier.
	 * Must be a valid image file with a valid name format.
	 */
	@IsOptional()
	@IsString({ message: 'File must be a string' })
	@Matches(PNG_FILE_REGEX, { message: PNG_FILE_MESSAGE })
	@ApiPropertyOptional({ type: () => String, description: 'Camshot thumb file path or identifier' })
	@MultiORMColumn({ nullable: true })
	thumbKey?: string;

	/**
	 * Storage provider used for storing the camshot file.
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
	 * Date when the camshot was recorded.
	 * This is optional and must be a valid past ISO 8601 date string.
	 */
	@IsOptional()
	@ValidateIf((o) => !!o.recordedAt)
	@Transform(({ value }) => {
		if (value && new Date(value).getTime() > Date.now()) {
			throw new Error('Recorded date cannot be in the future');
		}
		return new Date(value).toISOString();
	}, { toClassOnly: true })
	@IsDateString({}, { message: 'Recorded date must be a valid ISO 8601 date string' })
	@ApiPropertyOptional({ type: () => 'timestamptz', description: 'Date when the camshot was recorded' })
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	recordedAt?: Date;

	/**
	 * Full URL to access the camshot.
	 * Optional and must be a valid HTTP or HTTPS URL.
	 */
	@IsOptional()
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Full URL must be a valid HTTPS or HTTP URL' })
	@ApiPropertyOptional({ type: () => String, description: 'Full URL to access the camshot' })
	@MultiORMColumn({ nullable: true })
	fullUrl?: string;

	/**
	 * Thumb URL to access the camshot.
	 * Optional and must be a valid HTTP or HTTPS URL.
	 */
	@IsOptional()
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Thumb URL must be a valid HTTPS or HTTP URL' })
	@ApiPropertyOptional({ type: () => String, description: 'Thumb URL to access the camshot' })
	@MultiORMColumn({ nullable: true })
	thumbUrl?: string;

	/**
	 * Size of the camshot file in bytes.
	 * Optional with a maximum size limit of 5MB (5242880 bytes).
	 */
	@IsOptional()
	@IsNumber({}, { message: 'Size must be a number' })
	@Min(0, { message: 'Size must be greater than or equal to 0' })
	@Max(5242880, { message: 'Size cannot exceed 5MB.' })
	@Transform(({ value }) => Number.parseFloat(value), { toClassOnly: true })
	@ApiPropertyOptional({ type: () => Number, description: 'Size of the camshot file in bytes' })
	@MultiORMColumn({ nullable: true })
	size?: number;

	/*
|--------------------------------------------------------------------------
| @ManyToOne
|--------------------------------------------------------------------------
*/

	/**
	 * Represents the associated TimeSlot for the camshot.
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
	@RelationId((camshot: Camshot) => camshot.timeSlot) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the timeSlotId column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	timeSlotId?: ID;

	/**
	 * Represents the Employee who uploaded the camshot.
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
	 * Represents the ID of the Employee who uploaded the camshot.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@IsOptional()
	@IsUUID('4', { message: 'Employee ID must be a valid UUID v4' })
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated Employee' })
	@RelationId((camshot: Camshot) => camshot.uploadedBy) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the uploadedById column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	uploadedById?: ID;

	/**
	 * Represents the User who uploaded the camshot.
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
	 * Represents the ID of the User who uploaded the camshot.
	 * This is an optional UUID (version 4) used as a foreign key reference.
	 */
	@IsOptional()
	@IsUUID('4', { message: 'User ID must be a valid UUID v4' })
	@ApiPropertyOptional({ type: () => String, description: 'The UUID of the associated User' })
	@RelationId((camshot: Camshot) => camshot.user) // Extracts the foreign key for the relationship.
	@ColumnIndex() // Adds a database index for faster queries on the userId column.
	@MultiORMColumn({ nullable: true, relationId: true }) // Marks it as a relation identifier.
	userId?: ID;
}
