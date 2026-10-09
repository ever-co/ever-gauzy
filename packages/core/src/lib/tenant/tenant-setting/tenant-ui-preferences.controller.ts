import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import {
	ITenantSetting,
	ITenantUiPreferences,
	ITenantUiPreferencesUpdateInput,
	PermissionsEnum,
	PREFERRED_UI_SETTING_KEY,
	PreferredUiEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TenantSettingService } from './tenant-setting.service';
import { TenantSettingSaveCommand } from './commands';
import { UiPreferencesConfigDTO } from './dto';

/**
 * Tenant-wide UI preferences (currently: Angular vs React for the pages that ship in both).
 *
 * Deliberately a separate controller from `TenantSettingController`: that one is gated by
 * `TENANT_SETTING` as a whole, but the preference must be READABLE by every signed-in user of the
 * tenant (the dashboard picks the flavour to render from it), while only administrators may
 * CHANGE it. The values are resolved straight from the service — never from the request-scoped
 * settings cache — so a save is visible on the very next request.
 */
@ApiTags('TenantSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/tenant-ui-preferences')
export class TenantUiPreferencesController {
	constructor(private readonly tenantSettingService: TenantSettingService, private readonly commandBus: CommandBus) {}

	@ApiOperation({ summary: 'Get the tenant-wide UI preferences (any signed-in user of the tenant).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'UI preferences retrieved successfully.' })
	@Get('/')
	async getUiPreferences(): Promise<ITenantUiPreferences> {
		const tenantId = RequestContext.currentTenantId();
		const resolved = await this.tenantSettingService.getResolvedSettings([PREFERRED_UI_SETTING_KEY], tenantId);
		return { preferredUi: normalizePreferredUi(resolved[PREFERRED_UI_SETTING_KEY]) };
	}

	@ApiOperation({ summary: 'Update the tenant-wide UI preferences (tenant administrators).' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'UI preferences saved successfully.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.TENANT_SETTING)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Put('/')
	async updateUiPreferences(@Body() input: UiPreferencesConfigDTO): Promise<ITenantUiPreferences> {
		const update: ITenantUiPreferencesUpdateInput = input;
		if (update.preferredUi) {
			// `ITenantSetting` only types the file-storage keys; every other tenant setting (the
			// monitoring keys, this one) travels through the same key/value store untyped.
			const setting: ITenantSetting = { [PREFERRED_UI_SETTING_KEY]: update.preferredUi } as ITenantSetting;
			await this.commandBus.execute(new TenantSettingSaveCommand(setting));
		}
		return this.getUiPreferences();
	}
}

/**
 * Anything that is not a known {@link PreferredUiEnum} value (an unset row, a stale value from
 * an older build) resolves to Angular — the flavour that always exists.
 */
function normalizePreferredUi(value: unknown): PreferredUiEnum {
	return Object.values(PreferredUiEnum).includes(value as PreferredUiEnum)
		? (value as PreferredUiEnum)
		: PreferredUiEnum.ANGULAR;
}
