import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsArray, IsOptional } from 'class-validator';
import { IBaseRelationsEntityModel } from '@gauzy/contracts';

/**
 * Validates and transforms 'relations' query parameter.
 */
export class RelationsQueryDTO implements IBaseRelationsEntityModel {
	@ApiPropertyOptional({ type: () => [String], isArray: true })
	@IsOptional()
	@IsArray()
	@Transform(({ value }: TransformFnParams) => {
		if (typeof value === 'string') {
			// If it's a comma-separated string, split into array
			return value.split(',').map((item) => item.trim());
		}
		if (Array.isArray(value)) {
			// If it's already an array, trim all elements
			return value.map((item: string) => item.trim());
		}
		return [];
	})
	readonly relations: string[] = [];
}
