import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ITenantUiPreferencesUpdateInput, PreferredUiEnum } from '@gauzy/contracts';

/**
 * Tenant-wide UI preferences — the validation DTO of `PUT /tenant-ui-preferences`.
 *
 * The values are plain (non-secret) tenant settings, so they need no `WrapSecrets` entry in
 * `TenantSettingGetHandler`; they surface in `GET /tenant-setting` like any other row.
 */
export class UiPreferencesConfigDTO implements ITenantUiPreferencesUpdateInput {
	@ApiPropertyOptional({ enum: PreferredUiEnum, enumName: 'PreferredUiEnum' })
	@IsOptional()
	@IsEnum(PreferredUiEnum)
	readonly preferredUi?: PreferredUiEnum;
}
