import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, IsBoolean } from 'class-validator';
import { parseToBoolean } from '@gauzy/utils';
// The file, not the `shared/dto` barrel: that barrel's first module (`count-query.dto`) imports
// `core/dto`, so going through it here closes a cycle and `DeleteQueryDTO` reads as undefined.
import { DeleteQueryDTO } from '../../shared/dto/delete-query.dto';

/**
 * Common base DTO with the `forceDelete` flag.
 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
 * This field is optional and defaults to `false`.
 */
export class ForceDeleteBaseDTO<T = any> extends DeleteQueryDTO<T> {
	/**
	 * A flag to determine whether to force delete the records.
	 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
	 * This field is optional and defaults to `false`.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Transform(({ value }: TransformFnParams) => (value ? parseToBoolean(value) : false))
	readonly forceDelete: boolean;
}
