import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ITenantSetting, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from '../../core/crud';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import {
	TenantSettingGetCommand,
	TenantSettingSaveCommand,
	GlobalSettingGetCommand,
	GlobalSettingSaveCommand
} from './commands';
import { CreateTenantSettingDTO, DynamicSettingDTO, WasabiS3ProviderConfigDTO } from './dto';

@ApiTags('TenantSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TENANT_SETTING)
@Controller('/tenant-setting')
export class TenantSettingController extends CrudController<TenantSetting> {
	constructor(private readonly tenantSettingService: TenantSettingService, private readonly commandBus: CommandBus) {
		super(tenantSettingService);
	}

	@ApiOperation({
		summary: 'Get global settings (tenantId = NULL)'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Global settings retrieved successfully.'
	})
	@Permissions(PermissionsEnum.GLOBAL_SETTING)
	@Get('global')
	async getGlobalSettings(): Promise<Record<string, any>> {
		return this.commandBus.execute(new GlobalSettingGetCommand());
	}

	@ApiOperation({
		summary: 'Get tenant settings'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Tenant settings retrieved successfully.'
	})
	@Get('/')
	async getSettings(): Promise<Record<string, any>> {
		return this.commandBus.execute(new TenantSettingGetCommand());
	}

	@ApiOperation({ summary: 'Find record by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Record retrieved successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id') id: string): Promise<TenantSetting> {
		return this.tenantSettingService.findOneByIdString(id);
	}

	@ApiOperation({
		summary: 'Tenant settings create/updated successfully'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Tenant settings create/updated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Post('/')
	async saveSettings(@Body() entity: CreateTenantSettingDTO): Promise<ITenantSetting> {
		return await this.commandBus.execute(new TenantSettingSaveCommand(entity));
	}

	@ApiOperation({
		summary: 'Save dynamic tenant settings',
		description: 'Creates or updates tenant settings with dynamic key-value pairs (e.g., monitoring settings).'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Dynamic settings saved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/dynamic')
	async saveDynamicSettings(@Body() entity: DynamicSettingDTO): Promise<ITenantSetting> {
		return this.commandBus.execute(new TenantSettingSaveCommand(entity));
	}

	@ApiOperation({
		summary: 'Save global settings (tenantId = NULL)',
		description: 'Creates or updates global settings that serve as defaults for all tenants.'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Global settings saved successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.GLOBAL_SETTING)
	@Post('/global')
	async saveGlobalSettings(@Body() entity: DynamicSettingDTO): Promise<ITenantSetting> {
		return this.commandBus.execute(new GlobalSettingSaveCommand(entity));
	}

	@ApiOperation({
		summary: 'Wasabi file storage configuration validator.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Wasabi file storage configuration validated successfully.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseValidationPipe({ transform: true, whitelist: true })
	@Post('/wasabi/validate')
	async validateWasabiConfiguration(@Body() entity: WasabiS3ProviderConfigDTO): Promise<void | any> {
		return await this.tenantSettingService.verifyWasabiConfiguration(entity);
	}
}
