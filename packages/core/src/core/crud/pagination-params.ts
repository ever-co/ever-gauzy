// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FindOptionsOrder, FindOptionsRelations, FindOptionsSelect, FindOptionsWhereProperty } from 'typeorm';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { isClassInstance, isObject, parseToBoolean } from '@gauzy/common';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * Specifies what columns should be retrieved.
 */
export abstract class OptionsSelect<T = any> {

	@ApiPropertyOptional({ type: 'object' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseObjectToBoolean(value))
	readonly select?: FindOptionsSelect<T>;
}

/**
 * Indicates what relations of entity should be loaded (simplified left join form).
*/
export abstract class OptionsRelations<T = any> extends OptionsSelect<T> {

	@ApiPropertyOptional({ type: 'object' })
	@IsOptional()
	readonly relations?: FindOptionsRelations<T>;
}

export abstract class OptionParams<T> extends OptionsRelations<T> {
	/**
	 * Order, in which entities should be ordered.
	 */
	@ApiPropertyOptional({ type: 'object' })
	@IsOptional()
	readonly order: FindOptionsOrder<T>;

	/**
     * Simple condition that should be applied to match entities.
     */
	@ApiProperty({ type: 'object' })
	@IsNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => TenantOrganizationBaseDTO)
	readonly where: {
		[P in keyof T]?: FindOptionsWhereProperty<NonNullable<T[P]>>;
	};

	/**
	* Indicates if soft-deleted rows should be included in entity result.
	*/
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => value ? parseToBoolean(value) : false)
	readonly withDeleted?: boolean;
}

/**
 * Describes generic pagination params
 */
export abstract class PaginationParams<T = any> extends OptionParams<T>{
	/**
     * Limit (paginated) - max number of entities should be taken.
     */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly take: number = 10;

	/**
     * Offset (paginated) where from entities should be taken.
     */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly skip: number = 0;
}

/**
 * string object should be converted to a boolean object
 *
 * @param source
 * @returns
 */
export function parseObjectToBoolean(source: Object) {
	if (isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!isClassInstance(source[key])) {
					parseObjectToBoolean(source[key]);
				}
			} else {
				Object.assign(source, { [key]: parseToBoolean(source[key]) })
			}
		}
	}
	return source;
}