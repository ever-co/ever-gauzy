import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards, } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ITenantSetting, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from '../../core/crud';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import { TenantSettingGetCommand, TenantSettingSaveCommand } from './commands';
import { CreateTenantSettingDTO, WasabiS3ProviderConfigDTO } from './dto';

@ApiTags('TenantSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TENANT_SETTING)
@Controller()
export class TenantSettingController extends CrudController<TenantSetting> {
	constructor(private readonly tenantSettingService: TenantSettingService, private readonly commandBus: CommandBus) {
		super(tenantSettingService);
	}

	@ApiOperation({
		summary: 'Get tenant settings',
		security: [
			{
				permission: [PermissionsEnum.TENANT_SETTING]
			}
		]
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Tenant not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Get()
	async getSettings() {
		return await this.commandBus.execute(new TenantSettingGetCommand());
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
	@Post()
	async saveSettings(@Body() entity: CreateTenantSettingDTO): Promise<ITenantSetting> {
		return await this.commandBus.execute(new TenantSettingSaveCommand(entity));
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
	@Post('wasabi/validate')
	async validateWasabiConfiguration(@Body() entity: WasabiS3ProviderConfigDTO): Promise<void | any> {
		return await this.tenantSettingService.verifyWasabiConfiguration(entity);
	}
}
