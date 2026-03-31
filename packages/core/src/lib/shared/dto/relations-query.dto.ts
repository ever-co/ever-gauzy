import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsArray, IsOptional } from 'class-validator';
import { IBaseRelationsEntityModel } from '@gauzy/contracts';

/**
 * Parses a comma-separated relations string (or string array) into a
 * trimmed, non-empty string array.  Re-exported so that DTOs with
 * stricter enum constraints can reuse the same transform logic.
 */
export function parseRelationsString({ value }: TransformFnParams): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	if (Array.isArray(value)) {
		return value
			.filter((v) => typeof v === 'string')
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
}

/**
 * Validates and transforms 'relations' query parameter.
 */
export class RelationsQueryDTO implements IBaseRelationsEntityModel {
	@ApiPropertyOptional({ type: () => [String], isArray: true })
	@IsOptional()
	@IsArray()
	@Transform(parseRelationsString)
	readonly relations: string[] = [];
}
