import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { IAiChatUiPreferences, IUserUiPreferencesUpdateInput } from '@gauzy/contracts';

/**
 * Nested validation for the AI chat panel state.
 * Bounds on `width` are generous on purpose — the client clamps to its own
 * MIN/MAX; the API only rejects nonsense.
 */
export class AiChatUiPreferencesDTO implements IAiChatUiPreferences {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly expanded?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: ['start', 'end'] })
	@IsOptional()
	@IsIn(['start', 'end'])
	readonly position?: 'start' | 'end';

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(100)
	@Max(4000)
	readonly width?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly maximized?: boolean;
}

/**
 * Body of `PUT /user/ui-preferences`.
 *
 * Only `aiChat` is typed here; other feature keys pass through (the endpoint is
 * intentionally NOT whitelisted) and are validated structurally by
 * `sanitizeUiPreferencesPatch` in the service — each must be a plain object or
 * `null`.
 */
export class UpdateUserUiPreferencesDTO implements IUserUiPreferencesUpdateInput {
	@ApiPropertyOptional({ type: () => AiChatUiPreferencesDTO })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => AiChatUiPreferencesDTO)
	readonly aiChat?: AiChatUiPreferencesDTO;

	/** Any other feature's state object (see `IUserUiPreferences`). */
	[feature: string]: unknown;
}
