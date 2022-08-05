// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FindOptionsOrder, FindOptionsRelationByString, FindOptionsRelations, FindOptionsWhereProperty } from 'typeorm';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export abstract class OptionParams<T> {
	/**
	 * Order, in which entities should be ordered.
	 */
	@ApiPropertyOptional()
	@IsOptional()
	readonly order?: FindOptionsOrder<T>;

	/**
     * Simple condition that should be applied to match entities.
     */
	@ApiProperty()
	@IsNotEmpty()
	@IsObject()
	@ValidateNested({ each: true })
	@Type(() => TenantOrganizationBaseDTO)
	readonly where?: {
		[P in keyof T]?: FindOptionsWhereProperty<NonNullable<T[P]>>;
	};

	/**
     * Indicates what relations of entity should be loaded (simplified left join form).
     */
	@ApiPropertyOptional()
	@IsOptional()
	readonly relations?: FindOptionsRelations<T> | FindOptionsRelationByString;
}

/**
 * Describes generic pagination params
 */
export abstract class PaginationParams<T = any> extends OptionParams<T>{
	/**
     * Limit (paginated) - max number of entities should be taken.
     */
	@ApiPropertyOptional({ type: () => Number, minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly take: number = 10;

	/**
     * Offset (paginated) where from entities should be taken.
     */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly skip: number = 0;
}
