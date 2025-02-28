// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn, DeleteDateColumn, RelationId } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { SoftDeletable } from 'mikro-orm-soft-delete';
import { BaseEntityModel as IBaseEntityModel, ID, IUser } from '@gauzy/contracts';
import { PrimaryKey, Property } from '@mikro-orm/core';
import { MultiORMColumn, MultiORMManyToOne } from '../decorators/entity';
import { ColumnIndex } from '../decorators/entity/column-index.decorator';
import { User } from './internal';

/**
 * Abstract base class for dynamically assigning properties.
 */
export abstract class Model {
	constructor(input?: any) {
		if (input) {
			// Iterate over the key-value pairs in the input object
			for (const [key, value] of Object.entries(input)) {
				// Assign the value to the corresponding property in this instance
				(this as any)[key] = value;
			}
		}
	}
}

/**
 * Base entity class with soft-delete functionality.
 * All entities that extend this class will have soft-delete capability.
 */
@SoftDeletable(() => SoftDeletableBaseEntity, 'deletedAt', () => AccessTimestamps.getCurrentDate())
export abstract class SoftDeletableBaseEntity extends Model {
	// Soft Delete
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@IsOptional()
	@IsDateString()
	// Soft delete column that records the date/time when the entity was soft-deleted
	@DeleteDateColumn() // Indicates that this column is used for soft-delete
	@Property({ nullable: true }) // Allows for Mikro-ORM compatibility
	deletedAt?: Date;
}

/**
 * Represents an entity with automatic timestamp management for creation and updates.
 * Extends the `SoftDeletableBaseEntity` to include support for soft deletes.
 */
export abstract class AccessTimestamps extends SoftDeletableBaseEntity {
	/**
	 * Date when the record was created.
	 * Automatically set at the time of entity creation.
	 */
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z',
		description: 'The creation timestamp of the entity.'
	})
	@CreateDateColumn()
	@Property({
		// Automatically set the property value when entity gets created, executed during flush operation.
		onCreate: () => AccessTimestamps.getCurrentDate() // Set creation date on record creation
	})
	createdAt?: Date;

	/**
	 * Date when the record was last updated.
	 * Automatically updated whenever the entity is modified.
	 */
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z',
		description: 'The last update timestamp of the entity.'
	})
	@UpdateDateColumn()
	@Property({
		// Automatically set the property value when entity gets created, executed during flush operation.
		onCreate: () => AccessTimestamps.getCurrentDate(), // Set at record creation
		// Automatically update the property value every time entity gets updated, executed during flush operation.
		onUpdate: () => AccessTimestamps.getCurrentDate() // Update every time the entity is changed
	})
	updatedAt?: Date;

	/**
	 * Utility function to get the current date.
	 * Used to set `createdAt` and `updatedAt` timestamps.
	 *
	 * @returns {Date} - The current date.
	 */
	static getCurrentDate(): Date {
		return new Date();
	}
}

/**
 * BaseEntityActionByUser provides a generic template for tracking
 * user actions (create) performed on an entity.
 */
export abstract class BaseEntityActionByUser extends AccessTimestamps {
	/**
	 * The user who created the record.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true, // Indicates if relation column value can be nullable.
		onDelete: 'CASCADE' // Database cascade action on update.
	})
	createdByUser?: IUser;

	/**
	 * The ID of the user who created the record.
	 */
	@RelationId((it: BaseEntityActionByUser) => it.createdByUser)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	createdByUserId?: ID;

	/**
	 * The user who last updated the record.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true, // Allows the relation column to be null if no updater is specified.
		onDelete: 'CASCADE' // Cascades the delete operation if the related User is removed.
	})
	updatedByUser?: IUser;

	/**
	 * The ID of the user who last updated the record.
	 */
	@RelationId((it: BaseEntityActionByUser) => it.updatedByUser)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	updatedByUserId?: ID;
}

/**
 * Abstract base entity with common fields for UUID, creation, update timestamps, soft-delete, and more.
 */
export abstract class BaseEntity extends BaseEntityActionByUser implements IBaseEntityModel {
	// Primary key of UUID type
	@ApiPropertyOptional({ type: () => String })
	@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' }) // For Mikro-ORM compatibility
	@PrimaryGeneratedColumn('uuid')
	id?: ID;

	// Indicates if record is active now
	@ApiPropertyOptional({
		type: Boolean,
		default: true
	})
	@IsOptional() // Field can be optional
	@IsBoolean() // Should be a boolean type
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, default: true }) // TypeORM and Mikro-ORM compatibility
	isActive?: boolean;

	// Indicate if record is archived
	@ApiPropertyOptional({
		type: Boolean,
		default: false
	})
	@IsOptional() // Field can be optional
	@IsBoolean() // Should be a boolean type
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, default: false }) // TypeORM and Mikro-ORM compatibility
	isArchived?: boolean;

	// Indicates the date when record was archived
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	archivedAt?: Date;
}
