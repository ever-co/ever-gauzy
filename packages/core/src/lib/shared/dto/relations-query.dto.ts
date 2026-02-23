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
		if (value === undefined || value === null) {
			return [];
		}
		if (typeof value === 'string') {
			return value.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
		}
		if (Array.isArray(value)) {
			return value
				.filter((v) => typeof v === 'string')
				.map((v) => v.trim())
				.filter((v) => v.length > 0);
		}
		return [];
	})
	readonly relations: string[] = [];
}
