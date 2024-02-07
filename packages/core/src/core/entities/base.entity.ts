// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	CreateDateColumn,
	Index,
	DeleteDateColumn
} from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntityModel as IBaseEntityModel } from '@gauzy/contracts';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { PrimaryKey, Property } from '@mikro-orm/core';
import { MultiORMColumn } from '../decorators/entity';

export abstract class Model {
	constructor(input?: any) {
		if (input) {
			for (const [key, value] of Object.entries(input)) {
				(this as any)[key] = value;
			}
		}
	}
}
export abstract class BaseEntity extends Model implements IBaseEntityModel {

	@PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
	@ApiPropertyOptional({ type: () => String })
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	// Date when the record was created
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@CreateDateColumn()
	@Property()
	createdAt?: Date = new Date();

	// Date when the record was last updated
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@UpdateDateColumn()
	@Property({ onUpdate: () => new Date() })
	updatedAt?: Date = new Date();;

	// Soft Delete
	@ApiPropertyOptional({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@IsOptional()
	@IsDateString()
	@DeleteDateColumn()
	@Property({ nullable: true })
	deletedAt?: Date;

	// Indicates if record is active now
	@ApiPropertyOptional({ type: Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@Index()
	@MultiORMColumn({ nullable: true, default: true })
	isActive?: boolean;

	// Indicate if record is archived
	@ApiPropertyOptional({ type: Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Index()
	@MultiORMColumn({ nullable: true, default: false })
	isArchived?: boolean;
}
