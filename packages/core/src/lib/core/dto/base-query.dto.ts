import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FindOptionsOrder, FindOptionsRelations, FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { plainToClass, Transform, TransformFnParams, Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { PlainObject } from '@gauzy/contracts';
import { parseObject, parseToBoolean } from '@gauzy/utils';
import { TenantOrganizationBaseDTO } from './tenant-organization-base.dto';

/**
 * Base DTO for 'select' fields. What fields should be selected.
 */
export class FindSelectQueryDTO<T = any> {
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseObject(value, parseToBoolean))
	readonly select?: FindOptionsSelect<T>;
}

/**
 * Base DTO for 'relations' to load (joined entities).
 */
export class FindRelationsQueryDTO<T = any> extends FindSelectQueryDTO<T> {
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	readonly relations?: FindOptionsRelations<T>;
}

/**
 * Simple condition that should be applied to match entities.
 */
export class FindWhereQueryDTO<T> extends FindRelationsQueryDTO<T> {
	@ApiProperty({ type: Object })
	@IsNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => TenantOrganizationBaseDTO)
	@Transform(({ value }: TransformFnParams) => (value ? escapeQueryWithParameters(value) : {}))
	readonly where: FindOptionsWhere<T>;
}

/**
 * Base DTO for filtering options (ordering, soft-delete, etc.).
 */
export class FindOptionsQueryDTO<T> extends FindWhereQueryDTO<T> {
	/**
	 * Order, in which entities should be ordered.
	 */
	@ApiPropertyOptional({ type: Object })
	@IsOptional()
	readonly order?: FindOptionsOrder<T>;

	/**
	 * Indicates if soft-deleted rows should be included in entity result.
	 */
	@ApiPropertyOptional({ type: 'boolean' })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	readonly withDeleted?: boolean;
}

/**
 * Base DTO for pagination (skip/take).
 */
export class PaginationQueryDTO<T> extends FindOptionsQueryDTO<T> {
	/**
	 * Limit (paginated) - max number of entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => Number.parseInt(params.value, 10))
	readonly take?: number;

	/**
	 * Offset (paginated) where from entities should be taken.
	 */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => Number.parseInt(params.value, 10))
	readonly skip?: number;
}

/**
 * Describes generic query params
 */
export class BaseQueryDTO<T = any> extends PaginationQueryDTO<T> {}

/**
 * Function to escape query parameters and convert to DTO class.
 * @param nativeParameters - The original query parameters.
 * @returns {TenantOrganizationBaseDTO} - The escaped and converted query parameters as a DTO instance.
 */
export function escapeQueryWithParameters(nativeParameters: PlainObject): TenantOrganizationBaseDTO {
	// Convert native parameters based on the database connection type
	const builtParameters: PlainObject = convertNativeParameters(nativeParameters);

	// Convert to DTO class using class-transformer's plainToClass
	return plainToClass(TenantOrganizationBaseDTO, builtParameters, { enableImplicitConversion: true });
}

/**
 * Parses the given value and converts it to a boolean using JSON.parse.
 *
 * @param value - The value to be parsed.
 * @returns {boolean} - The boolean representation of the parsed value.
 */
export const parseBool = (value: any): boolean => Boolean(JSON.parse(value));

/**
 * Converts native parameters based on the database connection type.
 *
 * @param parameters - The parameters to be converted.
 * @returns {any} - The converted parameters based on the database connection type.
 */
export const convertNativeParameters = (parameters: PlainObject): any => {
	try {
		if (Array.isArray(parameters)) {
			// Process each array item recursively
			return parameters.map((item) => convertNativeParameters(item));
		}

		if (typeof parameters === 'object' && parameters !== null) {
			// Recursively convert nested objects
			return Object.keys(parameters).reduce((acc, key) => {
				acc[key] = convertNativeParameters(parameters[key]);
				return acc;
			}, {});
		}

		// Convert boolean values to their numeric representation
		return parseBool(parameters);
	} catch (error) {
		return parameters;
	}
};
