import {
	Controller,
	HttpStatus,
	Param,
	Put,
	Body,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IIntegrationEntitySettingTied } from '@gauzy/contracts';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';
import { IntegrationEntitySettingTiedUpdateCommand } from './commands';

@ApiTags('IntegrationEntitySettingTied')
@UseGuards(TenantPermissionGuard)
@Controller()
export class IntegrationEntitySettingTiedController {
	constructor(
		private readonly _commandBus: CommandBus
	) {}

	@ApiOperation({ summary: 'Update settings.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update settings',
		type: IntegrationEntitySettingTied
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put('integration/:id')
	async updateIntegrationEntitySettingTiedByIntegration(
		@Param('id', UUIDValidationPipe) integrationId: string,
		@Body() entity
	): Promise<IIntegrationEntitySettingTied> {
		return await this._commandBus.execute(
			new IntegrationEntitySettingTiedUpdateCommand(
				integrationId,
				entity
			)
		);
	}
}
