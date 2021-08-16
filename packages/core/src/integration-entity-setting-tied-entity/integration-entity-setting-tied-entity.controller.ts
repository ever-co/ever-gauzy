import {
	Controller,
	HttpStatus,
	Param,
	Put,
	Body,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IIntegrationEntitySettingTied } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entity.service';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';

@ApiTags('IntegrationsEntitySetting')
@UseGuards(TenantPermissionGuard)
@Controller('integration-entity-setting-tied-entity')
export class IntegrationEntitySettingTiedEntityController extends CrudController<IntegrationEntitySettingTiedEntity> {
	constructor(
		private readonly integrationEntitySettingTiedEntityService: IntegrationEntitySettingTiedEntityService
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
	@Put('integration/:id')
	async updateIntegrationEntitySettingTiedByIntegration(
		@Param('id', UUIDValidationPipe) integrationId: string,
		@Body() body
	): Promise<IIntegrationEntitySettingTied> {
		return await this.integrationEntitySettingTiedEntityService.create({
			integrationId,
			...body
		});
	}
}
