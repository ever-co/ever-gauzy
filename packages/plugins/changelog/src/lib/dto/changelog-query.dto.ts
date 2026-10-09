import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IChangelogFindInput } from '@gauzy/contracts';

/**
 * Get changelog request DTO validation.
 *
 * The validated object is used directly as a TypeORM `where`, so this DTO is
 * the whitelist: only declare properties that are safe to filter on. The UI
 * sends `isFeature=0|1`, which arrives as a string — hence the transform.
 * Unrecognized values pass through untouched so `@IsBoolean` rejects them
 * instead of silently coercing to `false`.
 */
export class ChangelogQueryDTO implements IChangelogFindInput {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => {
		if (value == null || typeof value === 'boolean') {
			return value;
		}
		const normalized = String(value).toLowerCase().trim();
		if (normalized === 'true' || normalized === '1') {
			return true;
		}
		if (normalized === 'false' || normalized === '0') {
			return false;
		}
		return value;
	})
	@IsBoolean()
	readonly isFeature?: boolean;
}
