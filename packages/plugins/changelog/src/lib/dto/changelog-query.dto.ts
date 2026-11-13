import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	CHANGELOG_PLATFORM_MAX_LENGTH,
	CHANGELOG_PLATFORM_PATTERN,
	DEFAULT_CHANGELOG_PLATFORM,
	IChangelogFindInput
} from '@gauzy/contracts';
import { toChangelogPlatformKey } from '../changelog-platform';

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

	/**
	 * The product whose entries to list, such as `ever-teams`. Left out, the service lists Gauzy's, which is
	 * what every reader written before products existed (the Gauzy web app, the desktop apps) expects.
	 */
	@ApiPropertyOptional({
		type: () => String,
		default: DEFAULT_CHANGELOG_PLATFORM,
		description: 'The product whose entries to list: gauzy (default), ever-teams, ever-works, ever-platform, ...'
	})
	@IsOptional()
	// A blank `platform=` reads as left out rather than failing the pattern.
	@Transform(({ value }: TransformFnParams) => {
		const key = toChangelogPlatformKey(value);
		return key === '' ? undefined : key;
	})
	@IsString()
	@MaxLength(CHANGELOG_PLATFORM_MAX_LENGTH)
	@Matches(CHANGELOG_PLATFORM_PATTERN)
	readonly platform?: string;
}
