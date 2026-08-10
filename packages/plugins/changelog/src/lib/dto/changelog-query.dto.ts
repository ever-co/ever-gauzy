import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IChangelogFindInput } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';

/**
 * Get changelog request DTO validation.
 *
 * The validated object is used directly as a TypeORM `where`, so this DTO is
 * the whitelist: only declare properties that are safe to filter on. The UI
 * sends `isFeature=0|1`, which arrives as a string — hence the transform.
 */
export class ChangelogQueryDTO implements IChangelogFindInput {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => (value == null ? value : parseToBoolean(value)))
	@IsBoolean()
	readonly isFeature?: boolean;
}
