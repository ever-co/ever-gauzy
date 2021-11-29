// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

export enum OrderTypeEnum {
	DESC = 'DESC',
	ASC = 'ASC'
}

/**
 * Describes generic pagination params
 */
export abstract class PaginationParams<T> {
	/**
	 * Pagination limit
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 50 })
	@IsOptional()
	@Min(0)
	@Max(50)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly take = 10;

	/**
	 * Pagination offset
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly skip = 0;

	/**
	 * OrderBy
	 */
	@ApiPropertyOptional()
	@IsOptional()
	abstract readonly order?: { [P in keyof T]?: OrderTypeEnum };
}
