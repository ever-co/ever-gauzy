// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	CreateDateColumn
} from 'typeorm';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
	BaseEntityModel as IBaseEntityModel,
	DeepPartial
} from '@gauzy/common';

export abstract class Model {
	constructor(input?: any) {
		if (input) {
			for (const [key, value] of Object.entries(input)) {
				(this as any)[key] = value;
			}
		}
	}
}
export abstract class Base implements IBaseEntityModel {
	constructor(input?: DeepPartial<Base>) {
		if (input) {
			for (const [key, value] of Object.entries(input)) {
				(this as any)[key] = value;
			}
		}
	}

	@ApiPropertyOptional({ type: String })
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@ApiProperty({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@CreateDateColumn()
	createdAt?: Date;

	@ApiProperty({
		type: 'string',
		format: 'date-time',
		example: '2018-11-21T06:20:32.232Z'
	})
	@UpdateDateColumn()
	updatedAt?: Date;
}
