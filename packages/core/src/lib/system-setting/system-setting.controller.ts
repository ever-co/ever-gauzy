import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { UseValidationPipe } from '../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { SystemSetting } from './system-setting.entity';
import { SystemSettingService } from './system-setting.service';
import { SystemSettingGetCommand, SystemSettingGetByScopeCommand } from './commands/system-setting.get.command';
import { SystemSettingSaveCommand } from './commands/system-setting.save.command';
import { SaveSystemSettingsDTO, SystemSettingQueryDTO } from './dto';

@ApiTags('SystemSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TENANT_SETTING)
@Controller('/system-setting')
export class SystemSettingController extends CrudController<SystemSetting> {
	constructor(
		private readonly _systemSettingService: SystemSettingService,
		private readonly _commandBus: CommandBus
	) {
		super(_systemSettingService);
	}

	/**
	 * GET settings with cascade resolution
	 *
	 * @param query
	 * @returns
	 */
	@ApiOperation({
		summary: 'Get settings with cascade resolution',
		security: [{ permission: [PermissionsEnum.TENANT_SETTING] }]
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Settings retrieved successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant not found'
	})
	@HttpCode(HttpStatus.OK)
	@Get('/resolve')
	@UseValidationPipe({ whitelist: true })
	async getSettingsWithCascade(@Query() query: SystemSettingQueryDTO): Promise<Record<string, any>> {
		const names = query.names
			? query.names
					.split(',')
					.map((n) => n.trim())
					.filter(Boolean)
			: [];

		return await this._commandBus.execute(new SystemSettingGetCommand(names));
	}

	/**
	 * GET settings for a specific scope
	 *
	 * @param query
	 * @returns
	 */
	@ApiOperation({
		summary: 'Get settings by scope',
		security: [{ permission: [PermissionsEnum.TENANT_SETTING] }]
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Settings retrieved successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant not found'
	})
	@HttpCode(HttpStatus.OK)
	@Get('/')
	@UseValidationPipe({ whitelist: true })
	async getSettingsByScope(@Query() query: SystemSettingQueryDTO): Promise<Record<string, any>> {
		return await this._commandBus.execute(new SystemSettingGetByScopeCommand(query.scope));
	}

	/**
	 * POST save settings for a specific scope
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({
		summary: 'Save settings'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Settings saved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Post('/')
	async saveSettings(@Body() entity: SaveSystemSettingsDTO): Promise<Record<string, any>> {
		return await this._commandBus.execute(new SystemSettingSaveCommand(entity.settings, entity.scope));
	}
}
