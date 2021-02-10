import {
	Controller,
	HttpStatus,
	Param,
	Put,
	Body,
	UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entity.service';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('IntegrationsEntitySetting')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('integration-entity-setting-tied-entity')
export class IntegrationEntitySettingTiedEntityController extends CrudController<IntegrationEntitySettingTiedEntity> {
	constructor(
		private integrationEntitySettingTiedEntityService: IntegrationEntitySettingTiedEntityService
	) {
		super(integrationEntitySettingTiedEntityService);
	}

	@ApiOperation({ summary: 'Update settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update settings',
		type: IntegrationEntitySettingTiedEntity
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put(':integrationId')
	async editSettings(
		@Param('integrationId') integrationId,
		@Body() editSettingsDto
	): Promise<IntegrationEntitySettingTiedEntity> {
		return await this.integrationEntitySettingTiedEntityService.create(
			editSettingsDto
		);
	}
}
