// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FindOptionsOrder, FindOptionsRelations, FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { Transform, TransformFnParams, Type, plainToClass } from 'class-transformer';
import { IsNotEmpty, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { parseToBoolean } from '@gauzy/common';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { SimpleObjectLiteral, convertNativeParameters, parseObject } from './pagination.helper';

/**
 * Specifies what columns should be retrieved.
 */
export class OptionsSelect<T = any> {
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseObject(value, parseToBoolean))
	readonly select?: FindOptionsSelect<T>;
}

/**
 * Indicates what relations of entity should be loaded (simplified left join form).
 */
export class OptionsRelations<T = any> extends OptionsSelect<T> {
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	readonly relations?: FindOptionsRelations<T>;
}

export class OptionParams<T> extends OptionsRelations<T> {
	/**
	 * Order, in which entities should be ordered.
	 */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	readonly order: FindOptionsOrder<T>;

	/**
	 * Simple condition that should be applied to match entities.
	 */
	@ApiProperty({ type: Object })
	@IsNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => TenantOrganizationBaseDTO)
	@Transform(({ value }: TransformFnParams) => (value ? escapeQueryWithParameters(value) : {}))
	readonly where: FindOptionsWhere<T>;

	/**
	 * Indicates if soft-deleted rows should be included in entity result.
	 */
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value ? parseToBoolean(value) : false))
	readonly withDeleted: boolean;
}

/**
 * Describes generic pagination params
 */
export class PaginationParams<T = any> extends OptionParams<T> {
	/**
	 * Limit (paginated) - max number of entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly take: number;

	/**
	 * Offset (paginated) where from entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => parseInt(params.value, 10))
	readonly skip: number;
}

/**
 * Function to escape query parameters and convert to DTO class.
 * @param nativeParameters - The original query parameters.
 * @returns {TenantOrganizationBaseDTO} - The escaped and converted query parameters as a DTO instance.
 */
export function escapeQueryWithParameters(nativeParameters: SimpleObjectLiteral): TenantOrganizationBaseDTO {
	// Convert native parameters based on the database connection type
	const builtParameters: SimpleObjectLiteral = convertNativeParameters(nativeParameters);

	// Convert to DTO class using class-transformer's plainToClass
	return plainToClass(TenantOrganizationBaseDTO, builtParameters, { enableImplicitConversion: true });
}
