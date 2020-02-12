// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	CreateDateColumn,
	Column,
	Generated
} from 'typeorm';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { BaseEntityModel as IBaseEntityModel } from '@gauzy/models';

export abstract class Base implements IBaseEntityModel {
	@ApiPropertyOptional({ type: String })
	@PrimaryGeneratedColumn('uuid')
	id?: string;
	@Column()
	@Generated('uuid')
	tenantId?: string;

	@ApiProperty({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@CreateDateColumn({ type: 'timestamptz' })
	createdAt?: Date;

	@ApiProperty({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@UpdateDateColumn({ type: 'timestamptz' })
	updatedAt?: Date;
}
