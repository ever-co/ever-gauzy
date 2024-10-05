import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { DeleteQueryDTO } from '../../shared/dto';

/**
 * Common base DTO with the `forceDelete` flag.
 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
 * This field is optional and defaults to `false`.
 */
export class ForceDeleteDTO<T = any> extends DeleteQueryDTO<T> {
	/**
	 * A flag to determine whether to force delete the records.
	 * If `true`, a hard delete will be performed; otherwise, a soft delete is used.
	 * This field is optional and defaults to `false`.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly forceDelete: boolean = false;
}
