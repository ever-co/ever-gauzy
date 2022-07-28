// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiPropertyOptional } from '@nestjs/swagger';
import { FindOptionsOrder } from 'typeorm';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';

/**
 * Describes generic pagination params
 */
export abstract class PaginationParams<T> {
	/**
	 * Pagination limit
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
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
	abstract readonly order?: FindOptionsOrder<T>;
}
