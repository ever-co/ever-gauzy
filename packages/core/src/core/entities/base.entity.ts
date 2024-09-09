// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { PrimaryGeneratedColumn, UpdateDateColumn, CreateDateColumn, DeleteDateColumn } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { SoftDeletable } from 'mikro-orm-soft-delete';
import { BaseEntityModel as IBaseEntityModel } from '@gauzy/contracts';
import { PrimaryKey, Property } from '@mikro-orm/core';
import { MultiORMColumn } from '../decorators/entity';
import { ColumnIndex } from '../decorators/entity/column-index.decorator';

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
@SoftDeletable(() => SoftDeletableBaseEntity, 'deletedAt', () => new Date())
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
 * Abstract base entity with common fields for UUID, creation, update timestamps, soft-delete, and more.
 */
export abstract class BaseEntity extends SoftDeletableBaseEntity implements IBaseEntityModel {
	// Primary key of UUID type
	@ApiPropertyOptional({ type: () => String })
	@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' }) // For Mikro-ORM compatibility
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	// Date when the record was created
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@CreateDateColumn() // TypeORM decorator for creation date
	@Property({
		// Automatically set the property value when entity gets created, executed during flush operation.
		onCreate: () => new Date() // Set creation date on record creation
	})
	createdAt?: Date;

	// Date when the record was last updated
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@UpdateDateColumn() // TypeORM decorator for update date
	@Property({
		// Automatically set the property value when entity gets created, executed during flush operation.
		onCreate: () => new Date(), // Set at record creation
		// Automatically update the property value every time entity gets updated, executed during flush operation.
		onUpdate: () => new Date() // Update every time the entity is changed
	})
	updatedAt?: Date;

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
