import {
	Controller,
	HttpStatus,
	Get,
	Param,
	Put,
	Body,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationEntitySetting, IPagination } from '@gauzy/contracts';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
import { IntegrationEntitySettingGetCommand, IntegrationEntitySettingUpdateCommand } from './commands';

@ApiTags('IntegrationsEntitySetting')
@UseGuards(TenantPermissionGuard)
@Controller()
export class IntegrationEntitySettingController {
	constructor(
		private readonly _commandBus: CommandBus
	) {}

	@ApiOperation({ summary: 'Get settings by integration.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found settings',
		type: IntegrationEntitySetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('integration/:id')
	async getEntitySettingByIntegration(
		@Param('id', UUIDValidationPipe) integrationId: string
	): Promise<IPagination<IntegrationEntitySetting>> {
		return await this._commandBus.execute(
			new IntegrationEntitySettingGetCommand(
				integrationId
			)
		);
	}

	@ApiOperation({ summary: 'Update settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update settings',
		type: IntegrationEntitySetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put('integration/:id')
	async updateIntegrationEntitySettingByIntegration(
		@Param('id', UUIDValidationPipe) integrationId: string,
		@Body() entity
	): Promise<IIntegrationEntitySetting[]> {
		return await this._commandBus.execute(
			new IntegrationEntitySettingUpdateCommand(
				integrationId,
				entity
			)
		);
	}
}
